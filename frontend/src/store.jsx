// Central data store for the suite. Loads shared data once and exposes it (plus
// the mutation actions) to every section via context, so navigating between
// Dashboard / Transactions / Budgets / Insights doesn't re-fetch or drift.
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./lib.jsx";

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }) {
  const [months, setMonths] = useState([]);
  const [month, setMonth] = useState("");
  const [summary, setSummary] = useState(null);
  const [txns, setTxns] = useState([]);
  const [cats, setCats] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [trend, setTrend] = useState([]);

  const colorOf = useMemo(() => Object.fromEntries(cats.map((c) => [c.name, c.color])), [cats]);
  const monthsAsc = useMemo(() => [...months].reverse(), [months]);

  useEffect(() => { api("/api/categories").then(setCats); }, []);
  useEffect(() => { api("/api/trend").then(setTrend); }, []);
  useEffect(() => { api("/api/months").then((ms) => { setMonths(ms); if (ms.length) setMonth(ms[0].key); }); }, []);

  const load = (m) => {
    api(`/api/summary?month=${m}`).then(setSummary);
    api(`/api/transactions?month=${m}`).then(setTxns);
    api(`/api/budgets?month=${m}`).then(setBudgets);
  };
  useEffect(() => { if (month) load(month); }, [month]);

  const refresh = () => { if (month) load(month); };

  // ── mutations ──────────────────────────────────────────────────────────────
  const setTxnCategory = async (id, category, learn) => {
    await api(`/api/transactions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, learn }) });
    refresh();
  };
  const setTxnNote = async (id, note) => {
    await api(`/api/transactions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) });
    refresh();
  };
  const saveLimit = async (category, limit) => {
    await api(`/api/budgets`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, limit: Number(limit) }) });
    api(`/api/budgets?month=${month}`).then(setBudgets);
  };
  const saveMonthlyBudget = async (value) => {
    await api(`/api/settings/monthly-budget`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value }) });
    load(month);
  };

  const value = {
    months, monthsAsc, month, setMonth, summary, txns, cats, budgets, trend,
    colorOf, refresh, setTxnCategory, setTxnNote, saveLimit, saveMonthlyBudget,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
