import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext, useParams, useNavigate } from "react-router-dom";

import {
  createPrivateItem,
  createPrivateTransaction,
  getOrCreateDirectThread,
  getPrivateConnections,
  getPrivateItemReminders,
  getPrivateItems,
  getPrivateSummary,
  getPrivateTransactions,
  getThreadMessages,
  returnPrivateItem,
  sendThreadMessage,
} from "../../api/private";
import AddItemModal from "./components/AddItemModal";
import ChatPanel from "./components/ChatPanel";
import ActiveItemCard from "./components/ActiveItemCard";
import ReturnedItemCard from "./components/ReturnedItemCard";
import AddExpenseModal from "./modals/AddExpenseModal";
import SettleUpModal from "./modals/SettleUpModal";
import {
  buildGmailLink,
  connectionDisplayName,
  formatCurrency,
  formatShortDate,
  getConnectionBalanceMap,
  getConnectionTransactionMap,
  normalizeConnection,
} from "./privateShared";
import "./PrivateDashboard.css";

/**
 * FriendDetailView - The STRONGEST differentiation point.
 * Shows complete friend relationship: balance, expenses, items, reminders, chat.
 * Accessed via /private/friends/:id
 */
export default function FriendDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useOutletContext();
  const pollRef = useRef(null);

  const [allConnections, setAllConnections] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [items, setItems] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [savingSettle, setSavingSettle] = useState(false);
  const [actionError, setActionError] = useState(null);

  const [chatThread, setChatThread] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState(null);

  // Load all data on mount
  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [connRes, txRes, itemsRes, remindersRes, summaryRes] = await Promise.all([
          getPrivateConnections(),
          getPrivateTransactions(),
          getPrivateItems(),
          getPrivateItemReminders(),
          getPrivateSummary(),
        ]);
        if (!active) return;
        setAllConnections(Array.isArray(connRes.data) ? connRes.data : connRes.data?.results || []);
        setTransactions(Array.isArray(txRes.data) ? txRes.data : txRes.data?.results || []);
        setItems(Array.isArray(itemsRes.data) ? itemsRes.data : itemsRes.data?.results || []);
        setReminders(Array.isArray(remindersRes.data) ? remindersRes.data : remindersRes.data?.results || []);
        setSummary(summaryRes.data);
      } catch (err) {
        console.error("Failed to load friend detail", err);
        if (!active) return;
        setError("Unable to load friend details.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  // Find the selected friend
  const normalizedConnections = useMemo(() => allConnections.map(normalizeConnection), [allConnections]);
  const selectedFriend = useMemo(
    () => normalizedConnections.find((conn) => String(conn.id) === String(id)),
    [normalizedConnections, id]
  );

  // Compute balance
  const balances = useMemo(
    () => getConnectionBalanceMap(normalizedConnections, transactions),
    [normalizedConnections, transactions]
  );
  const transactionMap = useMemo(
    () => getConnectionTransactionMap(normalizedConnections, transactions),
    [normalizedConnections, transactions]
  );

  const friendBalance = balances[selectedFriend?.id] || 0;
  const friendTransactions = (transactionMap[selectedFriend?.id] || []).sort(
    (a, b) => new Date(b.transaction_date || 0).getTime() - new Date(a.transaction_date || 0).getTime()
  );
  const friendItems = items.filter((loan) => String(loan.borrower) === String(selectedFriend?.id));
  const activeItems = friendItems.filter((loan) => loan.status === "ACTIVE");
  const returnedItems = friendItems.filter((loan) => loan.status === "RETURNED");
  const dueReminders = reminders.filter((item) => String(item.borrower) === String(selectedFriend?.id));

  // Chat polling
  const loadChat = async (friendId) => {
    if (!friendId) return;
    if (pollRef.current) clearInterval(pollRef.current);
    setChatLoading(true);
    setChatError(null);
    setChatThread(null);
    setChatMessages([]);
    setChatInput("");

    try {
      const { data: thread } = await getOrCreateDirectThread({ user_id: friendId });
      setChatThread(thread);
      const { data: messages } = await getThreadMessages(thread.id);
      setChatMessages(messages);
    } catch (err) {
      console.error("Failed to load direct chat", err);
      setChatError("Unable to load chat right now.");
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedFriend?.id) return;
    loadChat(selectedFriend.id);
  }, [selectedFriend?.id]);

  useEffect(() => {
    if (!chatThread?.id) return;
    let cancelled = false;
    let polling = false;

    const refreshMessages = async () => {
      if (polling || document.visibilityState !== "visible") return;
      polling = true;
      try {
        const { data } = await getThreadMessages(chatThread.id);
        if (!cancelled) {
          setChatMessages(data);
        }
      } catch (err) {
        console.error("Failed to poll direct chat", err);
      } finally {
        polling = false;
      }
    };

    refreshMessages();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshMessages();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    pollRef.current = setInterval(refreshMessages, 15000);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [chatThread?.id]);

  const handleSendMessage = async (event) => {
    event?.preventDefault?.();
    if (!chatThread?.id || !chatInput.trim()) return;
    setChatSending(true);
    setChatError(null);
    try {
      await sendThreadMessage(chatThread.id, { message: chatInput.trim() });
      setChatInput("");
      const { data } = await getThreadMessages(chatThread.id);
      setChatMessages(data);
    } catch (err) {
      console.error("Failed to send direct chat message", err);
      setChatError("Unable to send message.");
    } finally {
      setChatSending(false);
    }
  };

  const refreshAfterMutation = async () => {
    try {
      const [txRes, itemsRes, remindersRes] = await Promise.all([
        getPrivateTransactions(),
        getPrivateItems(),
        getPrivateItemReminders(),
      ]);
      setTransactions(Array.isArray(txRes.data) ? txRes.data : txRes.data?.results || []);
      setItems(Array.isArray(itemsRes.data) ? itemsRes.data : itemsRes.data?.results || []);
      setReminders(Array.isArray(remindersRes.data) ? remindersRes.data : remindersRes.data?.results || []);
    } catch (err) {
      console.error("Failed to refresh after mutation", err);
      setActionError("Saved, but the latest balances could not be refreshed.");
    }
  };

  const labelForConnection = (connId) => {
    const friend = normalizedConnections.find((conn) => String(conn.id) === String(connId));
    return friend?.email || friend?.full_name || `User ${connId}`;
  };

  const handleSaveExpense = async ({ description, splits, date }) => {
    setSavingExpense(true);
    try {
      await Promise.all(
        splits.map((split) =>
          createPrivateTransaction({
            person_name: labelForConnection(split.id),
            amount: Number(split.amount.toFixed(2)),
            transaction_type: "LENT",
            transaction_date: date,
            note: [description || null, `Split ${split.percent.toFixed(1)}% them / ${(100 - split.percent).toFixed(1)}% you`]
              .filter(Boolean)
              .join(" | "),
          })
        )
      );
      setShowExpenseModal(false);
      await refreshAfterMutation();
    } finally {
      setSavingExpense(false);
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
      await refreshAfterMutation();
    } catch (err) {
      console.error("Failed to create private item", err);
      setActionError("Unable to save item.");
    } finally {
      setSavingItem(false);
    }
  };

  const handleReturnItem = async (loan) => {
    try {
      await returnPrivateItem(loan.id);
      await refreshAfterMutation();
    } catch (err) {
      console.error("Failed to return item", err);
      setActionError("Unable to mark this item as returned.");
    }
  };

  const handleSettle = async ({ connectionId, amount, direction }) => {
    setSavingSettle(true);
    try {
      await createPrivateTransaction({
        person_name: labelForConnection(connectionId),
        amount,
        transaction_type: direction === "you_owe" ? "LENT" : "BORROWED",
        transaction_date: new Date().toISOString().slice(0, 10),
        note: direction === "you_owe" ? "Settlement paid" : "Settlement received",
      });
      setShowSettleModal(false);
      await refreshAfterMutation();
    } finally {
      setSavingSettle(false);
    }
  };

  const selectedReminderLink = useMemo(() => {
    if (!selectedFriend?.email || !friendBalance) return "";
    const subject =
      friendBalance > 0 ? "Friendly reminder about pending balance" : "Settlement update";
    const body =
      friendBalance > 0
        ? `Hello,\n\nThis is a reminder that ${formatCurrency(friendBalance)} is still pending between us.\n\nPlease settle it when convenient.\n\nThanks.`
        : `Hello,\n\nThis is a quick note about the ${formatCurrency(Math.abs(friendBalance))} balance on my side.\n\nPlease let me know once it is settled.\n\nThanks.`;

    return buildGmailLink({
      to: selectedFriend.email,
      subject,
      body,
    });
  }, [selectedFriend, friendBalance]);

  const renderBalanceLabel = (balance) => {
    if (balance > 0) return `owes you ${formatCurrency(balance)}`;
    if (balance < 0) return `you owe ${formatCurrency(Math.abs(balance))}`;
    return "all settled up";
  };

  // Guard: friend not found
  if (!loading && !selectedFriend) {
    return (
      <div className="dashboard-shell">
        <div className="section-card">
          <div className="section-heading">
            <div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>Friend not found</div>
              <div className="muted" style={{ fontSize: 14 }}>
                This friend may have been removed from your connections.
              </div>
            </div>
            <button className="button" type="button" onClick={() => navigate("/private/friends")}>
              Back to friends
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="dashboard-shell">
        <div className="section-card">
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 16 }}>Loading friend details...</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[...Array(3)].map((_, i) => (
              <span key={i} className="skeleton" style={{ width: "100%", height: 100 }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const friendName = connectionDisplayName(selectedFriend);

  return (
    <div className="dashboard-shell">
      {/* Header with back button and actions */}
      <div className="section-card">
        <div className="section-heading friend-detail-header">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              className="button secondary"
              type="button"
              onClick={() => navigate("/private/friends")}
              title="Back to friends list"
            >
              ← Back
            </button>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{friendName}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                {selectedFriend.email || "No email on record"}
              </div>
            </div>
          </div>
          <div className="friend-detail-actions">
            <button className="button secondary sm" type="button" onClick={() => setShowExpenseModal(true)}>
              Add expense
            </button>
            <button className="button secondary sm" type="button" onClick={() => setShowItemModal(true)}>
              Lend item
            </button>
            <button className="button secondary sm" type="button" onClick={() => setShowSettleModal(true)}>
              Settle up
            </button>
            <button
              className="button sm"
              type="button"
              disabled={!selectedReminderLink}
              onClick={() => window.open(selectedReminderLink, "_blank", "noopener,noreferrer")}
            >
              Send reminder
            </button>
          </div>
        </div>
      </div>

      {/* Balance summary cards */}
      <div className="grid-3">
        <div className="summary-card">
          <div className="card-title">Current balance</div>
          <div className={`currency ${friendBalance > 0 ? "positive" : friendBalance < 0 ? "negative" : "primary"}`} style={{ marginTop: 6 }}>
            {formatCurrency(friendBalance)}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            {renderBalanceLabel(friendBalance)}
          </div>
        </div>
        <div className="summary-card">
          <div className="card-title">Expense history</div>
          <div style={{ fontWeight: 800, fontSize: 22, marginTop: 6 }}>
            {friendTransactions.length}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Money movements recorded
          </div>
        </div>
        <div className="summary-card">
          <div className="card-title">Active item loans</div>
          <div style={{ fontWeight: 800, fontSize: 22, marginTop: 6 }}>
            {activeItems.length}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            {dueReminders.length} pending return{dueReminders.length === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {actionError && <div className="error-text" style={{ marginBottom: 16 }}>{actionError}</div>}

      {/* Expense history section */}
      <div className="section-card">
        <div className="section-heading">
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Recent expenses</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Financial transactions between you two
            </div>
          </div>
        </div>
        {friendTransactions.length === 0 ? (
          <div className="empty-state">No recorded expenses with this friend yet.</div>
        ) : (
          <div className="list">
            {friendTransactions.slice(0, 8).map((tx) => {
              const isLent = tx.transaction_type === "LENT";
              return (
                <div key={tx.id} className="row-card detail-row">
                  <div>
                    <div style={{ fontWeight: 700 }}>{tx.note || "Expense"}</div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {formatShortDate(tx.transaction_date)}
                    </div>
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {isLent ? "You lent" : "You borrowed"}
                  </div>
                  <div className={`currency ${isLent ? "positive" : "negative"}`}>
                    {formatCurrency(tx.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Item lending and reminders side-by-side */}
      <div className="grid-2">
        <div className="section-card">
          <div className="section-heading">
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Item loans</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Items you've lent that are tracked
              </div>
            </div>
          </div>
          {friendItems.length === 0 ? (
            <div className="empty-state">No item loans with this friend yet.</div>
          ) : (
            <div className="stack compact-stack">
              {activeItems.map((loan) => (
                <ActiveItemCard
                  key={loan.id}
                  loan={loan}
                  borrowerLabel={friendName}
                  borrowerEmail={selectedFriend.email}
                  onReturn={handleReturnItem}
                />
              ))}
              {returnedItems.map((loan) => (
                <ReturnedItemCard
                  key={loan.id}
                  loan={loan}
                  borrowerLabel={friendName}
                />
              ))}
            </div>
          )}
        </div>

        <div className="section-card">
          <div className="section-heading">
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Return reminders</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Pending items awaiting return
              </div>
            </div>
          </div>
          {dueReminders.length === 0 ? (
            <div className="empty-state">No active return reminders for this friend.</div>
          ) : (
            <div className="list">
              {dueReminders.map((item) => (
                <div key={item.id} className="row-card detail-row">
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.item_name}</div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Expected {formatShortDate(item.expected_return_date, { year: "numeric" }) || "return date not set"}
                    </div>
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Timer {item.reminder_interval_days}d
                  </div>
                  <a
                    className="button secondary sm"
                    href={buildGmailLink({
                      to: item.borrower_email,
                      subject: `Return reminder for ${item.item_name}`,
                      body: `Hello,\n\nThis is a reminder to return ${item.item_name}.\n\nThanks.`,
                    })}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Email
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat panel */}
      <ChatPanel
        title={`Chat with ${friendName}`}
        subtitle="Direct messages stay connected to the balance relationship."
        loading={chatLoading}
        messages={chatMessages}
        inputValue={chatInput}
        onInputChange={setChatInput}
        onSend={handleSendMessage}
        sending={chatSending}
        currentUserEmail={user?.email}
        error={chatError}
      />

      {/* Modals */}
      <AddExpenseModal
        open={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        onSave={handleSaveExpense}
        connections={normalizedConnections}
        submitting={savingExpense}
        initialConnectionIds={selectedFriend ? [selectedFriend.id] : []}
        prefill={
          selectedFriend
            ? {
                description: `Expense with ${friendName}`,
                date: new Date().toISOString().slice(0, 10),
              }
            : null
        }
      />

      <AddItemModal
        open={showItemModal}
        onClose={() => setShowItemModal(false)}
        onSubmit={handleCreateItem}
        connections={normalizedConnections}
        submitting={savingItem}
        initialBorrowerId={selectedFriend?.id || ""}
      />

      <SettleUpModal
        open={showSettleModal}
        onClose={() => setShowSettleModal(false)}
        connections={normalizedConnections}
        balances={balances}
        onSubmit={handleSettle}
        submitting={savingSettle}
      />
    </div>
  );
}
