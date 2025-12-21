import { Link } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

export default function PendingVerification() {
  const { user } = useAuth();

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0b", color: "#fff", padding: 28, fontFamily: "Inter, system-ui" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", background: "#111", border: "1px solid #222", borderRadius: 16, padding: 22 }}>
        <h2 style={{ margin: 0, fontWeight: 900 }}>Verification Pending</h2>
        <p style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
          {user?.full_name}, your business account is awaiting admin approval. Once approved, OCR and advanced analytics unlock automatically.
        </p>

        <p style={{ color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
          If you recently submitted KYC documents, you can continue to track customers and transactions while you wait.
        </p>

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <Link
            to="/business/dashboard"
            style={{ padding: "12px 14px", borderRadius: 12, border: "none", background: "#fff", color: "#000", fontWeight: 900, textDecoration: "none" }}
          >
            View Dashboard
          </Link>
          <Link
            to="/business/kyc"
            style={{ padding: "12px 14px", borderRadius: 12, background: "#1b1b1b", border: "1px solid #2a2a2a", color: "#fff", fontWeight: 900, textDecoration: "none" }}
          >
            Review KYC Details
          </Link>
        </div>
      </div>
    </div>
  );
}
