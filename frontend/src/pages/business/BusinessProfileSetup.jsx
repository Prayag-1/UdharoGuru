import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createBusinessProfile, getBusinessProfile, updateBusinessProfile } from "../../api/business";
import { resolveHomeRoute, useAuth } from "../../context/AuthContext";

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

export default function BusinessProfileSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({
    business_name: "",
    owner_name: "",
    phone: "",
    email: "",
    address: "",
    business_type: "",
    logo: null,
    pan_vat_number: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [profileExists, setProfileExists] = useState(false);
  const [logoPreview, setLogoPreview] = useState("");

  useEffect(() => {
    if (!user) return;
    if (user.account_type !== "BUSINESS") {
      navigate(resolveHomeRoute(user), { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      if (!user || user.account_type !== "BUSINESS") {
        setLoading(false);
        return;
      }
      try {
        const { data } = await getBusinessProfile();
        if (!active) return;
        setProfileExists(true);
        setForm({
          business_name: data?.business_name || "",
          owner_name: data?.owner_name || user?.full_name || "",
          phone: data?.phone || "",
          email: data?.email || user?.email || "",
          address: data?.address || "",
          business_type: data?.business_type || "",
          logo: null,
          pan_vat_number: data?.pan_vat_number || "",
        });
        setLogoPreview(data?.logo || "");
      } catch (err) {
        if (!active) return;
        if (err?.response?.status !== 404) {
          setError("Unable to load business profile.");
        }
        setProfileExists(false);
        setLogoPreview("");
        setForm((prev) => ({
          ...prev,
          owner_name: prev.owner_name || user?.full_name || "",
          email: prev.email || user?.email || "",
        }));
      } finally {
        if (active) setLoading(false);
      }
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!form.logo) return;
    const url = URL.createObjectURL(form.logo);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [form.logo]);

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) handleChange("logo", file);
  };

  const isValid = useMemo(() => {
    return (
      form.business_name &&
      form.owner_name &&
      form.phone &&
      form.email &&
      form.address &&
      form.business_type &&
      form.pan_vat_number
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
      "Unable to save business profile."
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid || saving) return;
    setSaving(true);
    setError("");
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          payload.append(key, value);
        }
      });
      const action = profileExists ? updateBusinessProfile : createBusinessProfile;
      const { data } = await action(payload);
      setProfileExists(true);
      setLogoPreview(data?.logo || logoPreview);
    } catch (err) {
      setError(extractMessage(err));
    } finally {
      setSaving(false);
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
          "radial-gradient(circle at 10% 20%, rgba(44,139,186,0.12), transparent 30%), radial-gradient(circle at 90% 10%, rgba(37,99,235,0.12), transparent 35%), linear-gradient(135deg, #f7faff 0%, #eef5ff 55%, #f9fbff 100%)",
        fontFamily: "Inter, system-ui",
      }}
    >
      <div
        style={{
          width: "min(980px, 100%)",
          background: "#ffffff",
          borderRadius: 26,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(26,55,117,0.18)",
        }}
      >
        <div style={{ padding: "36px 36px 16px", borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#eef4ff", color: "#0f172a", fontWeight: 800, fontSize: 12 }}>Business</span>
            <span style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f172a", fontWeight: 800, fontSize: 12 }}>Profile Setup</span>
          </div>
          <h1 style={{ fontSize: 28, margin: "12px 0 6px", color: "#0f1f40" }}>
            {profileExists ? "Update Business Profile" : "Create Business Profile"}
          </h1>
          <p style={{ margin: 0, color: "#4b5b77", lineHeight: 1.6 }}>
            Add your business details to power the dashboard, invoices, and customer ledger.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "24px 36px 34px", display: "grid", gap: 18 }}>
          {loading ? (
            <div style={{ padding: 16, borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#475569" }}>
              Loading profile...
            </div>
          ) : (
            <>
              <div style={gridTwo}>
                <label style={labelStyle}>
                  <span>Business Name *</span>
                  <input style={inputStyle} value={form.business_name} onChange={(e) => handleChange("business_name", e.target.value)} required />
                </label>
                <label style={labelStyle}>
                  <span>Owner Name *</span>
                  <input style={inputStyle} value={form.owner_name} onChange={(e) => handleChange("owner_name", e.target.value)} required />
                </label>
                <label style={labelStyle}>
                  <span>Phone *</span>
                  <input style={inputStyle} value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} required />
                </label>
                <label style={labelStyle}>
                  <span>Email *</span>
                  <input type="email" style={inputStyle} value={form.email} onChange={(e) => handleChange("email", e.target.value)} required />
                </label>
                <label style={labelStyle}>
                  <span>Business Type *</span>
                  <input style={inputStyle} value={form.business_type} onChange={(e) => handleChange("business_type", e.target.value)} required />
                </label>
                <label style={labelStyle}>
                  <span>PAN/VAT Number *</span>
                  <input style={inputStyle} value={form.pan_vat_number} onChange={(e) => handleChange("pan_vat_number", e.target.value)} required />
                </label>
              </div>

              <label style={labelStyle}>
                <span>Business Address *</span>
                <textarea
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" }}
                  value={form.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  required
                />
              </label>

              <label style={labelStyle}>
                <span>Business Logo (optional)</span>
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
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>Upload logo</div>
                  <div style={{ fontSize: 13 }}>
                    {form.logo ? form.logo.name : "PNG, JPG, JPEG"}
                  </div>
                  {logoPreview && (
                    <div style={{ width: 160, height: 160, margin: "0 auto", borderRadius: 16, overflow: "hidden", border: "1px solid #e2e8f0", background: "#fff" }}>
                      <img src={logoPreview} alt="Business logo preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  )}
                  <input type="file" accept="image/png,image/jpg,image/jpeg" style={{ display: "none" }} onChange={handleFile} />
                </div>
              </label>

              <div style={{ marginTop: 6, display: "flex", gap: 10, justifyContent: "flex-end" }}>
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
                    cursor: isValid && !saving ? "pointer" : "not-allowed",
                    opacity: isValid && !saving ? 1 : 0.6,
                  }}
                  disabled={!isValid || saving}
                >
                  {saving ? "Saving..." : profileExists ? "Update Profile" : "Create Profile"}
                </button>
              </div>

              {error && (
                <div style={{ marginTop: 8, padding: 12, borderRadius: 10, background: "#fff1f2", border: "1px solid #fecdd3", color: "#b91c1c", fontWeight: 700 }}>
                  {error}
                </div>
              )}
            </>
          )}
        </form>
      </div>
    </div>
  );
}
