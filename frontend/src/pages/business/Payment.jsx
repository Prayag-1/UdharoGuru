import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import qrImage from "../../assets/QR code.png";
import { submitBusinessPayment } from "../../api/business";
import { resolveHomeRoute, useAuth } from "../../context/AuthContext";
import { useBusinessGate } from "../../hooks/useBusinessGate";

const badge = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(37,99,235,0.18)",
  background: "#eef4ff",
  color: "#0f172a",
  fontWeight: 800,
  fontSize: 12,
};

export default function Payment() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { loading } = useBusinessGate("/business/payment");
  const [transactionCode, setTransactionCode] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!user) return;
    if (user.account_type !== "BUSINESS") {
      navigate(resolveHomeRoute(user), { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const isValid = useMemo(() => !!transactionCode && !!file, [transactionCode, file]);

  const extractMessage = (err) => {
    const data = err?.response?.data;
    return (
      data?.detail ||
      data?.message ||
      data?.non_field_errors?.[0] ||
      data?.error ||
      data?.transaction_code ||
      data?.screenshot?.[0] ||
      "Unable to submit payment."
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;
    if (loading) return;
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("transaction_code", transactionCode);
      form.append("screenshot", file);
      await submitBusinessPayment(form);
      await refreshUser();
      setSuccess("Payment submitted. Proceeding to KYC...");
      setTimeout(() => navigate("/business/kyc", { replace: true }), 600);
    } catch (err) {
      setError(extractMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

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
          width: "min(1100px, 100%)",
          background: "#ffffff",
          borderRadius: 28,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1.05fr 1fr",
          boxShadow: "0 20px 60px rgba(26,55,117,0.18)",
        }}
      >
        <div
          style={{
            padding: "48px 48px 56px",
            background: "linear-gradient(135deg, #dce9ff 0%, #e7f0ff 45%, #d7eaff 100%)",
            position: "relative",
            color: "#0b2348",
          }}
        >
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 24px 24px, rgba(255,255,255,0.4), transparent 42px)", opacity: 0.5 }} />
          <div style={{ position: "relative", display: "grid", gap: 14 }}>
            <span style={badge}>Business Onboarding</span>
            <h1 style={{ margin: "0 0 6px", fontSize: 32, lineHeight: 1.15 }}>
              Scan QR and Pay
            </h1>
            <p style={{ margin: 0, color: "#203a61", fontSize: 16, lineHeight: 1.6, maxWidth: 520 }}>
              Complete the one-time onboarding fee to unlock Business dashboard access. Keep the payment screenshot handy; you need it to proceed to KYC.
            </p>

            <div
              style={{
                marginTop: 10,
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                alignItems: "center",
                gap: 16,
                background: "#fff",
                borderRadius: 16,
                padding: 16,
                border: "1px solid rgba(37,99,235,0.2)",
              }}
            >
              <div>
                <div style={{ fontWeight: 900, color: "#0f172a" }}>Amount: Rs. 18,000</div>
                <div style={{ color: "#334155", fontWeight: 600 }}>One-time business onboarding fee</div>
                <div style={{ marginTop: 8, color: "#0f172a", fontWeight: 700 }}>Scan this QR code to pay via mobile banking.</div>
                <div style={{ marginTop: 4, color: "#475569", fontSize: 13 }}>
                  If your KYC is not approved, your money will be refunded.
                </div>
              </div>
              <img
                src={qrImage}
                alt="QR code for business onboarding payment"
                style={{ width: 240, height: 240, objectFit: "cover", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 12px 30px rgba(15,23,42,0.18)" }}
              />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "40px 34px", display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 900, fontSize: 22, color: "#0f1f40" }}>Payment details</div>
            <div style={{ color: "#4b5b77" }}>Enter your transaction code and upload the payment screenshot.</div>
          </div>

          <label style={{ display: "grid", gap: 8, fontWeight: 700, color: "#1d2d4a" }}>
            <span>Transaction code *</span>
            <input
              type="text"
              value={transactionCode}
              onChange={(e) => setTransactionCode(e.target.value)}
              placeholder="e.g., TXN123456"
              style={{
                border: "1px solid #d7def0",
                borderRadius: 12,
                padding: "14px 16px",
                fontSize: 15,
                background: "#f9fbff",
              }}
              required
            />
          </label>

          <label
            style={{
              border: "2px dashed #cbd5e1",
              borderRadius: 14,
              background: "#f8fbff",
              padding: "18px 16px",
              textAlign: "center",
              color: "#475569",
              cursor: "pointer",
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 800, color: "#0f172a" }}>Upload Payment Screenshot *</div>
            <div style={{ fontSize: 13 }}>
              {file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : "PNG, JPG, JPEG - Max 5MB"}
            </div>
            {previewUrl ? (
              <div
                style={{
                  margin: "0 auto",
                  width: 180,
                  height: 180,
                  borderRadius: 14,
                  overflow: "hidden",
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  boxShadow: "0 10px 24px rgba(15,23,42,0.12)",
                }}
              >
                <img src={previewUrl} alt="Payment preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#64748b" }}>Click to upload your payment screenshot.</div>
            )}
            <input type="file" accept="image/png,image/jpg,image/jpeg" style={{ display: "none" }} onChange={handleFile} />
          </label>

          {error && (
            <div style={{ padding: 12, borderRadius: 12, border: "1px solid #fecdd3", background: "#fff1f2", color: "#b91c1c", fontWeight: 700 }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ padding: 12, borderRadius: 12, border: "1px solid #bbf7d0", background: "#ecfdf3", color: "#15803d", fontWeight: 700 }}>
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={!isValid || submitting}
            style={{
              border: "none",
              background: isValid ? "linear-gradient(135deg, #0f73ce 0%, #0c5aad 100%)" : "#94a3b8",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: 16,
              padding: "14px 16px",
              borderRadius: 14,
              cursor: isValid && !submitting ? "pointer" : "not-allowed",
              boxShadow: isValid ? "0 12px 24px rgba(15,115,206,0.28)" : "none",
              transition: "transform 0.12s ease, box-shadow 0.12s ease",
            }}
          >
            {submitting ? "Submitting..." : "Proceed to KYC"}
          </button>
        </form>
      </div>
    </div>
  );
}
