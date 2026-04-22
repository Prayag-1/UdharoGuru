import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { confirmBusinessOcr, deleteBusinessOcr, getBusinessOcr, updateBusinessOcr } from "../../api/business";
import { useAuth } from "../../context/AuthContext";
import { useBusinessGate } from "../../hooks/useBusinessGate";

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  if (Number.isNaN(num)) return "";
  return num.toLocaleString("ne-NP", { style: "currency", currency: "NPR" });
};

const inputStyle = {
  marginTop: 6,
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  fontSize: 14,
  fontWeight: 700,
  color: "#0f172a",
};

const hint = { display: "block", marginTop: 4, fontSize: 12, color: "#c2410c", fontWeight: 700 };

export default function OcrDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loading: gateLoading } = useBusinessGate(`/business/ocr/${id}`);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [document, setDocument] = useState(null);
  const [form, setForm] = useState({
    merchant: "",
    customer_name: "",
    customer_phone: "",
    customer_address: "",
    amount: "",
    date: "",
    note: "",
    transaction_type: "LENT",
  });
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getBusinessOcr(id);
      setDocument(data);
      setForm({
        merchant: data.extracted_merchant || "",
        customer_name: data.extracted_merchant || "",
        customer_phone: data.extracted_phone || "",
        customer_address: data.extracted_address || "",
        amount: data.extracted_amount ? String(data.extracted_amount) : "",
        date: data.extracted_date || "",
        note: data.transaction_note || "",
        transaction_type: data.transaction_type === "DEBIT" ? "BORROWED" : "LENT",
      });
    } catch (err) {
      const msg = err?.response?.data?.detail || "Unable to load OCR document.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (gateLoading) return;
    if (!user) {
      setLoading(false);
      setError("Login required.");
      return;
    }
    if (user.account_type !== "BUSINESS") {
      setLoading(false);
      setError("Business account required for OCR.");
      return;
    }
    if (id) load();
  }, [gateLoading, id, user]);

  const isConfirmed = document?.status === "CONFIRMED";
  const isCustomerId = document?.document_type === "CUSTOMER_ID";

  const warnings = useMemo(() => {
    const notes = [];
    if (isCustomerId) {
      if (!form.customer_name) notes.push("Customer name missing, please fill manually.");
      return notes;
    }
    if (!form.customer_name) notes.push("Customer name missing, please confirm who this sale or income belongs to.");
    if (!form.merchant) notes.push("Merchant missing, please fill manually.");
    if (!form.amount) notes.push("Amount missing, please confirm.");
    if (!form.date) notes.push("Date missing, please set the transaction date.");
    return notes;
  }, [form, isCustomerId]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.customer_name?.trim()) {
      setError("Customer name is required");
      return;
    }
    if (!isCustomerId && !form.merchant?.trim()) {
      setError("Merchant name is required");
      return;
    }
    if (!isCustomerId && !form.amount) {
      setError("Amount is required");
      return;
    }
    if (!isCustomerId && !form.date) {
      setError("Transaction date is required");
      return;
    }

    if (submitting) return;
    setSubmitting(true);
    setError("");

    try {
      const payload = {
        customer_name: form.customer_name,
        customer_phone: form.customer_phone || "",
        customer_address: form.customer_address || "",
        note: form.note || "",
      };

      if (!isCustomerId) {
        payload.amount = form.amount;
        payload.date = form.date;
        payload.merchant = form.merchant;
        payload.transaction_type = form.transaction_type;
      }

      const response = isConfirmed
        ? await updateBusinessOcr(id, payload)
        : await confirmBusinessOcr(id, payload);

      const data = response.data || {};
      if (isCustomerId) {
        navigate("/business/customers", {
          state: {
            success: isConfirmed ? "Scanned customer updated successfully." : "Customer created from scanned ID successfully.",
          },
          replace: true,
        });
        return;
      }

      if (form.transaction_type === "LENT") {
        navigate("/business/credit-sales", {
          state: {
            success: isConfirmed
              ? "OCR expense updated and synced to Credit Sales."
              : "OCR expense added to Credit Sales successfully.",
            creditSaleId: data.credit_sale_id,
          },
          replace: true,
        });
      } else {
        navigate("/business/income", {
          state: {
            success: isConfirmed
              ? "OCR income updated successfully."
              : "OCR income recorded successfully.",
          },
          replace: true,
        });
      }
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.response?.data?.non_field_errors?.[0] ||
        err?.message ||
        "Unable to save. Please review the fields and try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (deleting || !document) return;

    const confirmed = window.confirm(
      isConfirmed ? "Delete this OCR record and its linked data?" : "Delete this OCR draft?"
    );
    if (!confirmed) return;

    setDeleting(true);
    setError("");
    try {
      await deleteBusinessOcr(id);
      navigate("/business/ocr", {
        state: {
          success: isConfirmed ? "OCR record and linked data deleted." : "OCR draft deleted.",
        },
        replace: true,
      });
    } catch (err) {
      const msg = err?.response?.data?.detail || "Unable to delete this OCR record.";
      setError(msg);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 28 }}>
        <div style={{ height: 260, borderRadius: 14, background: "#f1f5f9", border: "1px solid #e2e8f0" }} />
      </div>
    );
  }

  if (error && !document) {
    return (
      <div style={{ padding: 28, maxWidth: 720 }}>
        <div style={{ marginBottom: 12 }}>
          <Link to="/business/ocr" style={{ color: "#0f172a", fontWeight: 800 }}>
            {"\u2190 Back to OCR"}
          </Link>
        </div>
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #fecdd3", background: "#fff1f2", color: "#b91c1c", fontWeight: 700 }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 26px", display: "grid", gap: 16, maxWidth: 1100, margin: "0 auto", fontFamily: "Inter, system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>
            {isCustomerId ? "Review Customer ID" : "Review OCR"}
          </div>
          <div style={{ color: "#475569" }}>
            {isCustomerId
              ? "Confirm the scanned customer details before saving them."
              : isConfirmed
                ? "Edit or delete the linked OCR record here."
                : "Confirm the extracted fields before routing them to Credit Sales or Income."}
          </div>
        </div>
        <Link to="/business/ocr" style={{ color: "#0f172a", fontWeight: 800 }}>
          {"\u2190 Back to OCR list"}
        </Link>
      </div>

      {isConfirmed && (
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #cbd5e1", background: "#f8fafc", color: "#0f172a", fontWeight: 700 }}>
          This document is confirmed. Changes here update the linked record directly.
        </div>
      )}

      {warnings.length > 0 && !isConfirmed && (
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #fed7aa", background: "#fff7ed", color: "#c2410c", fontWeight: 700 }}>
          {warnings.join(" ")}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 16, alignItems: "start" }}>
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            background: "#f8fafc",
            padding: 12,
            minHeight: 240,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>{isCustomerId ? "Customer ID" : "Receipt"}</div>
          {document?.image ? (
            <img
              src={document.image}
              alt="OCR preview"
              style={{ width: "100%", height: "auto", borderRadius: 12, border: "1px solid #e2e8f0" }}
            />
          ) : (
            <div style={{ padding: 16, borderRadius: 12, background: "#e2e8f0", color: "#475569" }}>
              Image preview not available for this document.
            </div>
          )}

          <button
            type="button"
            onClick={() => setRawOpen((v) => !v)}
            style={{
              marginTop: 12,
              width: "100%",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
              background: "#fff",
              padding: "10px 12px",
              fontWeight: 800,
              color: "#0f172a",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            Extracted Text {rawOpen ? "(hide)" : "(show)"}
          </button>
          {rawOpen && (
            <pre
              style={{
                marginTop: 8,
                whiteSpace: "pre-wrap",
                background: "#0f172a",
                color: "#e2e8f0",
                padding: 12,
                borderRadius: 10,
                maxHeight: 320,
                overflow: "auto",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 13,
              }}
            >
              {document?.raw_text || "No text extracted."}
            </pre>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 14,
            padding: 16,
            background: "#ffffff",
            display: "grid",
            gap: 12,
          }}
        >
          {isCustomerId ? (
            <>
              <label style={{ fontWeight: 800, color: "#0f172a" }}>
                Customer Name *
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={(e) => handleChange("customer_name", e.target.value)}
                  placeholder="Customer name from ID"
                  style={inputStyle}
                  required
                />
              </label>

              {document?.extracted_id_number && (
                <div style={{ padding: 10, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", color: "#0f172a", fontWeight: 700 }}>
                  ID Number: {document.extracted_id_number}
                  {document?.extracted_dob ? ` | DOB: ${document.extracted_dob}` : ""}
                </div>
              )}

              <label style={{ fontWeight: 800, color: "#0f172a" }}>
                Phone
                <input
                  type="text"
                  value={form.customer_phone}
                  onChange={(e) => handleChange("customer_phone", e.target.value)}
                  placeholder="Phone number"
                  style={inputStyle}
                />
              </label>

              <label style={{ fontWeight: 800, color: "#0f172a" }}>
                Address
                <textarea
                  value={form.customer_address}
                  onChange={(e) => handleChange("customer_address", e.target.value)}
                  placeholder="Address from ID"
                  style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
                />
              </label>
            </>
          ) : (
            <>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontWeight: 800, color: "#0f172a" }}>
                  Merchant *
                  <input
                    type="text"
                    value={form.merchant}
                    onChange={(e) => handleChange("merchant", e.target.value)}
                    placeholder="Merchant name"
                    style={inputStyle}
                    required
                  />
                  {!form.merchant && <span style={hint}>Not detected by OCR. Please fill manually.</span>}
                </label>
              </div>

              <label style={{ fontWeight: 800, color: "#0f172a" }}>
                Customer *
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={(e) => handleChange("customer_name", e.target.value)}
                  placeholder="Customer name for Credit Sale or Income"
                  style={inputStyle}
                  required
                />
              </label>

              <label style={{ fontWeight: 800, color: "#0f172a" }}>
                Customer Phone
                <input
                  type="text"
                  value={form.customer_phone}
                  onChange={(e) => handleChange("customer_phone", e.target.value)}
                  placeholder="Optional phone number"
                  style={inputStyle}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ fontWeight: 800, color: "#0f172a" }}>
                  Amount *
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={(e) => handleChange("amount", e.target.value)}
                    placeholder="0.00"
                    style={inputStyle}
                    required
                  />
                  {!form.amount && <span style={hint}>Amount missing. Confirm before saving.</span>}
                  {form.amount && <span style={{ ...hint, color: "#0f172a" }}>Parsed: {formatCurrency(form.amount)}</span>}
                </label>
                <label style={{ fontWeight: 800, color: "#0f172a" }}>
                  Date *
                  <input
                    type="date"
                    value={form.date || ""}
                    onChange={(e) => handleChange("date", e.target.value)}
                    style={inputStyle}
                    required
                  />
                  {!form.date && <span style={hint}>Date missing. Set the transaction date.</span>}
                </label>
              </div>

              <label style={{ fontWeight: 800, color: "#0f172a" }}>
                OCR route
                <select
                  value={form.transaction_type}
                  onChange={(e) => handleChange("transaction_type", e.target.value)}
                  style={{ ...inputStyle, background: "#f8fafc" }}
                >
                  <option value="LENT">Expense / Outflow to Credit Sales</option>
                  <option value="BORROWED">Income / Inflow to Income tab</option>
                </select>
              </label>
            </>
          )}

          <label style={{ fontWeight: 800, color: "#0f172a" }}>
            Note (optional)
            <textarea
              value={form.note}
              onChange={(e) => handleChange("note", e.target.value)}
              placeholder="Add context for this OCR record"
              style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
            />
          </label>

          {error && (
            <div style={{ padding: 12, borderRadius: 12, border: "1px solid #fecdd3", background: "#fff1f2", color: "#b91c1c", fontWeight: 700 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              style={{
                border: "1px solid #fecaca",
                background: deleting ? "#fca5a5" : "#fff1f2",
                color: "#b91c1c",
                fontWeight: 800,
                padding: "12px 16px",
                borderRadius: 12,
                cursor: deleting ? "not-allowed" : "pointer",
              }}
            >
              {deleting ? "Deleting..." : isConfirmed ? "Delete Linked Data" : "Delete Draft"}
            </button>
            <button
              type="submit"
              disabled={submitting || !form.customer_name || (!isCustomerId && (!form.amount || !form.date))}
              style={{
                border: "none",
                background: submitting || !form.customer_name || (!isCustomerId && (!form.amount || !form.date)) ? "#94a3b8" : "#0f172a",
                color: "#ffffff",
                fontWeight: 800,
                padding: "12px 16px",
                borderRadius: 12,
                cursor: submitting || !form.customer_name || (!isCustomerId && (!form.amount || !form.date)) ? "not-allowed" : "pointer",
              }}
            >
              {submitting
                ? isConfirmed ? "Saving..." : "Confirming..."
                : isCustomerId
                  ? isConfirmed ? "Save Customer Changes" : "Confirm & Create Customer"
                  : isConfirmed ? "Save Changes" : "Confirm & Route Record"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
