import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import {
  getGroups,
  getPrivateItemReminders,
  getPrivateItems,
  getPrivateSummary,
  getPrivateTransactions,
} from "../../api/private";
import {
  connectionDisplayName,
  formatCurrency,
  formatDateTime,
  formatShortDate,
  getConnectionBalanceMap,
  normalizeConnection,
} from "./privateShared";
import "./PrivateDashboard.css";

const FILTERS = ["All", "Reminders", "Settlements", "Insights"];

const DebtComparisonTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="tooltip-card">
      <div className="tooltip-title">{name}</div>
      <div className="tooltip-value">{formatCurrency(value)}</div>
    </div>
  );
};

export default function ActivityView() {
  const { user, connections, notifications } = useOutletContext();
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [items, setItems] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("All");

  const normalizedConnections = useMemo(() => connections.map(normalizeConnection), [connections]);
  const balances = useMemo(
    () => getConnectionBalanceMap(normalizedConnections, transactions),
    [normalizedConnections, transactions]
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [summaryRes, txRes, itemsRes, remindersRes, groupsRes] = await Promise.all([
          getPrivateSummary(),
          getPrivateTransactions(),
          getPrivateItems(),
          getPrivateItemReminders(),
          getGroups(),
        ]);

        if (!active) return;

        setSummary(summaryRes.data);
        setTransactions(Array.isArray(txRes.data) ? txRes.data : txRes.data?.results || []);
        setItems(Array.isArray(itemsRes.data) ? itemsRes.data : itemsRes.data?.results || []);
        setReminders(Array.isArray(remindersRes.data) ? remindersRes.data : remindersRes.data?.results || []);
        setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : groupsRes.data?.results || []);
      } catch (err) {
        console.error("Failed to load private activity", err);
        if (!active) return;
        setSummary(null);
        setTransactions([]);
        setItems([]);
        setReminders([]);
        setGroups([]);
        setError("Unable to load private activity.");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const activityFeed = useMemo(() => {
    const transactionEvents = transactions.map((tx) => {
      const isSettlement = (tx.note || "").toLowerCase().includes("settlement");
      return {
        id: `tx-${tx.id}`,
        kind: isSettlement ? "Settlements" : "All",
        title: isSettlement ? "Settlement recorded" : "Expense updated",
        description: `${tx.person_name} · ${tx.transaction_type === "LENT" ? "You lent" : "You borrowed"} ${formatCurrency(tx.amount)}`,
        meta: tx.note || "Private transaction",
        timestamp: tx.transaction_date,
      };
    });

    const reminderEvents = reminders.map((item) => ({
      id: `reminder-${item.id}`,
      kind: "Reminders",
      title: item.due_status === "OVERDUE" ? "Item reminder overdue" : "Item reminder due",
      description: `${item.item_name} · ${item.borrower_name || "Friend"}`,
      meta: item.expected_return_date
        ? `Expected return ${formatShortDate(item.expected_return_date, { year: "numeric" })}`
        : "No return date set",
      timestamp: item.expected_return_date || item.lent_date,
    }));

    const itemEvents = items
      .filter((loan) => loan.status === "ACTIVE")
      .map((loan) => ({
        id: `item-${loan.id}`,
        kind: "All",
        title: "Item lent",
        description: `${loan.item_name} · Borrower #${loan.borrower}`,
        meta: loan.lent_date ? `Lent on ${formatShortDate(loan.lent_date, { year: "numeric" })}` : "Active item loan",
        timestamp: loan.lent_date,
      }));

    const groupEvents = groups.map((group) => ({
      id: `group-${group.id}`,
      kind: "All",
      title: "Group active",
      description: group.name,
      meta: `${group.member_count} members · ${group.role}`,
      timestamp: group.created_at,
    }));

    const notificationEvents = notifications.map((notification) => ({
      id: `notification-${notification.id}`,
      kind: notification.message?.toLowerCase().includes("reminder") ? "Reminders" : "All",
      title: notification.is_read ? "Notification" : "New notification",
      description: notification.message,
      meta: notification.sender_name || "System",
      timestamp: notification.created_at,
    }));

    return [...transactionEvents, ...reminderEvents, ...itemEvents, ...groupEvents, ...notificationEvents]
      .filter((entry) => entry.timestamp)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [groups, items, notifications, reminders, transactions]);

  const filteredFeed = useMemo(() => {
    if (filter === "All") return activityFeed;
    if (filter === "Insights") return activityFeed;
    return activityFeed.filter((entry) => entry.kind === filter);
  }, [activityFeed, filter]);

  const topFriends = useMemo(() => {
    return normalizedConnections
      .map((conn) => ({
        id: conn.id,
        label: connectionDisplayName(conn),
        balance: Number(balances[conn.id] || 0),
      }))
      .filter((entry) => entry.balance !== 0)
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
      .slice(0, 5);
  }, [balances, normalizedConnections]);

  const debtComparison = useMemo(() => {
    const owed = Math.abs(Number(summary?.total_receivable || 0));
    const owes = Math.abs(Number(summary?.total_payable || 0));
    return [
      { name: "You are owed", value: owed, fill: "#10b981" },
      { name: "You owe", value: owes, fill: "#ef4444" },
    ].filter((entry) => entry.value > 0);
  }, [summary]);

  const settlementsThisMonth = useMemo(() => {
    const now = new Date();
    return transactions.filter((tx) => {
      const txDate = new Date(tx.transaction_date || 0);
      return (
        tx.note?.toLowerCase().includes("settlement") &&
        txDate.getMonth() === now.getMonth() &&
        txDate.getFullYear() === now.getFullYear()
      );
    }).length;
  }, [transactions]);

  return (
    <div className="dashboard-shell">
      <div className="section-card">
        <div className="section-heading">
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>Activity</div>
            <div className="muted" style={{ fontSize: 14 }}>
              History, reminders, and insights stay here so the Friends tab remains operational and clean.
            </div>
          </div>
          {user?.email && <div className="pill">{user.email}</div>}
        </div>

        <div className="chip-row">
          {FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              className={`chip ${filter === option ? "chip-active" : ""}`}
              onClick={() => setFilter(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-3">
        <div className="summary-card">
          <div className="card-title">Total owed to you</div>
          <div className="currency positive" style={{ marginTop: 6 }}>
            {formatCurrency(summary?.total_receivable || 0)}
          </div>
        </div>
        <div className="summary-card">
          <div className="card-title">Total you owe</div>
          <div className="currency negative" style={{ marginTop: 6 }}>
            {formatCurrency(summary?.total_payable || 0)}
          </div>
        </div>
        <div className="summary-card">
          <div className="card-title">Settlements this month</div>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>{settlementsThisMonth}</div>
        </div>
      </div>

      {(filter === "All" || filter === "Insights") && (
        <div className="grid-2">
          <div className="section-card">
            <div className="section-heading">
              <div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>Debt distribution</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  The existing analytics stay visible here instead of cluttering the home screen.
                </div>
              </div>
            </div>
            {debtComparison.length === 0 ? (
              <div className="empty-state">No active debt insights yet.</div>
            ) : (
              <div style={{ width: "100%", height: "auto", minHeight: 200, maxHeight: 280 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Tooltip content={<DebtComparisonTooltip />} />
                    <Legend layout="vertical" align="right" verticalAlign="middle" />
                    <Pie data={debtComparison} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="84%">
                      {debtComparison.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="section-card">
            <div className="section-heading">
              <div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>Top friends by outstanding balance</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  Strongest signals first, without adding extra dashboard noise.
                </div>
              </div>
            </div>
            {topFriends.length === 0 ? (
              <div className="empty-state">No outstanding balances yet.</div>
            ) : (
              <div className="list">
                {topFriends.map((friend) => (
                  <div key={friend.id} className="row-card detail-row">
                    <div style={{ fontWeight: 700 }}>{friend.label}</div>
                    <div className={`currency ${friend.balance > 0 ? "positive" : "negative"}`}>
                      {friend.balance > 0 ? formatCurrency(friend.balance) : formatCurrency(Math.abs(friend.balance))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="insight-meta-grid">
              <div className="summary-card">
                <div className="card-title">Pending reminders</div>
                <div style={{ fontWeight: 800, fontSize: 22, marginTop: 6 }}>{reminders.length}</div>
              </div>
              <div className="summary-card">
                <div className="card-title">Pending item returns</div>
                <div style={{ fontWeight: 800, fontSize: 22, marginTop: 6 }}>
                  {items.filter((loan) => loan.status === "ACTIVE").length}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="section-card">
        <div className="section-heading">
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>
              {filter === "Insights" ? "Recent activity snapshot" : "Recent private activity"}
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              Expenses, settlements, reminder states, groups, and notifications in one chronological view.
            </div>
          </div>
        </div>

        {loading ? (
          <div className="list">
            {[...Array(4)].map((_, index) => (
              <span key={index} className="skeleton" style={{ width: "100%", height: 72 }} />
            ))}
          </div>
        ) : error ? (
          <div className="error-text">{error}</div>
        ) : filteredFeed.length === 0 ? (
          <div className="empty-state">No activity matches this filter yet.</div>
        ) : (
          <div>
            {(() => {
              // Group activity by kind for better visual organization
              const grouped = {};
              filteredFeed.forEach((entry) => {
                if (!grouped[entry.kind]) grouped[entry.kind] = [];
                grouped[entry.kind].push(entry);
              });

              const kindOrder = ["Reminders", "Settlements", "All"];
              const orderedKinds = kindOrder.filter((k) => grouped[k]);

              return orderedKinds.map((kind) => (
                <div key={kind} style={{ marginBottom: 16 }}>
                  {orderedKinds.length > 1 && (
                    <div className="activity-group-header">
                      <div className="activity-group-label">
                        {kind === "Reminders" && "🔔 Reminders"}
                        {kind === "Settlements" && "✅ Settlements"}
                        {kind === "All" && "💰 Activity"}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {grouped[kind].length} item{grouped[kind].length === 1 ? "" : "s"}
                      </div>
                    </div>
                  )}
                  <div className="list">
                    {grouped[kind].slice(0, 12).map((entry) => (
                      <div key={entry.id} className="row-card activity-row">
                        <div>
                          <div style={{ fontWeight: 700 }}>{entry.title}</div>
                          <div className="muted" style={{ fontSize: 13 }}>{entry.description}</div>
                        </div>
                        <div className="muted" style={{ fontSize: 13 }}>{entry.meta}</div>
                        <div className="pill">{formatDateTime(entry.timestamp)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
