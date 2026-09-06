// Transactions — the full editable ledger with filters and the transfers
// summary. Honours a ?filter= query param so the Dashboard "Needs Review" tile
// can deep-link straight into the review queue.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { card, btn, selStyle, money } from "../lib.jsx";
import { useStore } from "../store.jsx";
import { Reveal } from "../motion.jsx";
import TxnTable from "../TxnTable.jsx";

export default function Transactions() {
  const { txns, summary, cats } = useStore();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState(params.get("filter") || "all");
  const [catFilter, setCatFilter] = useState(params.get("cat") || "all");

  useEffect(() => { const f = params.get("filter"); if (f && f !== filter) setFilter(f); }, [params]);
  useEffect(() => { const c = params.get("cat"); if (c && c !== catFilter) setCatFilter(c); }, [params]);

  const syncParams = (f, c) => {
    const p = {};
    if (f && f !== "all") p.filter = f;
    if (c && c !== "all") p.cat = c;
    setParams(p);
  };
  const setF = (f) => { setFilter(f); syncParams(f, catFilter); };
  const setC = (c) => { setCatFilter(c); syncParams(filter, c); };

  if (!summary) return <div style={{ color: "var(--muted)", padding: 40 }}>Loading transactions…</div>;

  const shown = txns.filter((t) => {
    const passFilter = filter === "uncat" ? (t.category === "Uncategorised" || !t.category)
      : filter === "transfers" ? t.txn_type === "transfer"
      : true;
    const passCat = catFilter === "all" || t.category === catFilter;
    return passFilter && passCat;
  });
  const shownTotal = shown.reduce((s, t) => s + (t.status === "declined" ? 0 : t.amount), 0);

  return (
    <Reveal style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontSize: 14, fontWeight: 620, margin: 0 }}>Transactions</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={catFilter} onChange={(e) => setC(e.target.value)} style={{ ...selStyle, fontWeight: 600 }}>
            <option value="all">All categories</option>
            {cats.filter((c) => c.kind === "expense").map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
          <button style={btn(filter === "all")} onClick={() => setF("all")}>All</button>
          <button style={btn(filter === "uncat")} onClick={() => setF("uncat")}>Needs review</button>
          <button style={btn(filter === "transfers")} onClick={() => setF("transfers")}>Transfers</button>
        </div>
      </div>
      <div style={{ color: "var(--muted)", fontSize: 12, margin: "2px 0 14px" }}>
        {shown.length} txns{catFilter !== "all" ? ` in ${catFilter}` : ""} · {money(shownTotal)} · pick a category → confirm, or add a note/tag</div>

      {filter === "transfers" && (() => {
        const sum = (name) => shown.filter((t) => t.category === name).reduce((s, t) => s + t.amount, 0);
        const untagged = shown.filter((t) => t.txn_type === "transfer" && t.category !== "Transfer (internal)" && t.category !== "Transfer (external)").reduce((s, t) => s + t.amount, 0);
        const box = (l, v, c) => (<div style={{ background: "var(--surface-2)", border: "1px solid var(--ring)", borderRadius: 10, padding: "10px 14px", flex: 1 }}>
          <div style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>{l}</div>
          <div className="tnum" style={{ fontSize: 17, fontWeight: 650, color: c, marginTop: 3 }}>{money(v)}</div></div>);
        return (<div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          {box("Internal", sum("Transfer (internal)"), "#5c7cfa")}{box("External", sum("Transfer (external)"), "var(--ink)")}{box("Untagged", untagged, "var(--warning)")}</div>);
      })()}

      <TxnTable rows={shown} />
    </Reveal>
  );
}
