import { Link } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useBusinessGate } from "../../hooks/useBusinessGate";

export default function PendingVerification() {
  const { user } = useAuth();
  useBusinessGate("/business/pending");

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        background:
          "radial-gradient(circle at 20% 20%, rgba(99,141,255,0.08), transparent 30%), radial-gradient(circle at 80% 0%, rgba(15,115,206,0.08), transparent 32%), linear-gradient(135deg, #f5f7ff 0%, #eef3ff 50%, #f8fbff 100%)",
        fontFamily: "Inter, system-ui",
      }}
    >
      <div
        style={{
          width: "min(760px, 100%)",
          background: "#ffffff",
          borderRadius: 24,
          padding: 28,
          boxShadow: "0 20px 60px rgba(26,55,117,0.18)",
          border: "1px solid #e5e7eb",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#eef4ff", color: "#0f172a", fontWeight: 800, fontSize: 12 }}>
            Verification Pending
          </span>
          <span style={{ color: "#0f172a", fontWeight: 700 }}>{user?.full_name || "Business user"}</span>
        </div>
        <h1 style={{ margin: "12px 0 6px", fontSize: 26, color: "#0f1f40" }}>Your payment & KYC are under review</h1>
        <p style={{ margin: 0, color: "#4b5b77", lineHeight: 1.6 }}>
          Approval usually takes 24 hours. You can continue exploring the dashboard while our team completes the review.
        </p>

        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <Link
            to="/business/dashboard"
            style={{ padding: "12px 14px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #0f73ce 0%, #0c5aad 100%)", color: "#fff", fontWeight: 900, textDecoration: "none", boxShadow: "0 12px 24px rgba(15,115,206,0.25)" }}
          >
            Go to Dashboard
          </Link>
          <Link
            to="/business/kyc"
            style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f172a", fontWeight: 800, textDecoration: "none" }}
          >
            Review KYC Details
          </Link>
        </div>
      </div>
    </div>
  );
}
