// finance_tracking — Node API.
// Reads Postgres, computes the dashboard numbers, exposes JSON. Also handles the
// two writes the app needs: re-categorise a transaction, and edit budgets.
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { q } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Built React app (vite build → frontend/dist). Served from this same origin in
// production so the app's relative fetch("/api/...") calls just work — no CORS.
const DIST = path.resolve(__dirname, "../frontend/dist");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(DIST));

const num = (v) => (v == null ? 0 : Number(v));
// Common spend predicate: real expenses only (posted debits, excl. transfers).
const SPEND = `t.status='posted' AND t.direction='debit' AND c.kind='expense'`;

// --- health ----------------------------------------------------------------
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// --- months with data ------------------------------------------------------
app.get("/api/months", async (_req, res, next) => {
  try {
    const { rows } = await q(`
      SELECT to_char(date_trunc('month', occurred_at), 'YYYY-MM') AS key,
             to_char(date_trunc('month', occurred_at), 'Mon YYYY') AS label
      FROM txn WHERE occurred_at IS NOT NULL
      GROUP BY 1, 2 ORDER BY 1 DESC`);
    res.json(rows);
  } catch (e) { next(e); }
});

// --- monthly summary: tiles + category breakdown ---------------------------
app.get("/api/summary", async (req, res, next) => {
  try {
    const month = req.query.month; // 'YYYY-MM'
    const cats = await q(`
      SELECT c.name, c.color, round(sum(t.amount), 2) AS amount
      FROM txn t JOIN category c ON c.id = t.category_id
      WHERE ${SPEND} AND to_char(date_trunc('month', t.occurred_at),'YYYY-MM') = $1
      GROUP BY c.name, c.color ORDER BY sum(t.amount) DESC`, [month]);
    const total = cats.rows.reduce((s, r) => s + num(r.amount), 0);

    const review = await q(`
      SELECT count(*) AS n, coalesce(round(sum(t.amount),2),0) AS amount
      FROM txn t JOIN category c ON c.id = t.category_id
      WHERE ${SPEND} AND c.name='Uncategorised'
        AND to_char(date_trunc('month', t.occurred_at),'YYYY-MM') = $1`, [month]);

    const setting = await q(`SELECT value FROM app_setting WHERE key='monthly_budget'`);
    const budget = num(setting.rows[0]?.value);

    const xfer = await q(`
      SELECT coalesce(round(sum(t.amount),2),0) AS total, count(*) AS n
      FROM txn t WHERE t.txn_type='transfer' AND t.status='posted'
        AND to_char(date_trunc('month', t.occurred_at),'YYYY-MM') = $1`, [month]);

    res.json({
      month,
      total,
      transfersTotal: num(xfer.rows[0]?.total),
      transfersCount: num(xfer.rows[0]?.n),
      budget,
      remaining: budget - total,
      needsReview: { count: num(review.rows[0]?.n), amount: num(review.rows[0]?.amount) },
      categories: cats.rows.map((r) => ({
        name: r.name, color: r.color, amount: num(r.amount),
        pct: total ? Math.round((num(r.amount) / total) * 100) : 0,
      })),
    });
  } catch (e) { next(e); }
});

// --- spend trend (last 6 months) -------------------------------------------
app.get("/api/trend", async (_req, res, next) => {
  try {
    const { rows } = await q(`
      SELECT to_char(date_trunc('month', t.occurred_at),'YYYY-MM') AS key,
             to_char(date_trunc('month', t.occurred_at),'Mon')     AS label,
             round(sum(t.amount), 2) AS total
      FROM txn t JOIN category c ON c.id = t.category_id
      WHERE ${SPEND}
      GROUP BY 1, 2, date_trunc('month', t.occurred_at)
      ORDER BY date_trunc('month', t.occurred_at) DESC LIMIT 6`);
    res.json(rows.reverse().map((r) => ({ key: r.key, label: r.label, total: num(r.total) })));
  } catch (e) { next(e); }
});

// --- category list (for edit dropdowns) ------------------------------------
app.get("/api/categories", async (_req, res, next) => {
  try {
    const { rows } = await q(
      `SELECT name, color, kind FROM category ORDER BY name`);
    res.json(rows);
  } catch (e) { next(e); }
});

