// src/pages/LenderMarketplace.jsx
import { useState } from "react";
import { useWallet } from "../hooks/useWallet.js";
import { useLoans }  from "../hooks/useLoans.js";
import LoanCard      from "../components/LoanCard.jsx";
import WalletButton  from "../components/WalletButton.jsx";

export default function LenderMarketplace() {
  const {
    contract, address, isConnected, isWrongNetwork,
    loading: walletLoading, error: walletError,
    connectWallet, disconnectWallet,
  } = useWallet();

  const { loans, loading: loansLoading, error: loansError, refetch } = useLoans();

  const [funding,   setFunding]   = useState(null);
  const [txResult,  setTxResult]  = useState(null);
  const [fundError, setFundError] = useState(null);

  // ── Fund a loan ─────────────────────────────────────────────────────────────
  async function fundLoan(loan) {
    if (!contract) return;
    setFundError(null);
    setTxResult(null);
    setFunding(loan.loanId);

    try {
      // fundLoan(uint256 _loanId) payable — sends exact ETH to the contract
      const tx = await contract.fundLoan(Number(loan.loanId), {
        value: loan.amount,   // already in wei as a string — Ethers v6 accepts it
      });

      // Wait for block confirmation (~15 seconds on Sepolia)
      const receipt = await tx.wait();
      setTxResult({ loanId: loan.loanId, txHash: receipt.hash });

      // Refresh after 3s to give blockchain time to update
      setTimeout(refetch, 3000);

    } catch (err) {
      if (err.code === 4001) {
        setFundError("You rejected the transaction in MetaMask.");
      } else if (err.code === "INSUFFICIENT_FUNDS") {
        setFundError("Insufficient ETH in your wallet for this loan.");
      } else {
        setFundError(err.reason ?? err.message ?? "Transaction failed.");
      }
    } finally {
      setFunding(null);
    }
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0f172a", color: "#f1f5f9" }}>

      {/* ── Navbar ── */}
      <nav style={{
        borderBottom: "1px solid #1e293b", padding: "16px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, backgroundColor: "#0f172a", zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          }}>💸</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>P2P Micro Lending</div>
            <div style={{ fontSize: 11, color: "#64748b" }}>Lender Marketplace · Sepolia</div>
          </div>
        </div>
        <WalletButton
          address={address}
          isConnected={isConnected}
          isWrongNetwork={isWrongNetwork}
          loading={walletLoading}
          error={walletError}
          onConnect={connectWallet}
          onDisconnect={disconnectWallet}
        />
      </nav>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>

        {/* ── Page header ── */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            display: "inline-block",
            background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: 20, padding: "4px 14px", fontSize: 12, color: "#818cf8", marginBottom: 14,
          }}>
            🔗 Live on Ethereum Sepolia Testnet
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 10, lineHeight: 1.2 }}>
            Open Loan Requests
          </h1>
          <p style={{ color: "#94a3b8", fontSize: 15, maxWidth: 560, lineHeight: 1.6 }}>
            Browse loan requests from borrowers. Fund a loan and receive your ETH
            back with interest when the borrower repays — enforced by the smart contract.
          </p>
        </div>

        {/* ── Stats bar ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 32 }}>
          {[
            { label: "Open Loans",  value: loansLoading ? "..." : loans.length, icon: "📋" },
            { label: "Network",     value: "Sepolia",                           icon: "🌐" },
            { label: "Your Wallet", value: address ? `${address.slice(0,6)}...${address.slice(-4)}` : "Not connected", icon: "👛" },
          ].map((s) => (
            <div key={s.label} style={{
              background: "#1e293b", border: "1px solid #334155",
              borderRadius: 12, padding: "18px 20px",
            }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Connect wallet banner ── */}
        {!isConnected && (
          <div style={{
            marginBottom: 32, padding: "24px 28px", borderRadius: 14,
            background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.25)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 16,
          }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Connect your wallet to fund loans</div>
              <div style={{ color: "#64748b", fontSize: 14 }}>
                You need MetaMask on Sepolia testnet to send transactions.
              </div>
            </div>
            <button type="button" onClick={connectWallet} disabled={walletLoading} style={{
              padding: "10px 22px", borderRadius: 10, fontSize: 14, fontWeight: 600,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "#fff", border: "none",
              cursor: walletLoading ? "not-allowed" : "pointer",
            }}>
              🦊 Connect MetaMask
            </button>
          </div>
        )}

        {/* ── Success banner ── */}
        {txResult && (
          <div style={{
            marginBottom: 20, padding: "16px 20px", borderRadius: 12,
            background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)",
          }}>
            <div style={{ color: "#6ee7b7", fontWeight: 600, marginBottom: 4 }}>
              ✅ Loan #{txResult.loanId} funded successfully!
            </div>
            <div style={{ color: "#94a3b8", fontSize: 13 }}>
              ETH is now locked in the smart contract.{" "}
              <a href={`https://sepolia.etherscan.io/tx/${txResult.txHash}`}
                target="_blank" rel="noopener noreferrer"
                style={{ color: "#818cf8" }}>
                View on Etherscan →
              </a>
            </div>
          </div>
        )}

        {/* ── Fund error ── */}
        {fundError && (
          <div style={{
            marginBottom: 20, padding: "14px 18px", borderRadius: 10,
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
            color: "#fca5a5", fontSize: 14,
          }}>
            ❌ {fundError}
          </div>
        )}

        {/* ── Loans grid ── */}
        {loansLoading ? (
          <>
            <div style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>
              Loading loans from blockchain...
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{
                  height: 280, borderRadius: 16, background: "#1e293b",
                  animation: "pulse 1.5s ease-in-out infinite",
                }} />
              ))}
            </div>
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
          </>
        ) : loansError ? (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            background: "#1e293b", borderRadius: 16, border: "1px solid #334155",
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
            <div style={{ color: "#94a3b8", marginBottom: 8 }}>
              Could not load loans from blockchain.
            </div>
            <div style={{ color: "#475569", fontSize: 13, marginBottom: 20 }}>
              {loansError}
            </div>
            <button type="button" onClick={refetch} style={{
              padding: "10px 24px", borderRadius: 10, background: "#334155",
              color: "#94a3b8", border: "1px solid #475569", cursor: "pointer", fontSize: 14,
            }}>
              Retry
            </button>
          </div>
        ) : loans.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            background: "#1e293b", borderRadius: 16, border: "1px dashed #334155",
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📭</div>
            <div style={{ color: "#94a3b8", fontSize: 16, marginBottom: 8 }}>
              No open loan requests yet.
            </div>
            <div style={{ color: "#475569", fontSize: 13 }}>
              Borrowers need to call createLoan() first.
            </div>
          </div>
        ) : (
          <>
            <div style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>
              {loans.length} open loan{loans.length !== 1 && "s"} — live from Sepolia blockchain
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
              gap: 16,
            }}>
              {loans.map((loan) => (
                <LoanCard
                  key={loan.loanId}
                  loan={loan}
                  onFund={fundLoan}
                  isConnected={isConnected}
                  funding={funding}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
