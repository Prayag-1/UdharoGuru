import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

const labelStyle = { fontSize: 12, color: "#475569", marginBottom: 6, fontWeight: 700 };
const inputStyle = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#0f172a",
  outline: "none",
};
const selectStyle = { ...inputStyle };

const initial = {
  first_name: "",
  last_name: "",
  gender: "",
  dob: "",
  country: "",
  city: "",
  address: "",
  business_name: "",
  registration: "",
  industry: "",
  website: "",
  phone: "",
  id_type: "",
  id_number: "",
  proof_file: null,
};

export default function KycForm() {
  const navigate = useNavigate();
  const { user, setUserState } = useAuth();
  const [form, setForm] = useState({
    ...initial,
    first_name: user?.full_name?.split(" ")?.[0] || "",
    last_name: user?.full_name?.split(" ")?.slice(1).join(" ") || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const isValid = useMemo(() => {
    return (
      form.first_name &&
      form.last_name &&
      form.gender &&
      form.dob &&
      form.country &&
      form.city &&
      form.address &&
      form.business_name &&
      form.registration &&
      form.industry &&
      form.phone &&
      form.id_type &&
      form.id_number &&
      form.proof_file
    );
  }, [form]);

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleChange("proof_file", file);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    setTimeout(() => {
      setSuccess(true);
      setUserState((prev) => (prev ? { ...prev, kyc_status: "APPROVED" } : prev));
      navigate("/business/dashboard", { replace: true });
    }, 800);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        paddingTop: "40px",
        background: "#e8f1ff",
        fontFamily: "Inter, system-ui",
      }}
    >
      <div style={{ width: "100%", maxWidth: "900px" }}>
        <div
          style={{
            background: "#ffffff",
            borderRadius: 16,
            padding: 24,
            border: "1px solid #e5e7eb",
            boxShadow: "0 16px 40px rgba(15,23,42,0.12)",
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
              <span style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Business</span>
              <span style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Secure Verification</span>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: "#0f172a" }}>Submit KYC for {user?.full_name || "your business"}</h1>
            <div style={{ color: "#475569", marginTop: 6 }}>Identity verification ensures faster payouts and access to advanced workflows.</div>
          </div>

          <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(1, minmax(0, 1fr))" }}>
              <div>
                <div style={labelStyle}>First Name</div>
                <input style={inputStyle} value={form.first_name} onChange={(e) => handleChange("first_name", e.target.value)} required />
              </div>
              <div>
                <div style={labelStyle}>Last Name</div>
                <input style={inputStyle} value={form.last_name} onChange={(e) => handleChange("last_name", e.target.value)} required />
              </div>
              <div>
                <div style={labelStyle}>Gender</div>
                <select style={selectStyle} value={form.gender} onChange={(e) => handleChange("gender", e.target.value)} required>
                  <option value="">Select</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <div style={labelStyle}>Date of Birth</div>
                <input type="date" style={inputStyle} value={form.dob} onChange={(e) => handleChange("dob", e.target.value)} required />
              </div>
              <div>
                <div style={labelStyle}>Country</div>
                <input style={inputStyle} value={form.country} onChange={(e) => handleChange("country", e.target.value)} required />
              </div>
              <div>
                <div style={labelStyle}>City</div>
                <input style={inputStyle} value={form.city} onChange={(e) => handleChange("city", e.target.value)} required />
              </div>
              <div>
                <div style={labelStyle}>Phone</div>
                <input style={inputStyle} value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} required />
              </div>
              <div>
                <div style={labelStyle}>Residential Address</div>
                <input style={inputStyle} value={form.address} onChange={(e) => handleChange("address", e.target.value)} required />
              </div>
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(1, minmax(0, 1fr))" }}>
              <div>
                <div style={labelStyle}>Business Name</div>
                <input style={inputStyle} value={form.business_name} onChange={(e) => handleChange("business_name", e.target.value)} required />
              </div>
              <div>
                <div style={labelStyle}>Registration / PAN</div>
                <input style={inputStyle} value={form.registration} onChange={(e) => handleChange("registration", e.target.value)} required />
              </div>
              <div>
                <div style={labelStyle}>Industry</div>
                <input style={inputStyle} value={form.industry} onChange={(e) => handleChange("industry", e.target.value)} required />
              </div>
              <div>
                <div style={labelStyle}>Website (optional)</div>
                <input style={inputStyle} value={form.website} onChange={(e) => handleChange("website", e.target.value)} placeholder="https://yourbusiness.com" />
              </div>
              <div>
                <div style={labelStyle}>Identity Type</div>
                <select style={selectStyle} value={form.id_type} onChange={(e) => handleChange("id_type", e.target.value)} required>
                  <option value="">Select</option>
                  <option value="NATIONAL_ID">National ID</option>
                  <option value="PASSPORT">Passport</option>
                  <option value="DRIVING_LICENSE">Driving License</option>
                </select>
              </div>
              <div>
                <div style={labelStyle}>Identity Number</div>
                <input style={inputStyle} value={form.id_number} onChange={(e) => handleChange("id_number", e.target.value)} required />
              </div>
              <div>
                <div style={labelStyle}>Proof of Identity</div>
                <div style={{ border: "1px dashed #cbd5e1", borderRadius: 12, padding: 14, background: "#f8fafc", textAlign: "center", color: "#475569" }}>
                  <div>Drag & drop identity document or click to upload</div>
                  {form.proof_file && <div style={{ marginTop: 8, fontWeight: 800, color: "#0f172a" }}>{form.proof_file.name}</div>}
                  <label style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "#2563eb", color: "#fff", fontWeight: 800, cursor: "pointer", display: "inline-block" }}>
                    Upload file
                    <input type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={handleFile} />
                  </label>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={labelStyle}>Final Review</div>
                  <div style={{ color: "#475569" }}>All fields are mandatory. Ensure documents are clear and current.</div>
                </div>
                <span style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid rgba(37,99,235,0.25)", background: "rgba(37,99,235,0.08)", fontSize: 12, fontWeight: 700, color: "#2563eb" }}>
                  Secure upload
                </span>
              </div>

              <div style={{ marginTop: 8, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  style={{ padding: "12px 14px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f172a", fontWeight: 800, cursor: "pointer" }}
                  onClick={() => navigate(-1)}
                >
                  Back
                </button>
                <button
                  type="submit"
                  style={{ padding: "12px 14px", borderRadius: 10, border: "none", background: "#2563eb", color: "#fff", fontWeight: 900, cursor: isValid && !submitting ? "pointer" : "not-allowed", opacity: isValid && !submitting ? 1 : 0.6 }}
                  disabled={!isValid || submitting}
                >
                  {submitting ? "Submitting..." : "Submit KYC"}
                </button>
              </div>

              {success && (
                <div style={{ marginTop: 8, padding: 12, borderRadius: 10, background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.25)", color: "#0f172a", fontWeight: 700 }}>
                  KYC submitted. We’ve updated your account and you are being redirected to the Business Dashboard.
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