// --- per-category monthly spend trend (drill-down, optional range) ---------
app.get("/api/category-trend", async (req, res, next) => {
  try {
    const { category, from, to } = req.query;   // from/to = 'YYYY-MM'
    const vals = [category];
    let range = "";
    if (from) { vals.push(from + "-01"); range += ` AND t.occurred_at >= $${vals.length}::date`; }
    if (to)   { vals.push(to + "-01");   range += ` AND t.occurred_at < ($${vals.length}::date + interval '1 month')`; }
    const { rows } = await q(`
      SELECT to_char(date_trunc('month', t.occurred_at),'YYYY-MM') AS key,
             to_char(date_trunc('month', t.occurred_at),'Mon')     AS label,
             round(sum(t.amount), 2) AS total,
             count(*) AS txns
      FROM txn t JOIN category c ON c.id = t.category_id
      WHERE ${SPEND} AND c.name = $1 ${range}
      GROUP BY 1, 2, date_trunc('month', t.occurred_at)
      ORDER BY date_trunc('month', t.occurred_at)`, vals);
    res.json(rows.map((r) => ({ key: r.key, label: r.label, total: num(r.total), txns: num(r.txns) })));
  } catch (e) { next(e); }
});

// --- per-category series matrix (Insights watchlist) -----------------------
// For each expense category: its monthly spend series over the last N months,
// plus latest vs previous month and a % delta — powers the rising/falling view.
app.get("/api/category-series", async (req, res, next) => {
  try {
    const n = Math.min(Math.max(parseInt(req.query.months) || 6, 2), 24);
    // Anchor the window to the latest month that has data, not "today", so the
    // view still works if the current calendar month is empty.
    const last = await q(
      `SELECT date_trunc('month', max(occurred_at)) AS m FROM txn WHERE occurred_at IS NOT NULL`);
    const anchor = last.rows[0]?.m;
    if (!anchor) return res.json({ months: [], categories: [] });

    const { rows } = await q(`
      SELECT c.name, c.color,
             to_char(date_trunc('month', t.occurred_at),'YYYY-MM') AS key,
             to_char(date_trunc('month', t.occurred_at),'Mon')     AS label,
             round(sum(t.amount), 2) AS total
      FROM txn t JOIN category c ON c.id = t.category_id
      WHERE ${SPEND}
        AND t.occurred_at >= (date_trunc('month', $1::timestamptz) - make_interval(months => $2 - 1))
      GROUP BY c.name, c.color, 3, 4, date_trunc('month', t.occurred_at)
      ORDER BY date_trunc('month', t.occurred_at)`, [anchor, n]);

    // Build the ordered month axis (oldest → newest) covering the window.
    const months = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(anchor);
      d.setMonth(d.getMonth() - i);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleString("en", { month: "short" }),
      });
    }

    const byCat = new Map();
    for (const r of rows) {
      if (!byCat.has(r.name)) byCat.set(r.name, { name: r.name, color: r.color, vals: {} });
      byCat.get(r.name).vals[r.key] = num(r.total);
    }

    const categories = [...byCat.values()].map((c) => {
      const series = months.map((m) => ({ key: m.key, label: m.label, total: c.vals[m.key] || 0 }));
      const cur = series[series.length - 1].total;
      const prev = series[series.length - 2]?.total || 0;
      const deltaPct = prev ? Math.round(((cur - prev) / prev) * 100) : (cur ? 100 : 0);
      const total = series.reduce((s, p) => s + p.total, 0);
      return { name: c.name, color: c.color, series, cur, prev, deltaPct, total };
    }).sort((a, b) => b.total - a.total);

    res.json({ months, categories });
  } catch (e) { next(e); }
});

// --- budgets vs actual for a month -----------------------------------------
app.get("/api/budgets", async (req, res, next) => {
  try {
    const month = req.query.month;
    const { rows } = await q(`
      SELECT c.name, b.limit_amount AS lim,
             coalesce(round((
               SELECT sum(t.amount) FROM txn t
               WHERE t.category_id = c.id AND t.status='posted' AND t.direction='debit'
                 AND to_char(date_trunc('month', t.occurred_at),'YYYY-MM') = $1
             ), 2), 0) AS actual
      FROM budget b JOIN category c ON c.id = b.category_id
      WHERE b.month IS NULL
      ORDER BY b.limit_amount DESC`, [month]);
    res.json(rows.map((r) => ({ category: r.name, limit: num(r.lim), actual: num(r.actual) })));
  } catch (e) { next(e); }
});

