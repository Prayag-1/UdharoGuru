import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCreditSales, getCreditSalesSummary } from "../../api/creditSales";
import { resolveHomeRoute, useAuth } from "../../context/AuthContext";

const formatMoney = (value) => {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return "0.00";
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getStatusColor = (status) => {
  switch (status) {
    case "PENDING":
      return { bg: "#fef3c7", text: "#b45309" };
    case "PARTIAL":
      return { bg: "#dbeafe", text: "#1e40af" };
    case "PAID":
      return { bg: "#dcfce7", text: "#15803d" };
    default:
      return { bg: "#f3f4f6", text: "#374151" };
  }
};

export default function CreditSalesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sales, setSales] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      const [salesRes, summaryRes] = await Promise.all([
        getCreditSales(),
        getCreditSalesSummary(),
      ]);
      setSales(Array.isArray(salesRes.data) ? salesRes.data : salesRes.data?.results || []);
      setSummary(summaryRes.data);
    } catch {
      setError("Unable to load credit sales right now.");
      setSales([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "28px 24px", fontFamily: "Inter, system-ui" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#0f172a" }}>Credit Sales</div>
            <div style={{ color: "#475569" }}>Track and manage credit sales to customers.</div>
          </div>
          <button
            onClick={() => navigate("/business/credit-sales/create")}
            style={{
              color: "#ffffff",
              fontWeight: 800,
              border: "none",
              padding: "10px 14px",
              borderRadius: 10,
              background: "#2563eb",
              cursor: "pointer",
            }}
          >
            New Sale
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
              <div style={{ color: "#475569", fontWeight: 700, fontSize: 13 }}>Total Sales</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Rs. {formatMoney(summary.total_sales)}</div>
            </div>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, display: "grid", gap: 6 }}>
              <div style={{ color: "#475569", fontWeight: 700, fontSize: 13 }}>Total Collected</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#059669" }}>Rs. {formatMoney(summary.total_paid)}</div>
            </div>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, display: "grid", gap: 6 }}>
              <div style={{ color: "#475569", fontWeight: 700, fontSize: 13 }}>Outstanding</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#d97706" }}>Rs. {formatMoney(summary.total_due)}</div>
            </div>
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, display: "grid", gap: 6 }}>
              <div style={{ color: "#475569", fontWeight: 700, fontSize: 13 }}>Status Overview</div>
              <div style={{ fontSize: 12, color: "#64748b", display: "grid", gap: 3 }}>
                <div>Pending: {summary.pending_count}</div>
                <div>Partial: {summary.partial_count}</div>
                <div>Paid: {summary.paid_count}</div>
              </div>
            </div>
          </div>
        )}

        <div style={{ border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 14, padding: 14, display: "grid", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a" }}>Recent Credit Sales</div>
            <div style={{ color: "#475569" }}>All credit sales and payment status.</div>
          </div>

          {loading ? (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#f8fafc", padding: 12, display: "grid", gap: 8 }}>
              {[...Array(5)].map((_, idx) => (
                <div key={idx} style={{ height: 18, borderRadius: 8, background: "#e2e8f0" }} />
              ))}
            </div>
          ) : sales.length === 0 ? (
            <div style={{ padding: 14, borderRadius: 12, border: "1px dashed #cbd5e1", color: "#475569", textAlign: "center" }}>
              No credit sales yet. Create your first credit sale.
            </div>
          ) : (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr 1fr", gap: 8, padding: "10px 14px", background: "#f8fafc", fontWeight: 800, color: "#0f172a", fontSize: 13 }}>
                <div>Invoice</div>
                <div>Customer</div>
                <div>Total</div>
                <div>Paid</div>
                <div>Due</div>
                <div style={{ textAlign: "right" }}>Status</div>
              </div>
              {sales.map((sale) => {
                const statusColor = getStatusColor(sale.status);
                return (
                  <div
                    key={sale.id}
                    onClick={() => navigate(`/business/credit-sales/${sale.id}`)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr 1fr",
                      gap: 8,
                      padding: "12px 14px",
                      borderTop: "1px solid #e2e8f0",
                      alignItems: "center",
                      cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff")}
                  >
                    <div style={{ display: "grid", gap: 2 }}>
                      <span style={{ fontWeight: 800, color: "#0f172a" }}>{sale.invoice_number}</span>
                      <span style={{ fontSize: 12, color: "#64748b" }}>{new Date(sale.created_at).toLocaleDateString()}</span>
                    </div>
                    <div style={{ color: "#0f172a", fontWeight: 700 }}>{sale.customer_name}</div>
                    <div style={{ color: "#0f172a" }}>Rs. {formatMoney(sale.total_amount)}</div>
                    <div style={{ color: "#059669", fontWeight: 700 }}>Rs. {formatMoney(sale.amount_paid)}</div>
                    <div style={{ color: "#d97706", fontWeight: 700 }}>Rs. {formatMoney(sale.amount_due)}</div>
                    <div style={{ textAlign: "right" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 8px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          background: statusColor.bg,
                          color: statusColor.text,
                        }}
                      >
                        {sale.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
