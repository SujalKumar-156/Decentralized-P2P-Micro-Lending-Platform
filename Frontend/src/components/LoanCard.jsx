// src/components/LoanCard.jsx
import { ethers } from "ethers";

export default function LoanCard({ loan, onFund, isConnected, funding }) {
  const isFunding = funding === loan.loanId;

  const amountEth = loan.amount
    ? parseFloat(ethers.formatEther(loan.amount)).toFixed(4)
    : "—";

  const durationDays = loan.duration
    ? Math.round(loan.duration / 86400)
    : "—";

  const shortAddress = loan.borrower
    ? `${loan.borrower.slice(0, 6)}...${loan.borrower.slice(-4)}`
    : "—";

  // Calculate what lender gets back: amount + interest
  const returnAmountEth = loan.amount
    ? parseFloat(ethers.formatEther(
        (BigInt(loan.amount) * BigInt(100 + loan.interestRate)) / BigInt(100)
      )).toFixed(4)
    : "—";

  const canFund = isConnected && !isFunding && loan.status === "OPEN";

  return (
    <div
      style={{
        background: "#1e293b", border: "1px solid #334155",
        borderRadius: 16, padding: 20,
        display: "flex", flexDirection: "column", gap: 14,
        transition: "border-color 0.2s",
      }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = "#6366f1"}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = "#334155"}
    >
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>
          Loan #{loan.loanId}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
          background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)",
          color: "#10b981",
        }}>
          {loan.status}
        </span>
      </div>

      {/* ── Amount ── */}
      <div style={{
        background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: 12, padding: "14px 16px", textAlign: "center",
      }}>
        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Loan Amount</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9" }}>
          {amountEth}
          <span style={{ fontSize: 14, color: "#818cf8", marginLeft: 6 }}>ETH</span>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ background: "#0f172a", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Interest</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f59e0b" }}>
            {loan.interestRate}%
          </div>
        </div>
        <div style={{ background: "#0f172a", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Duration</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>
            {durationDays}
            <span style={{ fontSize: 12, color: "#64748b", marginLeft: 4 }}>days</span>
          </div>
        </div>
      </div>

      {/* ── You receive ── */}
      <div style={{
        background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)",
        borderRadius: 10, padding: "10px 14px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 12, color: "#64748b" }}>You receive back</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#10b981" }}>
          {returnAmountEth} ETH
        </span>
      </div>

      {/* ── Borrower ── */}
      <div style={{
        paddingTop: 10, borderTop: "1px solid #0f172a",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>Borrower</div>
          <div style={{ fontSize: 12, fontFamily: "monospace", color: "#94a3b8" }}>
            {shortAddress}
          </div>
        </div>
      </div>

      {/* ── Fund button ── */}
      <button
        type="button"
        onClick={() => onFund(loan)}
        disabled={!canFund}
        style={{
          width: "100%", padding: "12px", borderRadius: 12,
          fontSize: 14, fontWeight: 600, border: "none",
          cursor: canFund ? "pointer" : "not-allowed",
          background: canFund
            ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
            : "#1e293b",
          color: canFund ? "#fff" : "#475569",
          opacity: isFunding ? 0.8 : 1,
          transition: "opacity 0.2s",
        }}
      >
        {isFunding
          ? "⏳ Confirm in MetaMask..."
          : !isConnected
          ? "Connect wallet to fund"
          : `⚡ Fund ${amountEth} ETH`}
      </button>
    </div>
  );
}