// --- transactions for a month ----------------------------------------------
app.get("/api/transactions", async (req, res, next) => {
  try {
    const { month, from, to, category } = req.query;
    const where = [], vals = [];
    if (month)    { vals.push(month); where.push(`to_char(date_trunc('month', t.occurred_at),'YYYY-MM') = $${vals.length}`); }
    if (from)     { vals.push(from + "-01"); where.push(`t.occurred_at >= $${vals.length}::date`); }
    if (to)       { vals.push(to + "-01");   where.push(`t.occurred_at < ($${vals.length}::date + interval '1 month')`); }
    if (category) { vals.push(category); where.push(`c.name = $${vals.length}`); }
    const clause = where.length ? "WHERE " + where.join(" AND ") : "";
    const { rows } = await q(`
      SELECT t.id, to_char(t.occurred_at,'DD Mon') AS date, t.occurred_at,
             t.merchant, c.name AS category, t.category_locked,
             t.amount, t.status, t.direction, t.txn_type, t.note
      FROM txn t LEFT JOIN category c ON c.id = t.category_id
      ${clause}
      ORDER BY t.occurred_at DESC`, vals);
    res.json(rows.map((r) => ({ ...r, amount: num(r.amount) })));
  } catch (e) { next(e); }
});

// --- PATCH a transaction: category (locks it) and/or a free-text note/tag ----
app.patch("/api/transactions/:id", async (req, res, next) => {
  try {
    const { category, note, learn } = req.body;
    const sets = [], vals = [];
    if (category !== undefined) {
      vals.push(category);
      sets.push(`category_id = (SELECT id FROM category WHERE name = $${vals.length})`);
      sets.push(`category_locked = true`);
    }
    if (note !== undefined) {
      vals.push(note === "" ? null : note);
      sets.push(`note = $${vals.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: "nothing to update" });
    vals.push(req.params.id);
    const { rows } = await q(
      `UPDATE txn SET ${sets.join(", ")} WHERE id = $${vals.length} RETURNING id, merchant`, vals);
    if (!rows.length) return res.status(404).json({ error: "not found" });

    // Learn from the correction ONLY when asked (learn=true): some merchants are
    // mixed-use (a fuel station is fuel OR a snack), so blanket learning is wrong.
    // When learn=true we remember merchant→category and apply it to every other
    // UNLOCKED transaction from that merchant, now and future.
    let learnedApplied = 0;
    if (category !== undefined && learn === true && rows[0].merchant) {
      await q(`
        INSERT INTO merchant_category (merchant, category_id)
        VALUES ($1, (SELECT id FROM category WHERE name = $2))
        ON CONFLICT (merchant)
        DO UPDATE SET category_id = EXCLUDED.category_id, updated_at = now()`,
        [rows[0].merchant, category]);
      const prop = await q(
        `UPDATE txn SET category_id = (SELECT id FROM category WHERE name = $1)
         WHERE merchant = $2 AND category_locked = false AND id <> $3`,
        [category, rows[0].merchant, req.params.id]);
      learnedApplied = prop.rowCount;
    }
    res.json({ ok: true, id: rows[0].id, category, note, learnedApplied });
  } catch (e) { next(e); }
});

// --- PATCH a category budget limit -----------------------------------------
app.patch("/api/budgets", async (req, res, next) => {
  try {
    const { category, limit } = req.body;
    await q(`
      INSERT INTO budget (category_id, month, limit_amount)
      VALUES ((SELECT id FROM category WHERE name = $1), NULL, $2)
      ON CONFLICT (category_id, month)
      DO UPDATE SET limit_amount = EXCLUDED.limit_amount, updated_at = now()`,
      [category, limit]);
    res.json({ ok: true, category, limit });
  } catch (e) { next(e); }
});

// --- PATCH the overall monthly budget --------------------------------------
app.patch("/api/settings/monthly-budget", async (req, res, next) => {
  try {
    const { value } = req.body;
    await q(`UPDATE app_setting SET value = $1 WHERE key='monthly_budget'`, [String(value)]);
    res.json({ ok: true, monthly_budget: num(value) });
  } catch (e) { next(e); }
});

// SPA fallback: any non-/api GET returns index.html so the React app owns routing.
app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(DIST, "index.html")));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

// Bind 0.0.0.0 so the app is reachable over the Tailscale interface, not just localhost.
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`finance_tracking serving app + API on http://localhost:${PORT}`));
