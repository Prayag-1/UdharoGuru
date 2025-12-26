import { useBusinessGate } from "../../hooks/useBusinessGate";

export default function Rejected() {
  const { business_status, kyc, loading } = useBusinessGate("/business/rejected");

  const reason = kyc?.rejection_reason || "Your KYC was rejected. Please review and resubmit.";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        background:
          "radial-gradient(circle at 20% 20%, rgba(248,113,113,0.08), transparent 30%), radial-gradient(circle at 80% 0%, rgba(59,130,246,0.08), transparent 32%), linear-gradient(135deg, #fef2f2 0%, #fff7f7 100%)",
        fontFamily: "Inter, system-ui",
      }}
    >
      <div
        style={{
          width: "min(760px, 100%)",
          background: "#ffffff",
          borderRadius: 24,
          padding: 28,
          boxShadow: "0 20px 60px rgba(248,113,113,0.18)",
          border: "1px solid #fecdd3",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid #fecdd3",
              background: "#fff1f2",
              color: "#b91c1c",
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            KYC Rejected
          </span>
          <span style={{ color: "#b91c1c", fontWeight: 700 }}>{business_status || "REJECTED"}</span>
        </div>
        <h1 style={{ margin: "12px 0 8px", fontSize: 24, color: "#7f1d1d" }}>We couldn't approve your KYC</h1>
        <p style={{ margin: 0, color: "#991b1b", lineHeight: 1.6 }}>{loading ? "Loading details..." : reason}</p>
        <p style={{ margin: "10px 0 0", color: "#b91c1c", fontWeight: 700 }}>
          If your KYC remains rejected, your onboarding payment will be refunded.
        </p>
      </div>
    </div>
  );
}
