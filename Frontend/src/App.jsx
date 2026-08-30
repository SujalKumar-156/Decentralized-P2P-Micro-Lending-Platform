import { BrowserRouter, Routes, Route } from "react-router-dom";
import LenderMarketplace from "./pages/LenderMarketplace.jsx";

// ── Placeholder pages for Role 5 and Role 7 ───────────────────────────────────
// Replace these imports with the real pages once teammates finish them:
//   import BorrowerDashboard from "./pages/BorrowerDashboard.jsx";
//   import Analytics from "./pages/Analytics.jsx";

function BorrowerDashboard() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏦</div>
        <p style={{ color: "#94a3b8", fontSize: 18, marginBottom: 8 }}>Borrower Dashboard</p>
        <p style={{ color: "#475569", fontSize: 14 }}>Role 5 — coming soon</p>
      </div>
    </div>
  );
}

function Analytics() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <p style={{ color: "#94a3b8", fontSize: 18, marginBottom: 8 }}>Analytics & Portfolio</p>
        <p style={{ color: "#475569", fontSize: 14 }}>Role 7 — coming soon</p>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#475569", fontSize: 16 }}>404 — Page not found</p>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<BorrowerDashboard />} />
        <Route path="/borrow"    element={<BorrowerDashboard />} />
        <Route path="/lend"      element={<LenderMarketplace />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="*"          element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
