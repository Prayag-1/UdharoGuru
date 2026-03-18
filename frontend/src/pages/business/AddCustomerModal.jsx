import { useEffect, useMemo, useState } from "react";

const inputStyle = {
  border: "1px solid #d7def0",
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 14,
  fontFamily: "Inter, system-ui",
  background: "#f9fbff",
};

const labelStyle = {
  display: "grid",
  gap: 6,
  fontWeight: 700,
  color: "#1d2d4a",
};

const gridTwo = { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" };

export default function AddCustomerModal({ open, onClose, onSave, initialData }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    notes: "",
    opening_balance: "0",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: initialData?.name || "",
      phone: initialData?.phone || "",
      address: initialData?.address || "",
      notes: initialData?.notes || "",
      opening_balance: initialData?.opening_balance ?? "0",
    });
  }, [open, initialData]);

  const isValid = useMemo(() => {
    return form.name && form.opening_balance !== "" && !Number.isNaN(Number(form.opening_balance));
  }, [form]);

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      await onSave({
        ...form,
        opening_balance: Number(form.opening_balance || 0),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
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
          width: "min(640px, 100%)",
          background: "#ffffff",
          borderRadius: 18,
          padding: 22,
          boxShadow: "0 20px 60px rgba(15,23,42,0.28)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 18, color: "#0f1f40", marginBottom: 12 }}>
          {initialData ? "Edit Customer" : "Add New Customer"}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          <div style={gridTwo}>
            <label style={labelStyle}>
              <span>Name *</span>
              <input style={inputStyle} value={form.name} onChange={(e) => handleChange("name", e.target.value)} required />
            </label>
            <label style={labelStyle}>
              <span>Phone</span>
              <input style={inputStyle} value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} />
            </label>
            <label style={labelStyle}>
              <span>Opening Balance *</span>
              <input
                type="number"
                step="0.01"
                style={inputStyle}
                value={form.opening_balance}
                onChange={(e) => handleChange("opening_balance", e.target.value)}
                required
              />
            </label>
          </div>

          <label style={labelStyle}>
            <span>Address</span>
            <textarea
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
            />
          </label>

          <label style={labelStyle}>
            <span>Notes</span>
            <textarea
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
            />
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
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
              type="submit"
              disabled={!isValid || submitting}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                background: "#2563eb",
                color: "#ffffff",
                fontWeight: 900,
                cursor: !isValid || submitting ? "not-allowed" : "pointer",
                opacity: !isValid || submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Saving..." : initialData ? "Update Customer" : "Create Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
