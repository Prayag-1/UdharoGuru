import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import qrImage from "../../assets/QR code.png";
import { resolveHomeRoute, useAuth } from "../../context/AuthContext";

const badgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(37,99,235,0.1)",
  color: "#0f172a",
  fontWeight: 800,
  fontSize: 12,
  border: "1px solid rgba(37,99,235,0.2)",
};

const cardSection = {
  background: "#ffffff",
  borderRadius: 18,
  border: "1px solid #e2e8f0",
  boxShadow: "0 14px 36px rgba(37,99,235,0.14)",
};

const buttonRowStyle = {
  display: "flex",
  gap: 12,
  justifyContent: "flex-end",
  alignItems: "center",
  flexWrap: "wrap",
};

const backButtonStyle = {
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid rgba(37,99,235,0.24)",
  background: "linear-gradient(135deg, #f5f8ff 0%, #eef4ff 100%)",
  color: "#0f172a",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(15,23,42,0.08)",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const primaryButtonBase = {
  padding: "13px 18px",
  borderRadius: 12,
  border: "none",
  color: "#ffffff",
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  letterSpacing: 0.1,
};

export default function BusinessPayment() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [upload, setUpload] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    if (!user) return;
    if (user.account_type !== "BUSINESS") {
      navigate(resolveHomeRoute(user), { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!upload) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(upload);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [upload]);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUpload(file);
    }
  };

  const proceed = () => {
    if (!upload) return;
    navigate("/business/kyc");
  };

  const hintText = useMemo(
    () => (upload ? `${upload.name} (${Math.round(upload.size / 1024)} KB)` : "PNG, JPG, JPEG - Max 5MB"),
    [upload]
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "32px 18px",
        background:
          "radial-gradient(circle at 18% 20%, rgba(59,130,246,0.15), transparent 28%), radial-gradient(circle at 82% 8%, rgba(14,165,233,0.12), transparent 32%), linear-gradient(135deg, #eef3ff 0%, #f5f8ff 40%, #ebf2ff 100%)",
        fontFamily: "Inter, system-ui",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1080,
          display: "grid",
          gap: 18,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          ...cardSection,
          padding: 22,
        }}
      >
        <div
          style={{
            borderRadius: 14,
            background: "linear-gradient(135deg, #e1edff 0%, #e8f1ff 60%, #d8e7ff 100%)",
            padding: 20,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 22% 18%, rgba(255,255,255,0.5), transparent 30%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={badgeStyle}>Business</span>
              <span style={badgeStyle}>One-time Onboarding</span>
            </div>
            <h1 style={{ margin: "4px 0", fontSize: 26, color: "#0f172a", lineHeight: 1.25 }}>
              Scan QR and Pay
            </h1>
            <p style={{ margin: 0, color: "#1f2a44", lineHeight: 1.6 }}>
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
                borderRadius: 14,
                padding: 14,
                border: "1px solid rgba(37,99,235,0.2)",
              }}
            >
              <div>
                <div style={{ fontWeight: 900, color: "#0f172a" }}>Amount: Rs. 18,000</div>
                <div style={{ color: "#334155", fontWeight: 600 }}>One-time business onboarding fee</div>
                <div style={{ marginTop: 8, color: "#0f172a", fontWeight: 700 }}>Scan this QR code to pay via mobile banking.</div>
                <div style={{ marginTop: 4, color: "#475569", fontSize: 13 }}>
                  If your KYC is not approved, the payment amount will be refunded.
                </div>
              </div>
              <img
                src={qrImage}
                alt="QR code for business onboarding payment"
                style={{ width: 300, height: 300, objectFit: "cover", borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 12px 30px rgba(15,23,42,0.18)" }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16, padding: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ ...badgeStyle, background: "#eef4ff", borderColor: "rgba(37,99,235,0.18)" }}>Payment Proof</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", margin: 0 }}>Upload payment screenshot</div>
            <div style={{ color: "#475569", lineHeight: 1.6 }}>
              Upload the screenshot for verification. Only image files are needed for now; no automatic payment checks will be performed.
            </div>
          </div>

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
            <div style={{ fontWeight: 800, color: "#0f172a" }}>Upload Payment Screenshot</div>
            <div style={{ fontSize: 13 }}>{hintText}</div>
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
                <img src={previewUrl} alt="Uploaded payment preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#64748b" }}>PNG, JPG, JPEG - Max 5MB (UI check only).</div>
            )}
            <input type="file" accept="image/png,image/jpg,image/jpeg" style={{ display: "none" }} onChange={handleFile} />
          </label>

          <div style={buttonRowStyle}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={backButtonStyle}
            >
              Back
            </button>
            <button
              type="button"
              onClick={proceed}
              disabled={!upload}
              style={{
                ...primaryButtonBase,
                background: !upload ? "#94a3b8" : "linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%)",
                cursor: upload ? "pointer" : "not-allowed",
                boxShadow: upload ? "0 14px 32px rgba(37,99,235,0.36)" : "none",
                opacity: upload ? 1 : 0.78,
                transform: upload ? "translateY(0)" : "none",
                transition: "transform 0.12s ease, box-shadow 0.12s ease",
              }}
            >
              Proceed to KYC
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

