import { useEffect, useMemo, useState } from "react";
import { getCreditSales } from "../../api/creditSales";
import { createPayment } from "../../api/payments";

const inputStyle = {
  border: "1px solid #d7def0",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "Inter, system-ui",
  background: "#f9fbff",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "grid",
  gap: 6,
  fontWeight: 700,
  color: "#1d2d4a",
};

const formatMoney = (value) => {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return "0.00";
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function RecordPaymentModal({ open, onClose, onPaymentRecorded }) {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    credit_sale: "",
    amount: "",
    payment_method: "CASH",
    reference_number: "",
    notes: "",
    payment_date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    const loadSales = async () => {
      setLoading(true);
      try {
        // Get all credit sales that are not fully paid
        const response = await getCreditSales();
        const allSales = Array.isArray(response.data) ? response.data : response.data?.results || [];
        const pendingSales = allSales.filter((sale) => sale.status !== "PAID");
        setSales(pendingSales);
      } catch {
        setError("Failed to load credit sales");
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      loadSales();
    }
  }, [open]);

  const selectedSale = sales.find((s) => String(s.id) === formData.credit_sale);
  const maxPaymentAmount = selectedSale?.amount_due || 0;

  const isValid = useMemo(() => {
    const amount = Number(formData.amount);
    return (
      formData.credit_sale &&
      formData.amount &&
      amount > 0 &&
      amount <= maxPaymentAmount &&
      !Number.isNaN(amount)
    );
  }, [formData, maxPaymentAmount]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!isValid) {
      setError("Please fill in all required fields correctly");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        credit_sale: formData.credit_sale,
        amount: Number(formData.amount),
        payment_method: formData.payment_method,
        reference_number: formData.reference_number,
        notes: formData.notes,
        payment_date: formData.payment_date,
      };

      await createPayment(payload);
      
      // Reset form
      setFormData({
        credit_sale: "",
        amount: "",
        payment_method: "CASH",
        reference_number: "",
        notes: "",
        payment_date: new Date().toISOString().split("T")[0],
      });

      onPaymentRecorded();
    } catch (err) {
      setError(err.response?.data?.detail || err.response?.data?.amount?.[0] || "Failed to record payment");
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
          width: "min(600px, 100%)",
          background: "#ffffff",
          borderRadius: 18,
          padding: 22,
          boxShadow: "0 20px 60px rgba(15,23,42,0.28)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 18, color: "#0f1f40", marginBottom: 16 }}>Record Payment</div>

        {error && (
          <div style={{ padding: 12, borderRadius: 10, border: "1px solid #fecdd3", background: "#fff1f2", color: "#b91c1c", fontWeight: 700, marginBottom: 16, fontSize: 13 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          {/* Credit Sale Selection */}
          <label style={labelStyle}>
            <span>Credit Sale *</span>
            {loading ? (
              <select style={inputStyle} disabled>
                <option>Loading...</option>
              </select>
            ) : (
              <select
                style={inputStyle}
                value={formData.credit_sale}
                onChange={(e) => {
                  setFormData({ ...formData, credit_sale: e.target.value, amount: "" });
                  setError("");
                }}
                required
              >
                <option value="">-- Select a Sale --</option>
                {sales.map((sale) => (
                  <option key={sale.id} value={sale.id}>
                    {sale.invoice_number} - {sale.customer_name} (Due: Rs. {formatMoney(sale.amount_due)})
                  </option>
                ))}
              </select>
            )}
            {sales.length === 0 && !loading && <div style={{ fontSize: 12, color: "#dc2626" }}>No pending sales available</div>}
          </label>

          {/* Display Sale Info */}
          {selectedSale && (
            <div style={{ background: "#f0f9ff", padding: 12, borderRadius: 8, border: "1px solid #bfdbfe" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
                <div>
                  <div style={{ color: "#475569", fontWeight: 700, marginBottom: 2 }}>Total Amount</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>Rs. {formatMoney(selectedSale.total_amount)}</div>
                </div>
                <div>
                  <div style={{ color: "#475569", fontWeight: 700, marginBottom: 2 }}>Amount Outstanding</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#d97706" }}>Rs. {formatMoney(selectedSale.amount_due)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Payment Amount */}
          <label style={labelStyle}>
            <span>Payment Amount *</span>
            <input
              type="number"
              step="0.01"
              min="0"
              max={String(maxPaymentAmount)}
              style={inputStyle}
              value={formData.amount}
              onChange={(e) => {
                setFormData({ ...formData, amount: e.target.value });
                setError("");
              }}
              placeholder="0.00"
              disabled={!selectedSale}
            />
            {selectedSale && (
              <div style={{ fontSize: 12, color: "#475569" }}>
                Max: Rs. {formatMoney(selectedSale.amount_due)}
              </div>
            )}
          </label>

          {/* Payment Method */}
          <label style={labelStyle}>
            <span>Payment Method *</span>
            <select
              style={inputStyle}
              value={formData.payment_method}
              onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
            >
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CHEQUE">Cheque</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="OTHER">Other</option>
            </select>
          </label>

          {/* Reference Number */}
          <label style={labelStyle}>
            <span>Reference Number</span>
            <input
              type="text"
              style={inputStyle}
              value={formData.reference_number}
              onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
              placeholder="Cheque #, Transaction ID, etc."
            />
          </label>

          {/* Payment Date */}
          <label style={labelStyle}>
            <span>Payment Date *</span>
            <input
              type="date"
              style={inputStyle}
              value={formData.payment_date}
              onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              required
            />
          </label>

          {/* Notes */}
          <label style={labelStyle}>
            <span>Notes</span>
            <textarea
              style={{ ...inputStyle, minHeight: 60, fontFamily: "Inter, system-ui", resize: "vertical" }}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional information..."
            />
          </label>

          {/* Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
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
                borderRadius: 8,
                border: "none",
                background: "#059669",
                color: "#ffffff",
                fontWeight: 900,
                cursor: !isValid || submitting ? "not-allowed" : "pointer",
                opacity: !isValid || submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Recording..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
