import { useNavigate } from "react-router-dom";

export default function PendingVerification() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0b", color: "#fff", padding: 28, fontFamily: "Inter, system-ui" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", background: "#111", border: "1px solid #222", borderRadius: 16, padding: 22 }}>
        <h2 style={{ margin: 0, fontWeight: 900 }}>KYC Submitted</h2>
        <p style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
          Your business verification is pending admin approval. For the demo, you can simulate approval by clicking below.
        </p>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => {
              localStorage.setItem("kyc_status", "verified");
              navigate("/business/dashboard");
            }}
            style={{ padding: "12px 14px", borderRadius: 12, border: "none", background: "#fff", color: "#000", fontWeight: 900, cursor: "pointer" }}
          >
            Simulate Admin Approval
          </button>

          <button
            onClick={() => navigate("/auth")}
            style={{ padding: "12px 14px", borderRadius: 12, background: "#1b1b1b", border: "1px solid #2a2a2a", color: "#fff", fontWeight: 900, cursor: "pointer" }}
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
