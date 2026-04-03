import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { resolveHomeRoute, useAuth } from "../../context/AuthContext";
import { getDashboardData } from "../../api/dashboard";
import "./BusinessDashboard.css";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
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
      <div className="dashboard-container">
        <div className="loading-state">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error-state">{error}</div>
      </div>
    );
  }

  if (!dashboard) return null;

  const metrics = dashboard.metrics || {};
  const salesByStatus = dashboard.sales_by_status || {};
  const recentSales = dashboard.recent_credit_sales || [];
  const recentPayments = dashboard.recent_payments || [];
  const message = dashboard.message;

  if (message) {
    return (
      <div className="dashboard-container">
        <div className="onboarding-section">
          <div className="onboarding-card">
            <h2 className="onboarding-title">Complete Your Profile</h2>
            <p className="onboarding-message">{message}</p>
            <button
              className="onboarding-btn"
              onClick={() => navigate("/business/profile")}
            >
              Set Up Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">Business overview and key metrics</p>
        </div>
        <button
          className="dashboard-btn-primary"
          onClick={() => navigate("/business/credit-sales/create")}
        >
          New Credit Sale
        </button>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Sales</div>
          <div className="kpi-value">{formatCurrency(metrics.total_sales)}</div>
          <div className="kpi-hint">All credit sales</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Collected</div>
          <div className="kpi-value" style={{ color: "var(--positive)" }}>
            {formatCurrency(metrics.payments_collected)}
          </div>
          <div className="kpi-hint">Payments received</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Outstanding</div>
          <div className="kpi-value" style={{ color: "var(--negative)" }}>
            {formatCurrency(metrics.outstanding_credit)}
          </div>
          <div className="kpi-hint">Amount due</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Customers</div>
          <div className="kpi-value">{metrics.total_customers}</div>
          <div className="kpi-hint">Total customers</div>
        </div>
      </div>

      {/* Status Cards */}
      <div className="status-grid">
        <div className="status-card">
          <div className="status-label">Pending</div>
          <div className="status-value" style={{ color: "var(--accent)" }}>
            {salesByStatus.pending || 0}
          </div>
        </div>

        <div className="status-card">
          <div className="status-label">Partial Payments</div>
          <div className="status-value" style={{ color: "var(--accent)" }}>
            {salesByStatus.partial || 0}
          </div>
        </div>

        <div className="status-card">
          <div className="status-label">Settled</div>
          <div className="status-value" style={{ color: "var(--positive)" }}>
            {salesByStatus.paid || 0}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="activity-grid">
        {/* Recent Credit Sales */}
        <div className="activity-card">
          <div className="activity-header">
            <h2 className="activity-title">Recent Credit Sales</h2>
            <button
              className="activity-link"
              onClick={() => navigate("/business/credit-sales")}
            >
              View All →
            </button>
          </div>

          {recentSales.length === 0 ? (
            <div className="empty-state">No recent sales</div>
          ) : (
            <div className="table-wrapper">
              <table className="activity-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale) => (
                    <tr
                      key={sale.id}
                      onClick={() => navigate(`/business/credit-sales/${sale.id}`)}
                      className="table-row"
                    >
                      <td className="table-invoice">{sale.invoice_number}</td>
                      <td>{sale.customer_name}</td>
                      <td className="table-amount">{formatCurrency(sale.total_amount)}</td>
                      <td>
                        <span className={`status-badge status-${sale.status.toLowerCase()}`}>
                          {sale.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Payments */}
        <div className="activity-card">
          <div className="activity-header">
            <h2 className="activity-title">Recent Payments</h2>
            <button
              className="activity-link"
              onClick={() => navigate("/business/payments")}
            >
              View All →
            </button>
          </div>

          {recentPayments.length === 0 ? (
            <div className="empty-state">No recent payments</div>
          ) : (
            <div className="table-wrapper">
              <table className="activity-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((payment) => (
                    <tr key={payment.id} className="table-row">
                      <td>{payment.customer_name}</td>
                      <td>
                        <span className="payment-method">
                          {payment.payment_method}
                        </span>
                      </td>
                      <td className="table-amount" style={{ color: "var(--positive)" }}>
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="text-muted">
                        {new Date(payment.payment_date).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
