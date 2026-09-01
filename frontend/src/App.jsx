import { useEffect, useMemo, useRef, useState } from "react";

const money = (v) => "R " + Number(v || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 });
const card = { background: "var(--surface)", border: "1px solid var(--ring)", borderRadius: 14, padding: 20 };
const api = (p, opts) => fetch(p, opts).then((r) => r.json());

const cell = (color = "var(--ink)", size = 13.5) => ({
  padding: "12px 10px", fontSize: size, color, borderBottom: "1px solid var(--grid)", verticalAlign: "middle" });
const selStyle = { background: "var(--surface-2)", color: "var(--ink)", border: "1px solid var(--accent)",
  borderRadius: 8, padding: "6px 10px", fontSize: 12.5, outline: "none", fontFamily: "inherit" };
const okBtn = { border: "none", borderRadius: 7, fontSize: 12, padding: "5px 10px", marginLeft: 6, background: "var(--good)", color: "#fff", cursor: "pointer" };
const noBtn = { border: "1px solid var(--ring)", borderRadius: 7, fontSize: 12, padding: "5px 10px", marginLeft: 6, background: "var(--surface-2)", color: "var(--ink-2)", cursor: "pointer" };
const pencil = { background: "none", border: "none", color: "var(--muted)", fontSize: 13, marginLeft: 6, cursor: "pointer" };

function Tile({ label, value, sub, tone, onClick, action }) {
  const isMobile = useIsMobile();
  const tonec = tone === "good" ? "var(--good)" : tone === "crit" ? "var(--critical)" : tone === "warn" ? "var(--warning)" : "var(--ink-2)";
  return (
    <div style={{ ...card, padding: isMobile ? "16px 14px 14px" : "18px 18px 16px", position: "relative", cursor: onClick ? "pointer" : "default" }} onClick={onClick}>
      <div style={{ color: "var(--muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>{label}</div>
      <div className="tnum" style={{ fontSize: isMobile ? 19 : 25, fontWeight: 680, whiteSpace: "nowrap", color: tone === "good" ? "var(--good)" : tone === "crit" ? "var(--critical)" : "var(--ink)" }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 12.5, color: tonec }}>{sub}</div>
      {action}
    </div>
  );
}

// Simple, clean vertical bar chart (magnitude over months).
function BarChart({ data, color }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 200, padding: "20px 4px 0" }}>
      {data.map((d) => (
        <div key={d.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%", justifyContent: "flex-end" }}>
          <div className="tnum" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>{money(d.total)}</div>
          <div title={`${d.txns} txns`} style={{ width: "100%", maxWidth: 54, height: `${(d.total / max) * 100}%`,
            minHeight: 3, background: color || "var(--accent)", borderRadius: "5px 5px 0 0" }} />
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{d.label}</div>
          <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{d.txns} txns</div>
        </div>
      ))}
    </div>
  );
}

