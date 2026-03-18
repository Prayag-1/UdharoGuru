import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getCreditSale, recordPayment, deleteCreditSale } from "../../api/creditSales";
import { resolveHomeRoute, useAuth } from "../../context/AuthContext";

const formatMoney = (value) => {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return "0.00";
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getStatusColor = (status) => {
  switch (status) {
    case "PENDING":
      return { bg: "#fef3c7", text: "#b45309", icon: "⏳" };
    case "PARTIAL":
      return { bg: "#dbeafe", text: "#1e40af", icon: "📊" };
    case "PAID":
      return { bg: "#dcfce7", text: "#15803d", icon: "✓" };
    default:
      return { bg: "#f3f4f6", text: "#374151", icon: "•" };
  }
};

export default function CreditSaleDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  useEffect(() => {
    if (!user) return;
    if (user.account_type !== "BUSINESS") {
      navigate(resolveHomeRoute(user), { replace: true });
    }
  }, [user, navigate]);

  const loadSale = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getCreditSale(id);
      setSale(response.data);
    } catch {
      setError("Failed to load credit sale details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSale();
  }, [id]);

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    setPaymentError("");

    if (!paymentAmount) {
      setPaymentError("Please enter a payment amount");
      return;
    }

    const amount = Number(paymentAmount);
    if (amount <= 0) {
      setPaymentError("Payment amount must be greater than zero");
      return;
    }

    if (amount > sale.amount_due) {
      setPaymentError(`Payment exceeds outstanding amount. Outstanding: Rs. ${formatMoney(sale.amount_due)}`);
      return;
    }

    setRecordingPayment(true);
    try {
      await recordPayment(id, amount);
      setPaymentAmount("");
      await loadSale();
    } catch (err) {
      setPaymentError(err.response?.data?.detail || "Failed to record payment");
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this credit sale? This will restore the stock.")) {
      return;
    }

    try {
      await deleteCreditSale(id);
      navigate("/business/credit-sales");
    } catch {
      setError("Failed to delete credit sale");
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "28px 24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "28px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <button
            onClick={() => navigate("/business/credit-sales")}
            style={{
              background: "none",
              border: "none",
              color: "#2563eb",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            ← Back
          </button>
          <div style={{ marginTop: 20, padding: 20, background: "white", borderRadius: 12, textAlign: "center", color: "#475569" }}>
            Credit sale not found
          </div>
        </div>
      </div>
    );
  }

  const statusColor = getStatusColor(sale.status);
  const paymentProgress = (sale.amount_paid / sale.total_amount) * 100;

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "28px 24px", fontFamily: "Inter, system-ui" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            onClick={() => navigate("/business/credit-sales")}
            style={{
              background: "none",
              border: "none",
              color: "#2563eb",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            ← Back to Credit Sales
          </button>
          <button
            onClick={handleDelete}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #fecdd3",
              background: "#fff1f2",
              color: "#b91c1c",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Delete Sale
          </button>
        </div>

        {error && (
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid #fecdd3", background: "#fff1f2", color: "#b91c1c", fontWeight: 700 }}>
            {error}
          </div>
        )}

        {/* Invoice Header */}
        <div style={{ background: "#ffffff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 12, color: "#475569", fontWeight: 700, marginBottom: 4 }}>INVOICE NUMBER</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{sale.invoice_number}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 800,
                  background: statusColor.bg,
                  color: statusColor.text,
                }}
              >
                {statusColor.icon} {sale.status}
              </span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, paddingTop: 20, borderTop: "1px solid #e2e8f0" }}>
            <div>
              <div style={{ fontSize: 12, color: "#475569", fontWeight: 700, marginBottom: 4 }}>CUSTOMER</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{sale.customer_name}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Balance: Rs. {formatMoney(sale.customer_balance)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#475569", fontWeight: 700, marginBottom: 4 }}>DATA</div>
              <div style={{ fontSize: 13, color: "#0f172a" }}>{new Date(sale.created_at).toLocaleDateString()}</div>
              {sale.due_date && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Due: {new Date(sale.due_date).toLocaleDateString()}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "#475569", fontWeight: 700, marginBottom: 4 }}>TOTAL AMOUNT</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>Rs. {formatMoney(sale.total_amount)}</div>
            </div>
          </div>
        </div>

        {/* Items */}
        <div style={{ background: "#ffffff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>Items</div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8, padding: "10px 14px", background: "#f8fafc", fontWeight: 700, fontSize: 13 }}>
              <div>Product</div>
              <div>Quantity</div>
              <div>Unit Price</div>
              <div style={{ textAlign: "right" }}>Subtotal</div>
            </div>
            {sale.items.map((item, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8, padding: "12px 14px", borderTop: "1px solid #e2e8f0", alignItems: "center" }}>
                <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                <div>{item.quantity}</div>
                <div>Rs. {formatMoney(item.unit_price)}</div>
                <div style={{ textAlign: "right", fontWeight: 700 }}>Rs. {formatMoney(item.subtotal)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Information */}
        <div style={{ background: "#ffffff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>Payment Information</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
            <div style={{ background: "#f8fafc", padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: "#475569", fontWeight: 700, marginBottom: 4 }}>TOTAL SALE</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>Rs. {formatMoney(sale.total_amount)}</div>
            </div>
            <div style={{ background: "#dcfce7", padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: "#15803d", fontWeight: 700, marginBottom: 4 }}>AMOUNT PAID</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#15803d" }}>Rs. {formatMoney(sale.amount_paid)}</div>
            </div>
            <div style={{ background: "#fef3c7", padding: 14, borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: "#b45309", fontWeight: 700, marginBottom: 4 }}>OUTSTANDING</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#b45309" }}>Rs. {formatMoney(sale.amount_due)}</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>Payment Progress</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{Math.round(paymentProgress)}%</span>
            </div>
            <div style={{ height: 8, background: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "#059669", width: `${paymentProgress}%`, transition: "width 0.3s" }} />
            </div>
          </div>

          {/* Record Payment */}
          {sale.status !== "PAID" && (
            <form onSubmit={handleRecordPayment}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
                <div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Enter payment amount"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    style={{
                      border: "1px solid #d7def0",
                      borderRadius: 8,
                      padding: "10px 12px",
                      fontSize: 14,
                      fontFamily: "Inter, system-ui",
                      background: "#f9fbff",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  />
                  {paymentError && (
                    <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>{paymentError}</div>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={recordingPayment}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: "#2563eb",
                    color: "#ffffff",
                    fontWeight: 700,
                    cursor: recordingPayment ? "not-allowed" : "pointer",
                    opacity: recordingPayment ? 0.7 : 1,
                  }}
                >
                  {recordingPayment ? "Recording..." : "Record"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Notes */}
        {sale.notes && (
          <div style={{ background: "#ffffff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Notes</div>
            <div style={{ fontSize: 14, color: "#475569", whiteSpace: "pre-wrap" }}>{sale.notes}</div>
          </div>
        )}
      </div>
    </div>
  );
}
