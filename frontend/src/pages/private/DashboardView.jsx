import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";

import {
  createPrivateItem,
  getPrivateItemReminders,
  getPrivateItems,
  getPrivateSummary,
  getPrivateTransactions,
  returnPrivateItem,
} from "../../api/private";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import AddItemModal from "./components/AddItemModal";
import ItemLoanSection from "./components/ItemLoanSection";
import "./PrivateDashboard.css";

const currency = (value) =>
  Number(value || 0).toLocaleString("ne-NP", { style: "currency", currency: "NPR", minimumFractionDigits: 2 });

const DebtComparisonTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="tooltip-card">
      <div className="tooltip-title">{name}</div>
      <div className="tooltip-value">{currency(value)}</div>
    </div>
  );
};

export default function DashboardView() {
  const { user, connections } = useOutletContext();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(null);
  const [itemsError, setItemsError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [spendError, setSpendError] = useState(null);
  const [remindersError, setRemindersError] = useState(null);
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

  const buildGmailLink = ({ to, subject, body }) => {
    const params = new URLSearchParams({
      view: "cm",
      fs: "1",
      to,
      su: subject,
      body,
    });
    return `https://mail.google.com/mail/?${params.toString()}`;
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setSummaryError(null);
      setItemsError(null);
      setSpendError(null);
      setRemindersError(null);
      try {
        const [summaryRes, itemsRes, txRes, remindersRes] = await Promise.all([
          getPrivateSummary(),
          getPrivateItems(),
          getPrivateTransactions(),
          getPrivateItemReminders(),
        ]);
        if (!active) return;
        setSummary(summaryRes.data);
        setItems(Array.isArray(itemsRes.data) ? itemsRes.data : itemsRes.data?.results || []);
        const txList = Array.isArray(txRes.data) ? txRes.data : txRes.data?.results || [];
        setTransactions(txList);
        setReminders(Array.isArray(remindersRes.data) ? remindersRes.data : remindersRes.data?.results || []);
      } catch (err) {
        console.error("Failed to load dashboard view", err);
        if (!active) return;
        setSummary(null);
        setItems([]);
        setTransactions([]);
        setReminders([]);
        setSummaryError("Unable to load summary.");
        setItemsError("Unable to load items.");
        setSpendError("Unable to load spending data.");
        setRemindersError("Unable to load return reminders.");
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

  // Active debts count
  const activeDebtsCount = useMemo(() => {
    return transactions.filter((tx) => {
      const type = (tx.transaction_type || tx.type || "").toString().toUpperCase();
      const status = (tx.status || "").toString().toUpperCase();
      return (type === "BORROWED" || type === "LENT") && status !== "SETTLED";
    }).length;
  }, [transactions]);

  // Lending vs Borrowing comparison for chart
  const debtComparison = useMemo(() => {
    const data = [
      { name: "You Are Owed", value: Math.abs(owed), fill: "#10b981" },
      { name: "You Owe", value: Math.abs(owes), fill: "#ef4444" },
    ];
    return data.filter((d) => d.value > 0);
  }, [owed, owes]);

  const handleReturnItem = async (loan) => {
    setItemsError(null);
    try {
      await returnPrivateItem(loan.id);
      const [{ data: itemsData }, { data: remindersData }] = await Promise.all([
        getPrivateItems(),
        getPrivateItemReminders(),
      ]);
      setItems(Array.isArray(itemsData) ? itemsData : itemsData?.results || []);
      setReminders(Array.isArray(remindersData) ? remindersData : remindersData?.results || []);
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
      const [{ data: itemsData }, { data: remindersData }] = await Promise.all([
        getPrivateItems(),
        getPrivateItemReminders(),
      ]);
      setItems(Array.isArray(itemsData) ? itemsData : itemsData?.results || []);
      setReminders(Array.isArray(remindersData) ? remindersData : remindersData?.results || []);
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
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>Money snapshot</div>
            {user?.email && <div className="pill">{user.email}</div>}
          </div>
          <button
            className="button"
            type="button"
            onClick={() => navigate("/private/payment-request")}
            style={{ whiteSpace: "nowrap" }}
          >
            💬 Request Payment
          </button>
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
            <div style={{ fontWeight: 800, fontSize: 18 }}>Debt Distribution</div>
          </div>
          <div className="pill">
            Active debts: {activeDebtsCount}
          </div>
        </div>

        {debtComparison.length === 0 ? (
          <div className="empty-state">No active debts. You are all settled up.</div>
        ) : (
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Tooltip content={<DebtComparisonTooltip />} />
                <Legend layout="vertical" align="right" verticalAlign="middle" />
                <Pie
                  data={debtComparison}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="50%"
                  outerRadius="85%"
                  paddingAngle={2}
                >
                  {debtComparison.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.fill} />
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

      <div className="section-card">
        <div className="section-heading">
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Return Reminder Timer</div>
            <div className="muted" style={{ fontSize: 14 }}>
              Items nearing their due date show up here so you can prepare reminder emails.
            </div>
          </div>
          <div className="pill">Due reminders: {reminders.length}</div>
        </div>
        {remindersError ? (
          <div className="error-text">{remindersError}</div>
        ) : reminders.length === 0 ? (
          <div className="empty-state">No item-return reminders are due right now.</div>
        ) : (
          <div className="list">
            {reminders.map((item) => {
              const dueDateText = item.expected_return_date
                ? new Date(item.expected_return_date).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "Not set";
              const timingLabel =
                item.due_status === "OVERDUE"
                  ? "Overdue"
                  : item.due_status === "DUE_SOON"
                    ? `Due in ${item.days_until_due} day${item.days_until_due === 1 ? "" : "s"}`
                    : "Reminder due";
              const gmailUrl = buildGmailLink({
                to: item.borrower_email,
                subject: `Return reminder for ${item.item_name}`,
                body: `Hello ${item.borrower_name || ""},\n\nThis is a reminder to return ${item.item_name}${
                  item.expected_return_date ? ` by ${dueDateText}` : ""
                }.\n\nPlease let me know once it has been returned.\n\nThanks.`,
              });

              return (
                <div key={item.id} className="row-card" style={{ gridTemplateColumns: "1.2fr 0.8fr auto auto" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{item.item_name}</div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {item.borrower_name} · Expected return {dueDateText}
                    </div>
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Timer: {item.reminder_interval_days} day{item.reminder_interval_days === 1 ? "" : "s"}
                  </div>
                  <div>
                    <span className={`badge ${item.due_status === "OVERDUE" ? "warning" : ""}`}>{timingLabel}</span>
                  </div>
                  <div className="row-actions">
                    <a className="button secondary sm" href={gmailUrl} target="_blank" rel="noreferrer">
                      Gmail
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
