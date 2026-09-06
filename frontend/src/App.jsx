// Suite shell: a persistent sidebar (collapses to a top nav row on mobile), a
// top bar with the global month selector, and routed section pages. Adding a new
// section later = one entry in NAV + one <Route>.
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import { StoreProvider, useStore } from "./store.jsx";
import { useIsMobile } from "./lib.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Transactions from "./pages/Transactions.jsx";
import Budgets from "./pages/Budgets.jsx";
import Insights from "./pages/Insights.jsx";

const NAV = [
  { to: "/", label: "Dashboard", icon: "◉", end: true },
  { to: "/transactions", label: "Transactions", icon: "≣" },
  { to: "/budgets", label: "Budgets", icon: "◧" },
  { to: "/insights", label: "Insights", icon: "◔" },
];

function NavItem({ item, mobile }) {
  return (
    <NavLink to={item.to} end={item.end}
      style={({ isActive }) => ({
        display: "flex", alignItems: "center", gap: 11,
        padding: mobile ? "8px 12px" : "10px 13px",
        borderRadius: 10, fontSize: 14, fontWeight: 550, whiteSpace: "nowrap",
        textDecoration: "none",
        color: isActive ? "var(--ink)" : "var(--ink-2)",
        background: isActive ? "var(--surface-2)" : "transparent",
        border: isActive ? "1px solid var(--ring)" : "1px solid transparent",
      })}>
      <span style={{ fontSize: 16, color: "var(--accent)", width: 18, textAlign: "center" }}>{item.icon}</span>
      {item.label}
    </NavLink>
  );
}

function Sidebar() {
  return (
    <aside style={{ width: 224, flexShrink: 0, borderRight: "1px solid var(--ring)", padding: "22px 16px", display: "flex", flexDirection: "column", gap: 6, height: "100vh", position: "sticky", top: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 17, fontWeight: 680, padding: "0 8px 18px" }}>
        <span style={{ color: "var(--accent)", fontSize: 20 }}>◉</span> Finance
      </div>
      {NAV.map((item) => <NavItem key={item.to} item={item} />)}
      <div style={{ marginTop: "auto", padding: "0 8px", fontSize: 11, color: "var(--muted)" }}>Live from Postgres</div>
    </aside>
  );
}

function TopBar() {
  const { months, month, setMonth } = useStore();
  const { pathname } = useLocation();
  // Insights uses per-card date ranges, so the global month picker is redundant.
  if (pathname.startsWith("/insights")) return null;
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 20, gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface)", border: "1px solid var(--ring)", borderRadius: 10, padding: "9px 14px" }}>
        <span style={{ color: "var(--muted)", fontSize: 12 }}>Month</span>
        <select value={month} onChange={(e) => setMonth(e.target.value)} style={{ background: "transparent", color: "var(--ink)", border: "none", fontSize: 14, fontWeight: 600, outline: "none", cursor: "pointer" }}>
          {months.map((m) => <option key={m.key} value={m.key} style={{ background: "var(--surface)" }}>{m.label}</option>)}
        </select>
      </div>
    </div>
  );
}

function Shell() {
  const isMobile = useIsMobile(860);
  const routes = (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/transactions" element={<Transactions />} />
      <Route path="/budgets" element={<Budgets />} />
      <Route path="/insights" element={<Insights />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--plane)", borderBottom: "1px solid var(--ring)", padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 17, fontWeight: 680, marginBottom: 10 }}>
            <span style={{ color: "var(--accent)", fontSize: 20 }}>◉</span> Finance
          </div>
          <nav style={{ display: "flex", gap: 8, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            {NAV.map((item) => <NavItem key={item.to} item={item} mobile />)}
          </nav>
        </div>
        <main style={{ padding: 14, maxWidth: 1200, margin: "0 auto", overflowX: "hidden" }}>
          <TopBar />
          {routes}
        </main>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, padding: "28px 32px", maxWidth: 1280, overflowX: "hidden" }}>
        <TopBar />
        {routes}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </BrowserRouter>
  );
}
