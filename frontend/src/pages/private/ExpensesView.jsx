import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { createPrivateTransaction, getPrivateTransactions } from "../../api/private";
import AddExpenseModal from "./modals/AddExpenseModal";
import ExpenseDetailModal from "./modals/ExpenseDetailModal";
import SettleUpModal from "./modals/SettleUpModal";
import "./PrivateDashboard.css";

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const monthMeta = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { label: "UNKNOWN", order: 0 };
  const label = d.toLocaleDateString(undefined, { month: "long", year: "numeric" }).toUpperCase();
  const order = Number(new Date(d.getFullYear(), d.getMonth(), 1));
  return { label, order };
};

const normalizeConnection = (conn) => {
  const target = conn.connected_user || {};
  return {
    id: conn.connected_user_id || target.id || conn.id,
    email: conn.connected_user_email || target.email || conn.email,
    full_name: target.full_name || conn.full_name,
  };
};

export default function ExpensesView() {
  const { connections } = useOutletContext();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [detailTx, setDetailTx] = useState(null);
  const [savingExpense, setSavingExpense] = useState(false);
  const [savingSettle, setSavingSettle] = useState(false);

  const normalizedConnections = useMemo(() => connections.map(normalizeConnection), [connections]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await getPrivateTransactions();
        if (!active) return;
        setTransactions(Array.isArray(data) ? data : data?.results || []);
      } catch (err) {
        console.error("Failed to load expenses", err);
        if (!active) return;
        setTransactions([]);
        setError("Unable to load expenses.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const connectionBalances = useMemo(() => {
    const map = {};
    transactions.forEach((tx) => {
      const key = (tx.person_name || "").toLowerCase();
      const amount = Number(tx.amount || 0);
      const delta = tx.transaction_type === "LENT" ? amount : -amount;
      map[key] = (map[key] || 0) + delta;
    });
    const byId = {};
    normalizedConnections.forEach((conn) => {
      const key = (conn.email || conn.full_name || `user-${conn.id}`).toLowerCase();
      byId[conn.id] = map[key] || 0;
    });
    return byId;
  }, [normalizedConnections, transactions]);

  const groups = useMemo(() => {
    const grouped = {};
    const orders = {};
    transactions.forEach((tx) => {
      const { label, order } = monthMeta(tx.transaction_date);
      if (!grouped[label]) grouped[label] = [];
      grouped[label].push(tx);
      orders[label] = order;
    });
    return Object.entries(grouped).sort((a, b) => (orders[a[0]] < orders[b[0]] ? 1 : -1));
  }, [transactions]);

  const refreshTransactions = async () => {
    try {
      const { data } = await getPrivateTransactions();
      setTransactions(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      console.error("Failed to refresh transactions", err);
      setError("Unable to load expenses.");
    }
  };

  const labelForConnection = (id) => {
    const conn = normalizedConnections.find((c) => String(c.id) === String(id));
    return conn?.email || conn?.full_name || `User ${id}`;
  };

  const handleSaveExpense = async ({ description, amount, borrower, date }) => {
    setSavingExpense(true);
    try {
      const personName = labelForConnection(borrower);
      await createPrivateTransaction({
        person_name: personName,
        amount,
        transaction_type: "LENT",
        transaction_date: date,
        note: description || null,
      });
      setShowAdd(false);
      await refreshTransactions();
    } finally {
      setSavingExpense(false);
    }
  };

  const handleSettle = async ({ connectionId, amount }) => {
    setSavingSettle(true);
    try {
      const personName = labelForConnection(connectionId);
      await createPrivateTransaction({
        person_name: personName,
        amount,
        transaction_type: "BORROWED",
        transaction_date: new Date().toISOString().slice(0, 10),
        note: "Settlement",
      });
      setShowSettle(false);
      await refreshTransactions();
    } finally {
      setSavingSettle(false);
    }
  };

  return (
    <div className="dashboard-shell">
      <div className="section-heading" style={{ marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>All expenses</div>
          <div className="muted">Splitwise-style feed of your private transactions</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="button secondary" type="button" onClick={() => setShowSettle(true)}>
            Settle up
          </button>
          <button className="button" type="button" onClick={() => setShowAdd(true)}>
            Add an expense
          </button>
        </div>
      </div>

      {loading ? (
        <div className="section-card">
          <div className="list">
            <span className="skeleton" style={{ width: "100%", height: 70 }} />
            <span className="skeleton" style={{ width: "100%", height: 70 }} />
          </div>
        </div>
      ) : error ? (
        <div className="error-text">{error}</div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">No expenses yet.</div>
      ) : (
        groups.map(([month, items]) => (
          <div key={month} className="section-card">
            <div className="label" style={{ fontSize: 12, letterSpacing: 0.8 }}>{month}</div>
            <div className="list">
              {items.map((tx) => {
                const isLent = tx.transaction_type === "LENT";
                return (
                  <div
                    key={tx.id}
                    className="row-card"
                    style={{ gridTemplateColumns: "0.7fr 1.5fr 1fr 1fr", cursor: "pointer" }}
                    onClick={() => setDetailTx(tx)}
                  >
                    <div className="muted">{formatDate(tx.transaction_date)}</div>
                    <div>
                      <div style={{ fontWeight: 800 }}>{tx.person_name}</div>
                      <div className="muted" style={{ fontSize: 13 }}>{tx.note || "No description"}</div>
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {isLent ? "You lent" : "You borrowed"}
                    </div>
                    <div className="currency" style={{ color: isLent ? "#0b7a34" : "#b91c1c" }}>
                      {formatCurrency(tx.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <AddExpenseModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={handleSaveExpense}
        connections={normalizedConnections}
        submitting={savingExpense}
      />

      <SettleUpModal
        open={showSettle}
        onClose={() => setShowSettle(false)}
        connections={normalizedConnections}
        balances={connectionBalances}
        onSubmit={handleSettle}
        submitting={savingSettle}
      />

      <ExpenseDetailModal open={Boolean(detailTx)} onClose={() => setDetailTx(null)} expense={detailTx} />
    </div>
  );
}