// Overall spend trend as a line graph.
function LineChart({ data, currentKey }) {
  const W = 720, H = 150, pad = 30;
  if (!data.length) return null;
  const xs = (W - 2 * pad) / Math.max(data.length - 1, 1);
  const max = Math.max(...data.map((d) => d.total)) * 1.15 || 1;
  const pts = data.map((d, i) => [pad + i * xs, H - pad - (d.total / max) * (H - 2 * pad)]);
  const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 175, overflow: "visible" }}>
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {pts.map((p, i) => {
        const cur = data[i].key === currentKey;
        return (
          <g key={i}>
            <circle cx={p[0]} cy={p[1]} r={cur ? 5 : 4} fill={cur ? "var(--accent)" : "var(--surface)"} stroke="var(--accent)" strokeWidth="2" />
            <text x={p[0]} y={p[1] - 12} textAnchor="middle" fontSize="10.5" fill="var(--ink-2)">R{(data[i].total / 1000).toFixed(1)}k</text>
            <text x={p[0]} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">{data[i].label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Track a mobile breakpoint so the fixed inline-grid layout can collapse to one
// column on phones (inline styles can't use CSS media queries).
function useIsMobile(bp = 640) {
  const [m, setM] = useState(typeof window !== "undefined" && window.innerWidth < bp);
  useEffect(() => {
    const on = () => setM(window.innerWidth < bp);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [bp]);
  return m;
}

export default function App() {
  const isMobile = useIsMobile();
  const [months, setMonths] = useState([]);
  const [month, setMonth] = useState("");
  const [summary, setSummary] = useState(null);
  const [txns, setTxns] = useState([]);
  const [cats, setCats] = useState([]);
  const [filter, setFilter] = useState("all");
  const [editCat, setEditCat] = useState(null);
  const [pending, setPending] = useState("");
  const [editNote, setEditNote] = useState(null);
  const [budgetEdit, setBudgetEdit] = useState(false);
  // drill-down
  const [drill, setDrill] = useState(null);
  const [dFrom, setDFrom] = useState("");
  const [dTo, setDTo] = useState("");
  const [dTrend, setDTrend] = useState([]);
  const [dTxns, setDTxns] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [trend, setTrend] = useState([]);
  const [budgetMode, setBudgetMode] = useState(false);
  const txnRef = useRef(null);

  const colorOf = useMemo(() => Object.fromEntries(cats.map((c) => [c.name, c.color])), [cats]);
  const monthsAsc = useMemo(() => [...months].reverse(), [months]);

  useEffect(() => { api("/api/categories").then(setCats); }, []);
  useEffect(() => { api("/api/months").then((ms) => { setMonths(ms); if (ms.length) setMonth(ms[0].key); }); }, []);

  const load = (m) => {
    api(`/api/summary?month=${m}`).then(setSummary);
    api(`/api/transactions?month=${m}`).then(setTxns);
    api(`/api/budgets?month=${m}`).then(setBudgets);
  };
  useEffect(() => { if (month) load(month); }, [month]);
  useEffect(() => { api("/api/trend").then(setTrend); }, []);

  const saveLimit = async (category, limit) => {
    await api(`/api/budgets`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, limit: Number(limit) }) });
    api(`/api/budgets?month=${month}`).then(setBudgets);
  };

  const loadDrill = (c, f, t) => {
    const qs = `category=${encodeURIComponent(c)}&from=${f}&to=${t}`;
    api(`/api/category-trend?${qs}`).then(setDTrend);
    api(`/api/transactions?${qs}`).then(setDTxns);
  };
  useEffect(() => { if (drill && dFrom && dTo) loadDrill(drill, dFrom, dTo); }, [drill, dFrom, dTo]);

  const refresh = () => { if (month) load(month); if (drill && dFrom && dTo) loadDrill(drill, dFrom, dTo); };

  const openDrill = (c) => {
    setDrill(c);
    setDFrom(monthsAsc[0]?.key || month);
    setDTo(monthsAsc[monthsAsc.length - 1]?.key || month);
  };

  const confirmCat = async (id, learn) => {
    await api(`/api/transactions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: pending, learn }) });
    setEditCat(null); setPending(""); refresh();
  };
  const saveNote = async (id, note) => {
    await api(`/api/transactions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) });
    setEditNote(null); refresh();
  };
  const saveBudget = async (value) => {
    await api(`/api/settings/monthly-budget`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value }) });
    setBudgetEdit(false); load(month);
  };

  // shared editable row (used by month table AND drill list)
  const renderRow = (t) => {
    const isXfer = t.txn_type === "transfer";
    const need = !isXfer && (t.category === "Uncategorised" || !t.category);
    return (
      <tr key={t.id} style={{ background: need ? "rgba(57,135,229,0.06)" : "transparent" }}>
        <td style={cell("var(--muted)", 12.5)}>{t.date}</td>
        <td style={{ ...cell(), fontWeight: 550 }}>{t.merchant}</td>
        <td style={cell()}>
          {t.status === "declined" ? <span style={{ color: "var(--critical)", fontSize: 11, fontWeight: 600 }}>✕ declined</span>
          : editCat === t.id ? (
            <span>
              <select autoFocus value={pending} onChange={(e) => setPending(e.target.value)} style={selStyle}>
                <option value="" disabled>Choose…</option>
                {(isXfer ? cats.filter((c) => c.kind === "transfer") : cats.filter((c) => c.kind === "expense")).map((c) => <option key={c.name}>{c.name}</option>)}
              </select>
              {pending && <>
                <button style={okBtn} onClick={() => confirmCat(t.id, false)}>✓ Just this</button>
                <button style={{ ...okBtn, background: "var(--accent)" }} title={`Apply "${pending}" to all "${t.merchant}"`} onClick={() => confirmCat(t.id, true)}>＋ Remember merchant</button>
              </>}
              <button style={noBtn} onClick={() => { setEditCat(null); setPending(""); }}>Cancel</button>
            </span>
          ) : (
            <span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, fontSize: 12, background: "var(--surface-2)", border: "1px solid var(--ring)", color: "var(--ink-2)" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: colorOf[t.category] || "var(--accent)" }} />{t.category || (isXfer ? "Transfers" : "Uncategorised")}
              </span>
              <button style={pencil} onClick={() => { setEditCat(t.id); setPending(""); }}>✎</button>
            </span>
          )}
        </td>
        <td style={cell()}>
          {editNote === t.id ? (
            <input autoFocus defaultValue={t.note || ""} placeholder="tag…"
              onBlur={(e) => saveNote(t.id, e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveNote(t.id, e.target.value)}
              style={{ ...selStyle, width: 120 }} />
          ) : t.note ? (
            <span onClick={() => setEditNote(t.id)} style={{ cursor: "pointer", fontSize: 12, color: "var(--ink-2)", borderBottom: "1px dotted var(--muted)" }}>{t.note}</span>
          ) : (
            <button style={{ ...pencil, color: "var(--muted)" }} onClick={() => setEditNote(t.id)}>＋ tag</button>
          )}
        </td>
        <td className="tnum" style={{ ...cell(), textAlign: "right", ...(t.status === "declined" ? { color: "var(--muted)", textDecoration: "line-through" } : {}) }}>{money(t.amount)}</td>
      </tr>
    );
  };

  const th = (h, r) => <th key={h} style={{ textAlign: r ? "right" : "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", fontWeight: 600, padding: "0 10px 12px", borderBottom: "1px solid var(--grid)" }}>{h}</th>;
  const btn = (active) => ({ background: active ? "var(--accent)" : "var(--surface-2)", color: active ? "#fff" : "var(--ink-2)", border: "1px solid var(--ring)", borderRadius: 8, fontSize: 12, padding: "5px 11px", cursor: "pointer" });
  const monthSel = (val, set) => (
    <select value={val} onChange={(e) => set(e.target.value)} style={{ ...selStyle, fontWeight: 600 }}>
      {monthsAsc.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
    </select>);

  const Header = (
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 20, fontWeight: 650 }}>
        <span style={{ color: "var(--accent)", fontSize: 22 }}>◉</span> Finance Tracker
        <span style={{ color: "var(--muted)", fontWeight: 450, fontSize: 13 }}>
          {drill ? "category drill-down" : summary ? `expenditure · ${months.find((m) => m.key === month)?.label}` : "expenditure"}</span>
      </div>
      {!drill && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", border: "1px solid var(--ring)", borderRadius: 10, padding: "9px 14px" }}>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>Month</span>
          <select value={month} onChange={(e) => setMonth(e.target.value)} style={{ background: "transparent", color: "var(--ink)", border: "none", fontSize: 14, fontWeight: 600, outline: "none", cursor: "pointer" }}>
            {months.map((m) => <option key={m.key} value={m.key} style={{ background: "var(--surface)" }}>{m.label}</option>)}
          </select>
        </div>)}
    </header>
  );

  // ── DRILL-DOWN PAGE ─────────────────────────────────────────────────────────
  if (drill) {
    const total = dTrend.reduce((s, d) => s + d.total, 0);
    const avg = dTrend.length ? total / dTrend.length : 0;
    const delta = dTrend.length >= 2 ? dTrend[dTrend.length - 1].total - dTrend[0].total : 0;
    const dir = delta > 0 ? { t: "↑ increasing", c: "var(--critical)" } : delta < 0 ? { t: "↓ decreasing", c: "var(--good)" } : { t: "→ steady", c: "var(--ink-2)" };
    return (
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? 14 : 28, overflowX: "hidden" }}>
        {Header}
        <button onClick={() => setDrill(null)} style={{ ...noBtn, marginLeft: 0, marginBottom: 16 }}>← All categories</button>
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: colorOf[drill] || "var(--accent)" }} />
              <h2 style={{ fontSize: 18, fontWeight: 680, margin: 0 }}>{drill}</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-2)" }}>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>From</span>{monthSel(dFrom, setDFrom)}
              <span style={{ color: "var(--muted)", fontSize: 12 }}>to</span>{monthSel(dTo, setDTo)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 24, marginTop: 16, flexWrap: "wrap" }}>
            <div><div style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>Total in range</div>
              <div className="tnum" style={{ fontSize: 22, fontWeight: 680 }}>{money(total)}</div></div>
            <div><div style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>Avg / month</div>
              <div className="tnum" style={{ fontSize: 22, fontWeight: 680 }}>{money(avg)}</div></div>
            <div><div style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>Trend</div>
              <div style={{ fontSize: 20, fontWeight: 680, color: dir.c }}>{dir.t}</div></div>
          </div>
          {dTrend.length ? <BarChart data={dTrend} color={colorOf[drill]} />
            : <div style={{ color: "var(--muted)", padding: 30 }}>No spend in this range.</div>}
        </div>

        <div style={card}>
          <h2 style={{ fontSize: 14, fontWeight: 620, margin: 0 }}>Every {drill} transaction in range</h2>
          <div style={{ color: "var(--muted)", fontSize: 12, margin: "2px 0 14px" }}>
            {dTxns.length} transactions · spot a snack-not-fuel? re-tag it inline and it re-sorts everywhere</div>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse" }}>
              <thead><tr>{["Date", "Merchant", "Category", "Note", "Amount"].map((h, i) => th(h, i === 4))}</tr></thead>
              <tbody>{dTxns.map(renderRow)}</tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN DASHBOARD ──────────────────────────────────────────────────────────
  const max = summary ? Math.max(...summary.categories.map((c) => c.amount), 1) : 1;
  const shown = txns.filter((t) => filter === "uncat" ? (t.category === "Uncategorised" || !t.category) : filter === "transfers" ? t.txn_type === "transfer" : true);
  const gotoReview = () => { setFilter("uncat"); txnRef.current?.scrollIntoView({ behavior: "smooth" }); };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? 14 : 28, overflowX: "hidden" }}>
      {Header}
      {!summary ? <div style={{ color: "var(--muted)", padding: 40 }}>Loading your spending…</div> : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: isMobile ? 10 : 14, marginBottom: 14 }}>
            <Tile label="Total Spent" value={money(summary.total)} sub={`+ ${money(summary.transfersTotal)} transfers`} />
            <Tile label="Monthly Budget"
              value={budgetEdit ? <input autoFocus defaultValue={summary.budget} type="number"
                onBlur={(e) => saveBudget(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveBudget(e.target.value)}
                style={{ width: 130, background: "var(--surface-2)", border: "1px solid var(--accent)", borderRadius: 8, color: "var(--ink)", fontSize: 20, fontWeight: 680, padding: "3px 8px", outline: "none", fontFamily: "inherit" }} /> : money(summary.budget)}
              sub={budgetEdit ? "enter to save" : "tap Set to change"}
              action={!budgetEdit && (<button onClick={() => setBudgetEdit(true)} style={{ position: "absolute", top: 14, right: 14, background: "var(--surface-2)", border: "1px solid var(--ring)", color: "var(--ink-2)", borderRadius: 7, fontSize: 11, padding: "4px 8px", cursor: "pointer" }}>Set</button>)} />
            <Tile label="Remaining" value={money(summary.remaining)} tone={summary.remaining < 0 ? "crit" : "good"}
              sub={`${Math.round(summary.remaining / summary.budget * 100)}% ${summary.remaining < 0 ? "over" : "left"}`} />
            <Tile label="Needs Review" value={summary.needsReview.count} tone="warn" onClick={gotoReview}
              sub={<span style={{ color: "var(--accent)" }}>▸ review {money(summary.needsReview.amount)}</span>} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "minmax(0,1.35fr) minmax(0,1fr)", gap: 14, marginBottom: 14 }}>
           <div style={card}>
            <h2 style={{ fontSize: 14, fontWeight: 620, margin: 0 }}>Spend by category</h2>
            <div style={{ color: "var(--muted)", fontSize: 12, margin: "2px 0 18px" }}>
              {months.find((m) => m.key === month)?.label} · click a category to drill in</div>
            {summary.categories.map((c) => (
              <div key={c.name} onClick={() => openDrill(c.name)} style={{ display: "grid", gridTemplateColumns: isMobile ? "104px 1fr 78px" : "150px 1fr 96px", alignItems: "center", gap: isMobile ? 8 : 12, marginBottom: 13, cursor: "pointer" }}>
                <div style={{ fontSize: 13, color: "var(--ink-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name} <span style={{ color: "var(--muted)" }}>›</span></div>
                <div style={{ height: 16, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(c.amount / max * 100).toFixed(1)}%`, background: c.color || "var(--accent)", borderRadius: 4 }} />
                </div>
                <div className="tnum" style={{ textAlign: "right", fontSize: 13, fontWeight: 600 }}>{money(c.amount)}
                  <span style={{ display: "block", color: "var(--muted)", fontWeight: 450, fontSize: 11 }}>{c.pct}%</span></div>
              </div>
            ))}
           </div>

           {/* Budget vs actual */}
           <div style={card}>
             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
               <h2 style={{ fontSize: 14, fontWeight: 620, margin: 0 }}>Budget vs actual</h2>
               <button style={btn(budgetMode)} onClick={() => setBudgetMode(!budgetMode)}>{budgetMode ? "Done" : "Edit budgets"}</button>
             </div>
             <div style={{ color: "var(--muted)", fontSize: 12, margin: "2px 0 18px" }}>
               {budgetMode ? "set each category limit — saves to DB" : "spent against your per-category limits"}</div>
             {budgets.map((b) => {
               const p = Math.min(b.actual / b.limit * 100, 100), over = b.actual > b.limit;
               const cls = over ? "critical" : p > 85 ? "warning" : "good";
               const icon = over ? "⚠" : p > 85 ? "●" : "✓";
               return (
                 <div key={b.category} style={{ marginBottom: 15 }}>
                   <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7, fontSize: 13 }}>
                     <span>{b.category} <span style={{ color: `var(--${cls})` }}>{icon}</span></span>
                     <span className="tnum" style={{ color: "var(--ink-2)", fontSize: 12 }}>{money(b.actual)} / {budgetMode ? (
                       <input type="number" defaultValue={b.limit}
                         onBlur={(e) => saveLimit(b.category, e.target.value)}
                         onKeyDown={(e) => e.key === "Enter" && saveLimit(b.category, e.target.value)}
                         style={{ width: 66, background: "var(--surface-2)", border: "1px solid var(--accent)", borderRadius: 6, color: "var(--ink)", fontSize: 12, padding: "2px 6px", textAlign: "right", outline: "none", fontFamily: "inherit" }} />
                     ) : b.limit.toLocaleString("en-ZA")}</span>
                   </div>
                   <div style={{ height: 9, background: "var(--surface-2)", borderRadius: 5, overflow: "hidden" }}>
                     <div style={{ height: "100%", width: `${p}%`, borderRadius: 5, background: `var(--${cls})` }} />
                   </div>
                 </div>
               );
             })}
             {!budgets.length && <div style={{ color: "var(--muted)", fontSize: 12 }}>No budgets set yet.</div>}
           </div>
          </div>

          {/* Overall spend trend */}
          <div style={{ ...card, marginBottom: 14 }}>
            <h2 style={{ fontSize: 14, fontWeight: 620, margin: 0 }}>Monthly spend trend</h2>
            <div style={{ color: "var(--muted)", fontSize: 12, margin: "2px 0 8px" }}>all categories · last 6 months</div>
            <LineChart data={trend} currentKey={month} />
          </div>

          <div style={card} ref={txnRef}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <h2 style={{ fontSize: 14, fontWeight: 620, margin: 0 }}>Transactions</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={btn(filter === "all")} onClick={() => setFilter("all")}>All</button>
                <button style={btn(filter === "uncat")} onClick={() => setFilter("uncat")}>Needs review</button>
                <button style={btn(filter === "transfers")} onClick={() => setFilter("transfers")}>Transfers</button>
              </div>
            </div>
            <div style={{ color: "var(--muted)", fontSize: 12, margin: "2px 0 14px" }}>pick a category → confirm · add a note/tag to any row</div>
            {filter === "transfers" && (() => {
              const sum = (name) => shown.filter((t) => t.category === name).reduce((s, t) => s + t.amount, 0);
              const untagged = shown.filter((t) => t.txn_type === "transfer" && t.category !== "Transfer (internal)" && t.category !== "Transfer (external)").reduce((s, t) => s + t.amount, 0);
              const box = (l, v, c) => (<div style={{ background: "var(--surface-2)", border: "1px solid var(--ring)", borderRadius: 10, padding: "10px 14px", flex: 1 }}>
                <div style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>{l}</div>
                <div className="tnum" style={{ fontSize: 17, fontWeight: 650, color: c, marginTop: 3 }}>{money(v)}</div></div>);
              return (<div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                {box("Internal", sum("Transfer (internal)"), "#5c7cfa")}{box("External", sum("Transfer (external)"), "var(--ink)")}{box("Untagged", untagged, "var(--warning)")}</div>);
            })()}
            <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse" }}>
                <thead><tr>{["Date", "Merchant", "Category", "Note", "Amount"].map((h, i) => th(h, i === 4))}</tr></thead>
                <tbody>{shown.map(renderRow)}</tbody>
              </table>
            </div>
          </div>
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 22, textAlign: "center" }}>
            Live from Postgres · edits save + teach the categoriser. Next: budget-vs-actual editor, overall line-graph trend.
          </div>
        </>
      )}
    </div>
  );
}
