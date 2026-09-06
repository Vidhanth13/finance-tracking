// Shared helpers, styles and small presentational components for the suite.
// Extracted from the original single-file App so every section can reuse them.
import { useEffect, useState } from "react";

export const money = (v) =>
  "R " + Number(v || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 });

export const api = (p, opts) => fetch(p, opts).then((r) => r.json());

export const card = {
  background: "var(--surface)",
  border: "1px solid var(--ring)",
  borderRadius: 14,
  padding: 20,
};

export const cell = (color = "var(--ink)", size = 13.5) => ({
  padding: "12px 10px",
  fontSize: size,
  color,
  borderBottom: "1px solid var(--grid)",
  verticalAlign: "middle",
});

export const selStyle = {
  background: "var(--surface-2)",
  color: "var(--ink)",
  border: "1px solid var(--accent)",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 12.5,
  outline: "none",
  fontFamily: "inherit",
};

export const okBtn = { border: "none", borderRadius: 7, fontSize: 12, padding: "5px 10px", marginLeft: 6, background: "var(--good)", color: "#fff", cursor: "pointer" };
export const noBtn = { border: "1px solid var(--ring)", borderRadius: 7, fontSize: 12, padding: "5px 10px", marginLeft: 6, background: "var(--surface-2)", color: "var(--ink-2)", cursor: "pointer" };
export const pencil = { background: "none", border: "none", color: "var(--muted)", fontSize: 13, marginLeft: 6, cursor: "pointer" };

export const btn = (active) => ({
  background: active ? "var(--accent)" : "var(--surface-2)",
  color: active ? "#fff" : "var(--ink-2)",
  border: "1px solid var(--ring)",
  borderRadius: 8,
  fontSize: 12,
  padding: "5px 11px",
  cursor: "pointer",
});

export const th = (h, r) => (
  <th key={h} style={{ textAlign: r ? "right" : "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", fontWeight: 600, padding: "0 10px 12px", borderBottom: "1px solid var(--grid)" }}>{h}</th>
);

// Track a mobile breakpoint so fixed grids collapse to one column on phones.
export function useIsMobile(bp = 640) {
  const [m, setM] = useState(typeof window !== "undefined" && window.innerWidth < bp);
  useEffect(() => {
    const on = () => setM(window.innerWidth < bp);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [bp]);
  return m;
}

export function Tile({ label, value, sub, tone, onClick, action }) {
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
export function BarChart({ data, color }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 200, padding: "20px 4px 0" }}>
      {data.map((d) => (
        <div key={d.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, height: "100%", justifyContent: "flex-end" }}>
          <div className="tnum" style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>{money(d.total)}</div>
          <div title={`${d.txns} txns`} style={{ width: "100%", maxWidth: 54, height: `${(d.total / max) * 100}%`, minHeight: 3, background: color || "var(--accent)", borderRadius: "5px 5px 0 0" }} />
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{d.label}</div>
          <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{d.txns} txns</div>
        </div>
      ))}
    </div>
  );
}

// Overall spend trend as a line graph.
export function LineChart({ data, currentKey }) {
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
