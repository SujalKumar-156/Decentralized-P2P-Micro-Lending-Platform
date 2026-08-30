// src/components/WalletButton.jsx
export default function WalletButton({
  address, isConnected, isWrongNetwork, loading, error, onConnect, onDisconnect,
}) {
  const truncate = (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  if (isConnected && isWrongNetwork) {
    return (
      <button type="button" onClick={onConnect} style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "9px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
        background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)",
        color: "#fca5a5", cursor: "pointer",
      }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444", display: "inline-block" }} />
        Wrong Network — Switch to Sepolia
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
          borderRadius: 10, background: "rgba(16,185,129,0.1)",
          border: "1px solid rgba(16,185,129,0.3)", color: "#10b981", fontSize: 13,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
          {truncate(address)}
        </div>
        <button type="button" onClick={onDisconnect} style={{
          padding: "8px 14px", borderRadius: 10, fontSize: 13,
          background: "transparent", border: "1px solid #334155",
          color: "#64748b", cursor: "pointer",
        }}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <button type="button" onClick={onConnect} disabled={loading} style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 22px", borderRadius: 10, fontSize: 14, fontWeight: 600,
        background: loading ? "#334155" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
        color: "#fff", border: "none",
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.7 : 1,
      }}>
        {loading ? "Connecting..." : "🦊 Connect MetaMask"}
      </button>
      {error && (
        <div style={{ fontSize: 12, color: "#fca5a5", maxWidth: 260, textAlign: "right", lineHeight: 1.5 }}>
          ⚠️ {error}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
