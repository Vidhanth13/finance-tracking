// Budgets — per-category budget-vs-actual bars with inline limit editing, plus
// the monthly budget headline.
import { useState } from "react";
import { card, money, btn } from "../lib.jsx";
import { useStore } from "../store.jsx";
import { Reveal } from "../motion.jsx";

export default function Budgets() {
  const { budgets, summary, saveLimit, saveMonthlyBudget } = useStore();
  const [budgetMode, setBudgetMode] = useState(false);
  const [budgetEdit, setBudgetEdit] = useState(false);

  if (!summary) return <div style={{ color: "var(--muted)", padding: 40 }}>Loading budgets…</div>;
  const saveMonthly = async (value) => { await saveMonthlyBudget(value); setBudgetEdit(false); };

  return (
    <>
      <Reveal style={{ ...card, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ color: "var(--muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Monthly budget</div>
          <div className="tnum" style={{ fontSize: 26, fontWeight: 680, marginTop: 6 }}>
            {budgetEdit ? <input autoFocus defaultValue={summary.budget} type="number"
              onBlur={(e) => saveMonthly(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveMonthly(e.target.value)}
              style={{ width: 150, background: "var(--surface-2)", border: "1px solid var(--accent)", borderRadius: 8, color: "var(--ink)", fontSize: 24, fontWeight: 680, padding: "3px 8px", outline: "none", fontFamily: "inherit" }} />
              : money(summary.budget)}
          </div>
          <div style={{ fontSize: 12.5, color: summary.remaining < 0 ? "var(--critical)" : "var(--good)", marginTop: 6 }}>
            {money(summary.remaining)} {summary.remaining < 0 ? "over" : "left"} · {money(summary.total)} spent</div>
        </div>
        {!budgetEdit && <button onClick={() => setBudgetEdit(true)} style={btn(false)}>Set budget</button>}
      </Reveal>

      <Reveal i={1} style={card}>
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
      </Reveal>
    </>
  );
}
