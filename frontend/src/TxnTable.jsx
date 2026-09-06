// Editable transaction table shared by the Transactions section and the
// Insights category drill-down. Owns its own inline-edit state; reads data and
// mutations from the store.
import { useState } from "react";
import { cell, selStyle, okBtn, noBtn, pencil, th, money } from "./lib.jsx";
import { useStore } from "./store.jsx";

export default function TxnTable({ rows }) {
  const { cats, colorOf, setTxnCategory, setTxnNote } = useStore();
  const [editCat, setEditCat] = useState(null);
  const [pending, setPending] = useState("");
  const [editNote, setEditNote] = useState(null);

  const confirmCat = async (id, learn) => {
    await setTxnCategory(id, pending, learn);
    setEditCat(null); setPending("");
  };
  const saveNote = async (id, note) => {
    await setTxnNote(id, note);
    setEditNote(null);
  };

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

  return (
    <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
      <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse" }}>
        <thead><tr>{["Date", "Merchant", "Category", "Note", "Amount"].map((h, i) => th(h, i === 4))}</tr></thead>
        <tbody>{rows.map(renderRow)}</tbody>
      </table>
    </div>
  );
}
