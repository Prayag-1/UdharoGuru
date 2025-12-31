import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { submitBusinessKyc } from "../../api/business";
import { resolveHomeRoute, useAuth } from "../../context/AuthContext";
import { useBusinessGate } from "../../hooks/useBusinessGate";

const inputStyle = {
  border: "1px solid #d7def0",
  borderRadius: 12,
  padding: "13px 14px",
  fontSize: 15,
  fontFamily: "Inter, system-ui",
  background: "#f9fbff",
};

const labelStyle = {
  display: "grid",
  gap: 6,
  fontWeight: 700,
  color: "#1d2d4a",
};

const gridTwo = { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" };

export default function KycForm() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { loading } = useBusinessGate("/business/kyc");
  const [form, setForm] = useState({
    first_name: user?.full_name?.split(" ")?.[0] || "",
    last_name: user?.full_name?.split(" ")?.slice(1).join(" ") || "",
    gender: "",
    dob: "",
    country: "",
    city: "",
    phone: "",
    address: "",
    business_name: "",
    registration_pan: "",
    industry: "",
    website: "",
    identity_type: "",
    identity_number: "",
    identity_document: null,
    payment_transaction_code: "",
    payment_screenshot: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewId, setPreviewId] = useState("");
  const [previewPay, setPreviewPay] = useState("");

  useEffect(() => {
    if (!user) return;
    if (user.account_type !== "BUSINESS") {
      navigate(resolveHomeRoute(user), { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!form.identity_document) {
      setPreviewId("");
    } else {
      const url = URL.createObjectURL(form.identity_document);
      setPreviewId(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [form.identity_document]);

  useEffect(() => {
    if (!form.payment_screenshot) {
      setPreviewPay("");
    } else {
      const url = URL.createObjectURL(form.payment_screenshot);
      setPreviewPay(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [form.payment_screenshot]);

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleFile = (key) => (e) => {
    const file = e.target.files?.[0];
    if (file) handleChange(key, file);
  };

  const isValid = useMemo(() => {
    return (
      form.first_name &&
      form.last_name &&
      form.gender &&
      form.dob &&
      form.country &&
      form.city &&
      form.phone &&
      form.address &&
      form.business_name &&
      form.registration_pan &&
      form.industry &&
      form.identity_type &&
      form.identity_number &&
      form.identity_document
    );
  }, [form]);

  const extractMessage = (err) => {
    const data = err?.response?.data;
    return (
      data?.detail ||
      data?.message ||
      data?.non_field_errors?.[0] ||
      data?.error ||
      Object.values(data || {})?.[0]?.[0] ||
      "Unable to submit KYC."
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid || loading || submitting) return;
    setError("");
    setConfirmOpen(true);
  };

  const submitKyc = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setConfirmOpen(false);
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value) payload.append(key, value);
      });
      await submitBusinessKyc(payload);
      await refreshUser();
      navigate("/business/pending", { replace: true });
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
          boxShadow: "0 20px 60px rgba(26,55,117,0.18)",
        }}
      >
        <div style={{ padding: "42px 40px 14px", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#eef4ff", color: "#0f172a", fontWeight: 800, fontSize: 12 }}>Business</span>
            <span style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f172a", fontWeight: 800, fontSize: 12 }}>Secure Verification</span>
          </div>
          <h1 style={{ fontSize: 28, margin: "12px 0 6px", color: "#0f1f40" }}>Submit KYC for {user?.full_name || "your business"}</h1>
          <p style={{ margin: 0, color: "#4b5b77", lineHeight: 1.6 }}>
            Provide business and identity details to complete onboarding. Payment information can be reattached here for faster review.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "28px 40px 36px", display: "grid", gap: 18 }}>
          <div style={{ ...gridTwo }}>
            <label style={labelStyle}>
              <span>First Name *</span>
              <input style={inputStyle} value={form.first_name} onChange={(e) => handleChange("first_name", e.target.value)} required />
            </label>
            <label style={labelStyle}>
              <span>Last Name *</span>
              <input style={inputStyle} value={form.last_name} onChange={(e) => handleChange("last_name", e.target.value)} required />
            </label>
            <label style={labelStyle}>
              <span>Gender *</span>
              <select style={inputStyle} value={form.gender} onChange={(e) => handleChange("gender", e.target.value)} required>
                <option value="">Select</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label style={labelStyle}>
              <span>Date of Birth *</span>
              <input type="date" style={inputStyle} value={form.dob} onChange={(e) => handleChange("dob", e.target.value)} required />
            </label>
            <label style={labelStyle}>
              <span>Country *</span>
              <input style={inputStyle} value={form.country} onChange={(e) => handleChange("country", e.target.value)} required />
            </label>
            <label style={labelStyle}>
              <span>City *</span>
              <input style={inputStyle} value={form.city} onChange={(e) => handleChange("city", e.target.value)} required />
            </label>
            <label style={labelStyle}>
              <span>Phone *</span>
              <input style={inputStyle} value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} required />
            </label>
            <label style={labelStyle}>
              <span>Residential Address *</span>
              <input style={inputStyle} value={form.address} onChange={(e) => handleChange("address", e.target.value)} required />
            </label>
          </div>

          <div style={{ ...gridTwo }}>
            <label style={labelStyle}>
              <span>Business Name *</span>
              <input style={inputStyle} value={form.business_name} onChange={(e) => handleChange("business_name", e.target.value)} required />
            </label>
            <label style={labelStyle}>
              <span>Registration / PAN *</span>
              <input style={inputStyle} value={form.registration_pan} onChange={(e) => handleChange("registration_pan", e.target.value)} required />
            </label>
            <label style={labelStyle}>
              <span>Industry *</span>
              <input style={inputStyle} value={form.industry} onChange={(e) => handleChange("industry", e.target.value)} required />
            </label>
            <label style={labelStyle}>
              <span>Website (optional)</span>
              <input style={inputStyle} value={form.website} onChange={(e) => handleChange("website", e.target.value)} placeholder="https://yourbusiness.com" />
            </label>
            <label style={labelStyle}>
              <span>Identity Type *</span>
              <select style={inputStyle} value={form.identity_type} onChange={(e) => handleChange("identity_type", e.target.value)} required>
                <option value="">Select</option>
                <option value="NATIONAL_ID">National ID</option>
                <option value="PASSPORT">Passport</option>
                <option value="DRIVING_LICENSE">Driving License</option>
              </select>
            </label>
            <label style={labelStyle}>
              <span>Identity Number *</span>
              <input style={inputStyle} value={form.identity_number} onChange={(e) => handleChange("identity_number", e.target.value)} required />
            </label>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <label style={labelStyle}>
              <span>Identity Document *</span>
              <div
                style={{
                  border: "2px dashed #cbd5e1",
                  borderRadius: 14,
                  padding: "16px 14px",
                  background: "#f8fbff",
                  textAlign: "center",
                  color: "#475569",
                  cursor: "pointer",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 800, color: "#0f172a" }}>Upload identity document</div>
                <div style={{ fontSize: 13 }}>
                  {form.identity_document ? form.identity_document.name : "PDF or image files allowed"}
                </div>
                {previewId && (
                  <div style={{ width: 200, height: 200, margin: "0 auto", borderRadius: 14, overflow: "hidden", border: "1px solid #e2e8f0", background: "#fff" }}>
                    <img src={previewId} alt="Identity preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
                <input type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={handleFile("identity_document")} />
              </div>
            </label>

            <div style={{ ...gridTwo }}>
              <label style={labelStyle}>
                <span>Payment Transaction Code (optional)</span>
                <input
                  style={inputStyle}
                  value={form.payment_transaction_code}
                  onChange={(e) => handleChange("payment_transaction_code", e.target.value)}
                  placeholder="If resubmitting payment proof"
                />
              </label>
              <label style={labelStyle}>
                <span>Payment Screenshot (optional)</span>
                <div
                  style={{
                    border: "2px dashed #cbd5e1",
                    borderRadius: 14,
                    padding: "14px",
                    background: "#f8fbff",
                    textAlign: "center",
                    color: "#475569",
                    cursor: "pointer",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>Upload payment screenshot</div>
                  <div style={{ fontSize: 13 }}>
                    {form.payment_screenshot ? form.payment_screenshot.name : "PNG, JPG, JPEG (optional)"}
                  </div>
                  {previewPay && (
                    <div style={{ width: 180, height: 180, margin: "0 auto", borderRadius: 14, overflow: "hidden", border: "1px solid #e2e8f0", background: "#fff" }}>
                      <img src={previewPay} alt="Payment preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  )}
                  <input type="file" accept="image/png,image/jpg,image/jpeg" style={{ display: "none" }} onChange={handleFile("payment_screenshot")} />
                </div>
              </label>
            </div>
          </div>

            <div style={{ marginTop: 8, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f172a", fontWeight: 800, cursor: "pointer" }}
                onClick={() => navigate(-1)}
              >
                Back
              </button>
              <button
                type="submit"
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 900,
                  cursor: isValid && !submitting ? "pointer" : "not-allowed",
                  opacity: isValid && !submitting ? 1 : 0.6,
                }}
                disabled={!isValid || submitting}
              >
                {submitting ? "Submitting..." : "Submit KYC"}
              </button>
            </div>

            {error && (
              <div style={{ marginTop: 8, padding: 12, borderRadius: 10, background: "#fff1f2", border: "1px solid #fecdd3", color: "#b91c1c", fontWeight: 700 }}>
                {error}
              </div>
            )}
        </form>
      </div>

      {confirmOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div
            style={{
              width: "min(520px, 100%)",
              background: "#ffffff",
              borderRadius: 16,
              padding: 22,
              boxShadow: "0 20px 60px rgba(15,23,42,0.28)",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 18, color: "#0f1f40", marginBottom: 8 }}>
              Confirm submission
            </div>
            <p style={{ margin: 0, color: "#1f2d4f", lineHeight: 1.6 }}>
              Are you sure you want to submit your KYC details? You won’t be able to edit them until reviewed.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#0f172a",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitKyc}
                disabled={submitting}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontWeight: 900,
                  cursor: submitting ? "not-allowed" : "pointer",
                  opacity: submitting ? 0.75 : 1,
                  boxShadow: "0 12px 24px rgba(37,99,235,0.25)",
                }}
              >
                {submitting ? "Submitting..." : "Yes, submit KYC"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
