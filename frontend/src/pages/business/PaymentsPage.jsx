import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPayments, getPaymentsSummary, deletePayment } from "../../api/payments";
import { resolveHomeRoute, useAuth } from "../../context/AuthContext";
import RecordPaymentModal from "./RecordPaymentModal";
import BusinessNav from "../../components/BusinessNav";

const formatMoney = (value) => {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return "0.00";
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getPaymentMethodColor = (method) => {
  switch (method) {
    case "CASH":
      return { bg: "#dbeafe", text: "#1e40af" };
    case "BANK_TRANSFER":
      return { bg: "#e0e7ff", text: "#3730a3" };
    case "CHEQUE":
      return { bg: "#fce7f3", text: "#be185d" };
    case "MOBILE_MONEY":
      return { bg: "#dcfce7", text: "#15803d" };
    case "OTHER":
      return { bg: "#f3f4f6", text: "#374151" };
    default:
      return { bg: "#f3f4f6", text: "#374151" };
  }
};

export default function PaymentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.account_type !== "BUSINESS") {
      navigate(resolveHomeRoute(user), { replace: true });
    }
  }, [user, navigate]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [paymentsRes, summaryRes] = await Promise.all([
        getPayments(),
        getPaymentsSummary(),
      ]);
      setPayments(Array.isArray(paymentsRes.data) ? paymentsRes.data : paymentsRes.data?.results || []);
      setSummary(summaryRes.data);
    } catch {
      setError("Unable to load payments right now.");
      setPayments([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (payment) => {
    if (!window.confirm(`Delete payment of Rs. ${formatMoney(payment.amount)} on ${payment.payment_date}?`)) {
      return;
    }
    try {
      await deletePayment(payment.id);
      await loadData();
    } catch {
      setError("Failed to delete payment");
    }
  };

  const handlePaymentRecorded = async () => {
    setModalOpen(false);
    await loadData();
  };

  return (
    <>
      <BusinessNav />
      <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "28px 24px", fontFamily: "Inter, system-ui" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#0f172a" }}>Payments Received</div>
            <div style={{ color: "#475569" }}>Track customer payments and collections.</div>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              color: "#ffffff",
              fontWeight: 800,
              border: "none",
              padding: "10px 14px",
              borderRadius: 10,
              background: "#059669",
              cursor: "pointer",
            }}
          >
            Record Payment
          </button>
        </div>

        {error && (
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid #fecdd3", background: "#fff1f2", color: "#b91c1c", fontWeight: 700 }}>
            {error}
          </div>
        )}

        {summary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, display: "grid", gap: 6 }}>
              <div style={{ color: "#475569", fontWeight: 700, fontSize: 13 }}>Total Collected</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#059669" }}>Rs. {formatMoney(summary.total_collected)}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{summary.payment_count} payments</div>
            </div>
          </div>
        )}

        {summary?.by_method && summary.by_method.length > 0 && (
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, display: "grid", gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Payments by Method</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
              {summary.by_method.map((method, idx) => {
                const methodColor = getPaymentMethodColor(method.payment_method);
                return (
                  <div key={idx} style={{ padding: 12, background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>{method.payment_method}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>
                      Rs. {formatMoney(method.total)}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{method.count} {method.count === 1 ? "payment" : "payments"}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 14, padding: 14, display: "grid", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a" }}>Payment History</div>
            <div style={{ color: "#475569" }}>All payments received from customers.</div>
          </div>

          {loading ? (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#f8fafc", padding: 12, display: "grid", gap: 8 }}>
              {[...Array(5)].map((_, idx) => (
                <div key={idx} style={{ height: 18, borderRadius: 8, background: "#e2e8f0" }} />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div style={{ padding: 14, borderRadius: 12, border: "1px dashed #cbd5e1", color: "#475569", textAlign: "center" }}>
              No payments recorded yet. Record your first payment.
            </div>
          ) : (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr", gap: 8, padding: "10px 14px", background: "#f8fafc", fontWeight: 800, color: "#0f172a", fontSize: 13 }}>
                <div>Date</div>
                <div>Customer</div>
                <div>Invoice</div>
                <div>Method</div>
                <div>Amount</div>
                <div style={{ textAlign: "right" }}>Actions</div>
              </div>
              {payments.map((payment) => {
                const methodColor = getPaymentMethodColor(payment.payment_method);
                return (
                  <div key={payment.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr", gap: 8, padding: "12px 14px", borderTop: "1px solid #e2e8f0", alignItems: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                      {new Date(payment.payment_date).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{payment.customer_name}</div>
                    <div style={{ fontSize: 13, color: "#475569" }}>{payment.sale_invoice}</div>
                    <div>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 8px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          background: methodColor.bg,
                          color: methodColor.text,
                        }}
                      >
                        {payment.payment_method}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#059669" }}>Rs. {formatMoney(payment.amount)}</div>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => handleDelete(payment)}
                        style={{
                          color: "#b91c1c",
                          fontWeight: 800,
                          border: "1px solid #fecdd3",
                          padding: "6px 10px",
                          borderRadius: 10,
                          background: "#fff1f2",
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <RecordPaymentModal open={modalOpen} onClose={() => setModalOpen(false)} onPaymentRecorded={handlePaymentRecorded} />
    </div>
    </>
  );
}
