import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import {
  createPrivateItem,
  getPrivateItems,
  getPrivateSummary,
  getPrivateTransactions,
  returnPrivateItem,
} from "../../api/private";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AddItemModal from "./components/AddItemModal";
import ItemLoanSection from "./components/ItemLoanSection";
import "./PrivateDashboard.css";

const currency = (value) =>
  Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const currencyCompact = (value) =>
  Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const CATEGORY_MAP = [
  { key: "food", label: "Food & Dining", color: "#4f7cf8" },
  { key: "travel", label: "Travel & Commute", color: "#34d399" },
  { key: "entertainment", label: "Entertainment", color: "#fb7185" },
  { key: "shopping", label: "Shopping", color: "#fbbf24" },
  { key: "utilities", label: "Utilities & Bills", color: "#a78bfa" },
  { key: "health", label: "Health & Wellness", color: "#22c55e" },
  { key: "other", label: "Other", color: "#94a3b8" },
];

const inferCategory = (tx) => {
  const cat = (tx.category || tx.type || "").toString().toLowerCase();
  const desc = (tx.description || "").toLowerCase();
  const text = `${cat} ${desc}`;
  if (/food|dining|restaurant|meal|lunch|dinner|grocer|cafe/.test(text)) return "food";
  if (/travel|flight|uber|cab|taxi|bus|train|fuel|gas/.test(text)) return "travel";
  if (/movie|show|netflix|prime|game|concert|event/.test(text)) return "entertainment";
  if (/shop|amazon|mall|retail|clothes|apparel|purchase/.test(text)) return "shopping";
  if (/bill|utility|electric|water|internet|rent|phone/.test(text)) return "utilities";
  if (/doctor|med|health|pharmacy|hospital|gym/.test(text)) return "health";
  return "other";
};

const parseDate = (tx) => {
  const raw = tx.date || tx.created_at || tx.createdAt || tx.timestamp;
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

const formatShortDate = (d) =>
  d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

const SpendingTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const { value } = payload[0];
  return (
    <div className="tooltip-card">
      <div className="tooltip-title">{label}</div>
      <div className="tooltip-value">{currency(value)}</div>
    </div>
  );
};

const TrendTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const { value } = payload[0];
  return (
    <div className="tooltip-card">
      <div className="tooltip-title">{label}</div>
      <div className="tooltip-value">{currency(value)}</div>
    </div>
  );
};

