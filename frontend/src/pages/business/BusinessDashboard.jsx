import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { resolveHomeRoute, useAuth } from "../../context/AuthContext";
import { getDashboardData } from "../../api/dashboard";
import { getCreditSales } from "../../api/business";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import "./BusinessDashboard.css";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatCurrencyCompact = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(amount);
};

// Compute monthly revenue from sales records
const computeMonthlyRevenue = (sales) => {
  const monthlyMap = {};
  sales.forEach((sale) => {
    const date = new Date(sale.created_at);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyMap[monthKey]) monthlyMap[monthKey] = 0;
    const amount = Number(sale.total_amount) || 0;
    monthlyMap[monthKey] += amount;
  });

  const sorted = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6);

  return sorted.map(([month, amount]) => {
    const [year, mon] = month.split("-");
    const monthName = new Date(year, parseInt(mon) - 1).toLocaleDateString("en-IN", { month: "short" });
    return { month: monthName, revenue: Number(amount.toFixed(2)) };
  });
};

// Compute top customers by outstanding amount
const computeTopCustomers = (sales) => {
  const customerMap = {};
  sales.forEach((sale) => {
    const name = sale.customer_name || "Unknown";
    if (!customerMap[name]) customerMap[name] = 0;
    const amount = Number(sale.amount_due) || 0;
    customerMap[name] += amount;
  });

  return Object.entries(customerMap)
    .map(([name, amount]) => ({ name, amount: Number(amount.toFixed(2)) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
};

// Compute top products by sales count
const computeTopProducts = (sales) => {
  const productMap = {};
  sales.forEach((sale) => {
    if (sale.items && Array.isArray(sale.items)) {
      sale.items.forEach((item) => {
        const prodName = item.product_name || "Unknown";
        if (!productMap[prodName]) productMap[prodName] = 0;
        const qty = Number(item.quantity) || 0;
        productMap[prodName] += qty;
      });
    }
  });

  return Object.entries(productMap)
    .map(([name, sales]) => ({ name, sales: Number(sales) }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 4);
};

export default function BusinessDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [allSales, setAllSales] = useState([]);
  
  // Track in-flight request to prevent duplicates
  const requestAbortRef = useRef(null);
  const hasLoadedRef = useRef(false);

  // Compute chart data from real sales data
  const { monthlyTrend, topCustomers, topProducts } = useMemo(() => {
    if (!allSales.length) {
      return {
        monthlyTrend: [],
        topCustomers: [],
        topProducts: [],
      };
    }

    return {
      monthlyTrend: computeMonthlyRevenue(allSales),
      topCustomers: computeTopCustomers(allSales),
      topProducts: computeTopProducts(allSales),
    };
  }, [allSales]);

  // Load dashboard data once when user is available
  useEffect(() => {
    // Check auth and permissions
    if (!user) {
      setLoading(false);
      return;
    }

    if (user.account_type !== "BUSINESS") {
      navigate(resolveHomeRoute(user), { replace: true });
      return;
    }

    // Only load once per user session
    if (hasLoadedRef.current) {
      return;
    }

    hasLoadedRef.current = true;

    // Cancel any in-flight requests
    if (requestAbortRef.current) {
      requestAbortRef.current.abort();
    }

    const abortController = new AbortController();
    requestAbortRef.current = abortController;

    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        // Fetch both dashboard and sales data in parallel
        const [dashRes, salesRes] = await Promise.all([
          getDashboardData(),
          getCreditSales(),
        ]);

        // Check if request was cancelled
        if (abortController.signal.aborted) return;

        setDashboard(dashRes.data);
        const salesData = Array.isArray(salesRes.data)
          ? salesRes.data
          : salesRes.data?.results || [];
        setAllSales(salesData);
      } catch (err) {
        // Ignore if request was aborted
        if (err.name === "AbortError") return;
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();

    // Cleanup: cancel requests when component unmounts
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [user?.id, navigate]);  // Only re-run if user.id changes

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
          <div className="status-label">Pending Sales</div>
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
          <div className="status-label">Settled Sales</div>
          <div className="status-value" style={{ color: "var(--positive)" }}>
            {salesByStatus.paid || 0}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        {/* Monthly Revenue Trend */}
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title">Monthly Revenue Trend</h3>
            <p className="chart-subtitle">Historical sales</p>
          </div>
          {monthlyTrend.length === 0 ? (
            <div className="empty-state">No sales data yet. Create credit sales to see trends.</div>
          ) : (
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--muted)" }} stroke="var(--border)" />
                  <YAxis tickFormatter={formatCurrencyCompact} tick={{ fontSize: 12, fill: "var(--muted)" }} stroke="var(--border)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                    }}
                    formatter={(value) => formatCurrency(value)}
                    cursor={{ stroke: "var(--accent)", strokeWidth: 1 }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={{ fill: "#2563eb", r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Revenue"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top Customers */}
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title">Top Customers</h3>
            <p className="chart-subtitle">By outstanding amount</p>
          </div>
          {topCustomers.length === 0 ? (
            <div className="empty-state">No outstanding balances yet.</div>
          ) : (
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={topCustomers}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted)" }} stroke="var(--border)" />
                  <YAxis tickFormatter={formatCurrencyCompact} tick={{ fontSize: 12, fill: "var(--muted)" }} stroke="var(--border)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                    }}
                    formatter={(value) => formatCurrency(value)}
                    cursor={{ fill: "rgba(37, 99, 235, 0.1)" }}
                  />
                  <Bar dataKey="amount" radius={[8, 8, 0, 0]} fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Top Products Chart */}
      <div className="chart-card-full">
        <div className="chart-header">
          <h3 className="chart-title">Top Products</h3>
          <p className="chart-subtitle">By units sold</p>
        </div>
        {topProducts.length === 0 ? (
          <div className="empty-state">No products sold yet.</div>
        ) : (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: "var(--muted)" }} stroke="var(--border)" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: "var(--muted)" }} stroke="var(--border)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                  cursor={{ fill: "rgba(37, 99, 235, 0.1)" }}
                />
                <Bar dataKey="sales" radius={[0, 8, 8, 0]} fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recent Activity Header */}
      <div className="activity-section-header">
        <h2 className="activity-section-title">Recent Activity</h2>
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
