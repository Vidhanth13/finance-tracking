// Insights — a grid of per-category cards. Each card owns its own From/To month
// range and plots the spend across that range (Easy Equities style). The full
// series is fetched once and each card slices its own window client-side, so
// changing a range is instant with no extra requests.
import { useEffect, useMemo, useState } from "react";
import { card, money, selStyle, api } from "../lib.jsx";
import { useStore } from "../store.jsx";
import { MiniLineChart } from "../charts.jsx";
import { Reveal } from "../motion.jsx";

// Spending: rising is bad → red; falling is good → green.
const deltaColor = (d) => (d > 0 ? "var(--critical)" : d < 0 ? "var(--good)" : "var(--muted)");
const deltaLabel = (d) => (d > 0 ? `▲ ${d}%` : d < 0 ? `▼ ${Math.abs(d)}%` : "— 0%");

function CategoryCard({ cat, months, i }) {
  // Default each card to the most recent 3 months; the user widens/narrows it.
  const dflFrom = months[Math.max(0, months.length - 3)]?.key || "";
  const dflTo = months[months.length - 1]?.key || "";
  const [from, setFrom] = useState(dflFrom);
  const [to, setTo] = useState(dflTo);
  const [hover, setHover] = useState(null);

  const fi = months.findIndex((m) => m.key === from);
  const ti = months.findIndex((m) => m.key === to);
  const lo = Math.min(fi < 0 ? 0 : fi, ti < 0 ? months.length - 1 : ti);
  const hi = Math.max(fi < 0 ? 0 : fi, ti < 0 ? months.length - 1 : ti);
  const range = cat.series.slice(lo, hi + 1);

  const total = range.reduce((s, p) => s + p.total, 0);
  const first = range[0]?.total || 0;
  const last = range[range.length - 1]?.total || 0;
  const deltaPct = first ? Math.round(((last - first) / first) * 100) : (last ? 100 : 0);
  const shown = hover || range[range.length - 1];

  const sel = (val, set) => (
    <select value={val} onChange={(e) => set(e.target.value)} style={{ ...selStyle, padding: "4px 7px", fontSize: 12 }}>
      {months.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
    </select>);

  return (
    <Reveal i={i} style={{ ...card, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <span style={{ width: 11, height: 11, borderRadius: 3, background: cat.color || "var(--accent)", flexShrink: 0 }} />
          <span style={{ fontSize: 15, fontWeight: 650, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.name}</span>
        </div>
        <span className="tnum" style={{ fontSize: 12.5, fontWeight: 650, color: deltaColor(deltaPct), whiteSpace: "nowrap" }}>{deltaLabel(deltaPct)}</span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "10px 0 2px" }}>
        <span className="tnum" style={{ fontSize: 23, fontWeight: 680 }}>{money(hover ? hover.total : total)}</span>
        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{hover ? hover.label : "total in range"}</span>
      </div>

      <div style={{ margin: "6px 0 0" }}>
        <MiniLineChart data={range} color={cat.color || "var(--accent)"} onHover={setHover} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 12, color: "var(--muted)", flexWrap: "wrap" }}>
        <span>From</span>{sel(from, setFrom)}<span>to</span>{sel(to, setTo)}
      </div>
    </Reveal>
  );
}

export default function Insights() {
  const { summary } = useStore();
  const [data, setData] = useState({ months: [], categories: [] });
  const [sort, setSort] = useState("spend"); // spend | rising | falling
  // 24-month window comfortably covers all available data; cards slice from it.
  useEffect(() => { api("/api/category-series?months=24").then(setData); }, [summary]);

  const cats = useMemo(() => {
    const arr = [...data.categories];
    if (sort === "spend") return arr.sort((a, b) => b.total - a.total);
    return arr.sort((a, b) => sort === "rising" ? b.deltaPct - a.deltaPct : a.deltaPct - b.deltaPct);
  }, [data, sort]);

  if (!summary) return <div style={{ color: "var(--muted)", padding: 40 }}>Loading insights…</div>;

  const btn = (active) => ({ background: active ? "var(--accent)" : "var(--surface-2)", color: active ? "#fff" : "var(--ink-2)", border: "1px solid var(--ring)", borderRadius: 8, fontSize: 12, padding: "5px 11px", cursor: "pointer" });

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 650, margin: 0 }}>Insights</h2>
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>one card per category · set each card's own month range · Δ = end vs start of range</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn(sort === "spend")} onClick={() => setSort("spend")}>Top spend</button>
          <button style={btn(sort === "rising")} onClick={() => setSort("rising")}>Rising</button>
          <button style={btn(sort === "falling")} onClick={() => setSort("falling")}>Falling</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {cats.map((c, i) => <CategoryCard key={c.name} cat={c} months={data.months} i={i} />)}
      </div>
      {!cats.length && <div style={{ color: "var(--muted)", padding: 20 }}>No category data yet.</div>}
    </>
  );
}