export default function DashboardView() {
  const { user, connections } = useOutletContext();
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(null);
  const [itemsError, setItemsError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [spendError, setSpendError] = useState(null);
  const [timeframe, setTimeframe] = useState("7d");
  const [showItemModal, setShowItemModal] = useState(false);
  const [savingItem, setSavingItem] = useState(false);

  const borrowerLookup = useMemo(() => {
    const map = {};
    connections.forEach((conn) => {
      const targetId = conn.connected_user_id || conn.connected_user?.id || conn.id;
      const targetEmail = conn.connected_user_email || conn.connected_user?.email || conn.email;
      if (targetId) map[targetId] = { email: targetEmail, full_name: conn.full_name };
    });
    return map;
  }, [connections]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setSummaryError(null);
      setItemsError(null);
      setSpendError(null);
      try {
        const [summaryRes, itemsRes, txRes] = await Promise.all([
          getPrivateSummary(),
          getPrivateItems(),
          getPrivateTransactions(),
        ]);
        if (!active) return;
        setSummary(summaryRes.data);
        setItems(Array.isArray(itemsRes.data) ? itemsRes.data : itemsRes.data?.results || []);
        const txList = Array.isArray(txRes.data) ? txRes.data : txRes.data?.results || [];
        setTransactions(txList);
      } catch (err) {
        console.error("Failed to load dashboard view", err);
        if (!active) return;
        setSummary(null);
        setItems([]);
        setTransactions([]);
        setSummaryError("Unable to load summary.");
        setItemsError("Unable to load items.");
        setSpendError("Unable to load spending data.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const net = useMemo(() => Number(summary?.net_balance || 0), [summary]);
  const owes = useMemo(() => Number(summary?.total_payable || 0), [summary]);
  const owed = useMemo(() => Number(summary?.total_receivable || 0), [summary]);

  const spending = useMemo(() => {
    const totals = CATEGORY_MAP.reduce((acc, c) => ({ ...acc, [c.key]: 0 }), {});
    transactions.forEach((tx) => {
      const amount = Math.abs(Number(tx.amount || 0));
      const type = (tx.transaction_type || tx.type || "").toUpperCase();
      const isOutflow = type === "DEBIT" || type === "PAYMENT" || Number(tx.amount || 0) < 0;
      if (!isOutflow || Number.isNaN(amount)) return;
      const catKey = inferCategory(tx);
      totals[catKey] = (totals[catKey] || 0) + amount;
    });
    const items = CATEGORY_MAP.map((cat) => ({ ...cat, amount: totals[cat.key] || 0 }));
    const totalSpent = items.reduce((sum, c) => sum + c.amount, 0);
    const max = Math.max(...items.map((c) => c.amount), 0.0001);
    const chartData = items.map((c) => ({
      name: c.label,
      amount: Number(c.amount.toFixed(2)),
      color: c.color,
    }));
    return { items, totalSpent, max, chartData };
  }, [transactions]);

  const trend = useMemo(() => {
    const days = timeframe === "30d" ? 30 : 7;
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - (days - 1));

    const buckets = Array.from({ length: days }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { date: d, total: 0 };
    });

    transactions.forEach((tx) => {
      const d = parseDate(tx);
      const amount = Math.abs(Number(tx.amount || 0));
      const type = (tx.transaction_type || tx.type || "").toUpperCase();
      const isOutflow = type === "DEBIT" || type === "PAYMENT" || Number(tx.amount || 0) < 0;
      if (!d || !isOutflow || Number.isNaN(amount)) return;
      if (d < start || d > now) return;
      const idx = Math.floor((d - start) / (1000 * 60 * 60 * 24));
      if (idx >= 0 && idx < buckets.length) {
        buckets[idx].total += amount;
      }
    });

    const max = Math.max(...buckets.map((b) => b.total), 0.0001);
    const chartData = buckets.map((b) => ({
      dateLabel: formatShortDate(b.date),
      total: Number(b.total.toFixed(2)),
    }));

    return { buckets, max, days, chartData };
  }, [transactions, timeframe]);

  const handleReturnItem = async (loan) => {
    setItemsError(null);
    try {
      await returnPrivateItem(loan.id);
      const { data } = await getPrivateItems();
      setItems(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      console.error("Failed to return item", err);
      setItemsError("Unable to mark as returned.");
    }
  };

  const handleCreateItem = async (payload) => {
    setSavingItem(true);
    try {
      await createPrivateItem({
        ...payload,
        borrower: Number(payload.borrower),
      });
      setShowItemModal(false);
      const { data } = await getPrivateItems();
      setItems(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      console.error("Failed to create item", err);
      setItemsError("Unable to save item.");
    } finally {
      setSavingItem(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-shell">
        <div className="section-card">
          <span className="skeleton" style={{ width: "60%", height: 18 }} />
        </div>
        <div className="grid-3">
          <span className="skeleton" style={{ width: "100%", height: 80 }} />
          <span className="skeleton" style={{ width: "100%", height: 80 }} />
          <span className="skeleton" style={{ width: "100%", height: 80 }} />
        </div>
        <div className="section-card">
          <span className="skeleton" style={{ width: "100%", height: 180 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <div className="section-card">
        <div className="section-heading" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>Money snapshot</div>
          {user?.email && <div className="pill">{user.email}</div>}
        </div>
        <div className="grid-3">
          <div className="summary-card">
            <div className="card-title" title="People owe you this amount">Due to you</div>
            <div className="currency positive" style={{ marginTop: 6 }}>{currency(owed)}</div>
          </div>
          <div className="summary-card">
            <div className="card-title" title="You owe this amount to others">You need to pay</div>
            <div className="currency negative" style={{ marginTop: 6 }}>{currency(owes)}</div>
          </div>
          <div className="summary-card">
            <div className="card-title" title="Receivable minus payable">Net position</div>
            <div className={`currency ${net > 0 ? "positive" : net < 0 ? "negative" : "primary"}`} style={{ marginTop: 6 }}>
              {currency(net)}
            </div>
          </div>
        </div>
        {net === 0 && (
          <div className="pill" style={{ marginTop: 12 }}>
            You are all settled up
          </div>
        )}
        {summaryError && <div className="error-text">{summaryError}</div>}
      </div>

      <div className="section-card">
        <div className="section-heading">
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Spending trend</div>
          </div>
          <div className="pill" style={{ gap: 10 }}>
            <button
              type="button"
              className={`chip ${timeframe === "7d" ? "chip-active" : ""}`}
              onClick={() => setTimeframe("7d")}
            >
              Last 7 days
            </button>
            <button
              type="button"
              className={`chip ${timeframe === "30d" ? "chip-active" : ""}`}
              onClick={() => setTimeframe("30d")}
            >
              Last 30 days
            </button>
          </div>
        </div>

        {spendError && <div className="error-text">{spendError}</div>}

        {trend.buckets.every((b) => b.total === 0) ? (
          <div className="empty-state">No spend yet in this window. Add transactions to see the trend.</div>
        ) : (
          <div className="line-chart">
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={trend.chartData} margin={{ left: 0, right: 12, top: 10, bottom: 10 }}>
                  <defs>
                    <linearGradient id="lineArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(79,124,248,0.35)" />
                      <stop offset="100%" stopColor="rgba(79,124,248,0.02)" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: "#475569" }} />
                  <YAxis tickFormatter={currencyCompact} tick={{ fontSize: 11, fill: "#475569" }} />
                  <Tooltip content={<TrendTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#4f7cf8"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    fillOpacity={1}
                    fill="url(#lineArea)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="line-chart-legend">
              <span className="muted" style={{ fontSize: 12 }}>
                Peak: {currency(trend.max)}
              </span>
              <span className="muted" style={{ fontSize: 12 }}>
                Total: {currency(trend.buckets.reduce((s, b) => s + b.total, 0))}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="section-card">
        <div className="section-heading">
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Spending by category</div>
          </div>
          <div className="pill" title="Total outgoing across all categories">
            Total spent: {currency(spending.totalSpent)}
          </div>
        </div>

        {spendError && <div className="error-text">{spendError}</div>}

        {spending.totalSpent === 0 ? (
          <div className="empty-state">No spending recorded yet. Add transactions to see the breakdown.</div>
        ) : (
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={spending.chartData} margin={{ left: 0, right: 0, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#475569" }} />
                <YAxis tickFormatter={currencyCompact} tick={{ fontSize: 12, fill: "#475569" }} />
                <Tooltip content={<SpendingTooltip />} cursor={{ fill: "rgba(79,124,248,0.06)" }} />
                <Bar dataKey="amount" radius={[6, 6, 6, 6]}>
                  {spending.chartData.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="section-card">
        <div className="section-heading">
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Item Lending</div>
          </div>
          <button className="button" type="button" onClick={() => setShowItemModal(true)}>
            Add an item
          </button>
        </div>
        <ItemLoanSection
          items={items}
          loading={false}
          error={itemsError}
          borrowerLookup={borrowerLookup}
          onAddItem={() => setShowItemModal(true)}
          onReturn={handleReturnItem}
        />
      </div>

      <AddItemModal
        open={showItemModal}
        onClose={() => setShowItemModal(false)}
        onSubmit={handleCreateItem}
        connections={connections.map((conn) => {
          const target = conn.connected_user || {};
          return {
            id: conn.connected_user_id || target.id || conn.id,
            email: conn.connected_user_email || target.email || conn.email,
            full_name: target.full_name || conn.full_name,
          };
        })}
        submitting={savingItem}
      />
    </div>
  );
}
