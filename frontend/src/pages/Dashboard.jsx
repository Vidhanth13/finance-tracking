// Dashboard — the at-a-glance command center: headline tiles + monthly trend +
// a compact top-categories snapshot that deep-links into Insights.
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { card, money, Tile, useIsMobile } from "../lib.jsx";
import { useStore } from "../store.jsx";
import { MiniLineChart } from "../charts.jsx";
import { Reveal } from "../motion.jsx";

export default function Dashboard() {
  const isMobile = useIsMobile();
  const nav = useNavigate();
  const { summary, trend, month, months, saveMonthlyBudget } = useStore();
  const [budgetEdit, setBudgetEdit] = useState(false);

  if (!summary) return <div style={{ color: "var(--muted)", padding: 40 }}>Loading your spending…</div>;

  const saveBudget = async (value) => { await saveMonthlyBudget(value); setBudgetEdit(false); };
  const top = [...summary.categories].sort((a, b) => b.amount - a.amount).slice(0, 6);
  const max = Math.max(...top.map((c) => c.amount), 1);

  return (
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
        <Tile label="Needs Review" value={summary.needsReview.count} tone="warn" onClick={() => nav("/transactions?filter=uncat")}
          sub={<span style={{ color: "var(--accent)" }}>▸ review {money(summary.needsReview.amount)}</span>} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "minmax(0,1.35fr) minmax(0,1fr)", gap: 14 }}>
        <Reveal i={1} style={{ ...card, marginBottom: 14 }}>
          <h2 style={{ fontSize: 14, fontWeight: 620, margin: 0 }}>Monthly spend trend</h2>
          <div style={{ color: "var(--muted)", fontSize: 12, margin: "2px 0 8px" }}>all categories · last 6 months</div>
          <MiniLineChart data={trend} />
        </Reveal>

        <Reveal i={2} style={{ ...card, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={{ fontSize: 14, fontWeight: 620, margin: 0 }}>Top categories</h2>
            <button onClick={() => nav("/insights")} style={{ background: "none", border: "none", color: "var(--accent)", fontSize: 12, cursor: "pointer" }}>See all ›</button>
          </div>
          <div style={{ color: "var(--muted)", fontSize: 12, margin: "2px 0 16px" }}>{months.find((m) => m.key === month)?.label}</div>
          {top.map((c) => (
            <div key={c.name} onClick={() => nav("/insights")} style={{ display: "grid", gridTemplateColumns: "110px 1fr 74px", alignItems: "center", gap: 10, marginBottom: 12, cursor: "pointer" }}>
              <div style={{ fontSize: 13, color: "var(--ink-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
              <div style={{ height: 14, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(c.amount / max * 100).toFixed(1)}%`, background: c.color || "var(--accent)", borderRadius: 4 }} />
              </div>
              <div className="tnum" style={{ textAlign: "right", fontSize: 12.5, fontWeight: 600 }}>{money(c.amount)}</div>
            </div>
          ))}
        </Reveal>
      </div>
    </>
  );
}
