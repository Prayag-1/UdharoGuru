import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { resolveHomeRoute, useAuth } from "../../context/AuthContext";
import { getDashboardData } from "../../api/dashboard";
import BusinessNav from "../../components/BusinessNav";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
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

export default function BusinessDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    if (user.account_type !== "BUSINESS") {
      navigate(resolveHomeRoute(user), { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await getDashboardData();
        setDashboard(response.data);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "28px 24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#64748b" }}>Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "28px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ padding: 16, borderRadius: 12, border: "1px solid #fecdd3", background: "#fff1f2", color: "#b91c1c", fontWeight: 700 }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  const metrics = dashboard.metrics || {};
  const salesByStatus = dashboard.sales_by_status || {};
  const recentSales = dashboard.recent_credit_sales || [];
  const recentPayments = dashboard.recent_payments || [];
  const message = dashboard.message;

  // Show onboarding message if no profile exists
  if (message) {
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "28px 24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 500, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>
            Complete Your Profile
          </div>
          <div style={{ color: "#64748b", marginBottom: 24, fontSize: 15 }}>
            {message}
          </div>
          <a 
            href="/business/profile"
            style={{
              display: "inline-block",
              background: "#1e40af",
              color: "white",
              padding: "12px 24px",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Set Up Profile
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <BusinessNav />
      <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "28px 24px", fontFamily: "Inter, system-ui" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "grid", gap: 24 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>
                Dashboard
              </div>
              <div style={{ color: "#64748b", fontSize: 14 }}>
                Business overview and recent activity
              </div>
            </div>
            <button
              onClick={() => navigate("/business/ocr/upload")}
              style={{
                background: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)",
                color: "white",
                border: "none",
                padding: "12px 24px",
                borderRadius: 8,
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 8px 16px rgba(37, 99, 235, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <span style={{ fontSize: 18 }}>📸</span>
              <span>Upload Receipt</span>
            </button>
          </div>

          {/* KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            {/* Total Sales */}
            <div style={{ background: "#ffffff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                  Total Sales
                </div>
                <div style={{ fontSize: 24 }}>📊</div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a" }}>
                {formatCurrency(metrics.total_sales)}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
                All credit sales value
              </div>
            </div>

            {/* Payments Collected */}
            <div style={{ background: "#ffffff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                  Collected
                </div>
                <div style={{ fontSize: 24 }}>💚</div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#15803d" }}>
                {formatCurrency(metrics.payments_collected)}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
                Total payments received
              </div>
            </div>

            {/* Outstanding Credit */}
            <div style={{ background: "#ffffff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                  Outstanding
                </div>
                <div style={{ fontSize: 24 }}>⚠️</div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#b45309" }}>
                {formatCurrency(metrics.outstanding_credit)}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
                Amount still due
              </div>
            </div>

            {/* Total Customers */}
            <div style={{ background: "#ffffff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                  Customers
                </div>
                <div style={{ fontSize: 24 }}>👥</div>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#0f172a" }}>
                {metrics.total_customers}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>
                Active customers
              </div>
            </div>
          </div>

          {/* Sales Status */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <div style={{ background: "#ffffff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, marginBottom: 16, textTransform: "uppercase" }}>
                Pending Sales
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#b45309" }}>
                {salesByStatus.pending || 0}
              </div>
            </div>

            <div style={{ background: "#ffffff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, marginBottom: 16, textTransform: "uppercase" }}>
                Partial Payments
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#1e40af" }}>
                {salesByStatus.partial || 0}
              </div>
            </div>

            <div style={{ background: "#ffffff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, marginBottom: 16, textTransform: "uppercase" }}>
                Settled Sales
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#15803d" }}>
                {salesByStatus.paid || 0}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Recent Credit Sales */}
            <div style={{ background: "#ffffff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Recent Credit Sales</span>
                <button
                  onClick={() => navigate("/business/credit-sales")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#2563eb",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    textDecoration: "none",
                  }}
                >
                  View All →
                </button>
              </div>

              {recentSales.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 16px", color: "#a0aec0" }}>
                  No recent sales
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {recentSales.map((sale) => {
                    const statusColor = getStatusColor(sale.status);
                    return (
                      <div
                        key={sale.id}
                        onClick={() => navigate(`/business/credit-sales/${sale.id}`)}
                        style={{
                          padding: 12,
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          cursor: "pointer",
                          transition: "all 0.2s",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#f8fafc";
                          e.currentTarget.style.borderColor = "#cbd5e1";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.borderColor = "#e2e8f0";
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                            {sale.invoice_number}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                            {sale.customer_name}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                            {formatCurrency(sale.total_amount)}
                          </div>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "4px 8px",
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              background: statusColor.bg,
                              color: statusColor.text,
                              marginTop: 4,
                            }}
                          >
                            {statusColor.icon} {sale.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Payments */}
            <div style={{ background: "#ffffff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Recent Payments</span>
                <button
                  onClick={() => navigate("/business/payments")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#2563eb",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    textDecoration: "none",
                  }}
                >
                  View All →
                </button>
              </div>

              {recentPayments.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 16px", color: "#a0aec0" }}>
                  No recent payments
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {recentPayments.map((payment) => {
                    const methodIcons = {
                      CASH: "💵",
                      BANK_TRANSFER: "🏦",
                      CHEQUE: "✓",
                      MOBILE_MONEY: "📱",
                      OTHER: "📝",
                    };
                    return (
                      <div
                        key={payment.id}
                        style={{
                          padding: 12,
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                            {payment.customer_name}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                            {methodIcons[payment.payment_method] || "📝"} {payment.payment_method}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>
                            {formatCurrency(payment.amount)}
                          </div>
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                            {new Date(payment.payment_date).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
