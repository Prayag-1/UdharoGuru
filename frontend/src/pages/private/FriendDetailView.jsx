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
import { sendDebtReminder, sendItemReminder } from "../../utils/whatsapp";
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

  // Tab state for organized content
  const [selectedTab, setSelectedTab] = useState("expenses");

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

  // Helper to determine reminder status badge
  const getReminderStatusBadge = (reminder) => {
    const daysUntilDue = reminder.expected_return_date
      ? Math.ceil((new Date(reminder.expected_return_date) - new Date()) / (1000 * 60 * 60 * 24))
      : null;
    
    if (reminder.due_status === "OVERDUE") {
      return { label: "Overdue", className: "reminder-badge-overdue" };
    }
    if (daysUntilDue !== null && daysUntilDue <= 3 && daysUntilDue > 0) {
      return { label: `Due in ${daysUntilDue}d`, className: "reminder-badge-warning" };
    }
    if (daysUntilDue !== null && daysUntilDue > 0) {
      return { label: `Due in ${daysUntilDue}d`, className: "reminder-badge-info" };
    }
    return { label: "Pending", className: "reminder-badge-default" };
  };

  // Tab content renderers
  const renderExpensesTab = () => (
    <div className="section-card">
      <div className="section-heading">
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Expense history</div>
          <div className="muted" style={{ fontSize: 13 }}>
            Record of all money movements between you two
          </div>
        </div>
      </div>
      {friendTransactions.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>No expenses yet</div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            When you split costs or lend money, it will appear here.
          </div>
          <button 
            className="button secondary sm" 
            type="button" 
            onClick={() => setShowExpenseModal(true)}
          >
            Record first expense
          </button>
        </div>
      ) : (
        <div className="list">
          {friendTransactions.map((tx) => {
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
  );

  const renderItemsTab = () => {
    const friendLabel = connectionDisplayName(selectedFriend);
    return (
      <div>
        {activeItems.length > 0 && (
          <div className="section-card">
            <div className="section-heading">
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Lent items</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  Items currently with {friendLabel}
                </div>
              </div>
            </div>
            <div className="stack compact-stack">
              {activeItems.map((loan) => (
                <ActiveItemCard
                  key={loan.id}
                  loan={loan}
                  borrowerLabel={friendLabel}
                  borrowerEmail={selectedFriend.email}
                  onReturn={handleReturnItem}
                />
              ))}
            </div>
          </div>
        )}

        {returnedItems.length > 0 && (
          <div className="section-card">
            <div className="section-heading">
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Returned items</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  Items successfully returned by {friendLabel}
                </div>
              </div>
            </div>
            <div className="stack compact-stack">
              {returnedItems.map((loan) => (
                <ReturnedItemCard
                  key={loan.id}
                  loan={loan}
                  borrowerLabel={friendLabel}
                />
              ))}
            </div>
          </div>
        )}

        {friendItems.length === 0 && (
          <div className="section-card">
            <div className="empty-state">
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>No item loans</div>
              <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
                Keep track of items lent to this friend by recording them here.
              </div>
              <button 
                className="button secondary sm" 
                type="button" 
                onClick={() => setShowItemModal(true)}
              >
                Record first item
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderRemindersTab = () => (
    <div>
      {dueReminders.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>No pending returns</div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              All items have been returned or you haven't lent anything yet.
            </div>
            <button 
              className="button secondary sm" 
              type="button" 
              onClick={() => setShowItemModal(true)}
            >
              Lend an item
            </button>
          </div>
        </div>
      ) : (
        <div className="section-card">
          <div className="section-heading">
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Pending returns</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Items awaiting return with reminder status
              </div>
            </div>
            <div className="pill" style={{ background: "#fee2e2", color: "#b91c1c", borderColor: "#fca5a5" }}>
              {dueReminders.length} pending
            </div>
          </div>
          <div className="list">
            {dueReminders.map((item) => {
              const badge = getReminderStatusBadge(item);
              const daysUntilDue = item.expected_return_date
                ? Math.ceil((new Date(item.expected_return_date) - new Date()) / (1000 * 60 * 60 * 24))
                : null;
              const isOverdue = item.due_status === "OVERDUE";
              
              return (
                <div 
                  key={item.id} 
                  className={`row-card detail-row reminder-row ${isOverdue ? "reminder-row-overdue" : ""}`}
                  style={isOverdue ? { borderColor: "#fca5a5", background: "#fffbfb" } : {}}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: isOverdue ? "#b91c1c" : "var(--text)" }}>
                      {item.item_name}
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      Expected back {formatShortDate(item.expected_return_date, { year: "numeric" }) || "date not set"}
                      {daysUntilDue && !isOverdue && ` (${daysUntilDue}d remaining)`}
                      {isOverdue && daysUntilDue && ` • ${Math.abs(daysUntilDue)}d overdue`}
                    </div>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Remind every {item.reminder_interval_days}d
                  </div>
                  <div className={`reminder-badge ${badge.className}`}>{badge.label}</div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <a
                      className="button secondary sm"
                      href={buildGmailLink({
                        to: item.borrower_email,
                        subject: `Return reminder for ${item.item_name}`,
                        body: `Hello,\n\nThis is a reminder to return ${item.item_name}.\n\nThanks.`,
                      })}
                      target="_blank"
                      rel="noreferrer"
                      title="Send return reminder via Gmail"
                    >
                      Send
                    </a>
                    <button
                      className="button secondary sm"
                      type="button"
                      disabled={!selectedFriend?.phone_number}
                      onClick={() =>
                        sendItemReminder({
                          phoneNumber: selectedFriend.phone_number,
                          friendName: friendName,
                          itemName: item.item_name,
                        })
                      }
                      title="Send return reminder via WhatsApp"
                    >
                      WhatsApp
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const renderChatTab = () => {
    const friendLabel = connectionDisplayName(selectedFriend);
    return (
      <ChatPanel
        title={`Chat with ${friendLabel}`}
        subtitle="Direct messages linked to your balance and items."
        loading={chatLoading}
        messages={chatMessages}
        inputValue={chatInput}
        onInputChange={setChatInput}
        onSend={handleSendMessage}
        sending={chatSending}
        currentUserEmail={user?.email}
        error={chatError}
        emptyMessage={`Start a conversation with ${friendLabel} about your balance, items, or anything else.`}
      />
    );
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

  // Define friend display name early for use in all tabs
  const friendName = connectionDisplayName(selectedFriend);

  // Build status description
  const statusDescription = () => {
    if (friendBalance > 0) {
      return `${friendName} owes you ${formatCurrency(friendBalance)}`;
    } else if (friendBalance < 0) {
      return `You owe ${friendName} ${formatCurrency(Math.abs(friendBalance))}`;
    } else {
      return "All settled up";
    }
  };

  // Count urgent reminders
  const overdueReminders = dueReminders.filter(r => r.due_status === "OVERDUE");
  const dueSoon = dueReminders.filter(r => {
    const daysUntilDue = r.expected_return_date
      ? Math.ceil((new Date(r.expected_return_date) - new Date()) / (1000 * 60 * 60 * 24))
      : null;
    return daysUntilDue !== null && daysUntilDue <= 3 && daysUntilDue > 0;
  });

  // Get highest priority urgency signal (only one at a time)
  const getUrgencySignal = () => {
    if (overdueReminders.length > 0) {
      return {
        label: `⚠ ${overdueReminders.length} overdue item${overdueReminders.length === 1 ? "" : "s"}`,
        background: "#fee2e2",
        color: "#b91c1c",
      };
    }
    if (dueSoon.length > 0) {
      return {
        label: `⏰ ${dueSoon.length} due within 3 days`,
        background: "#fef3c7",
        color: "#b45309",
      };
    }
    if (activeItems.length > 0) {
      return {
        label: `📦 ${activeItems.length} active item${activeItems.length === 1 ? "" : "s"}`,
        background: "#dbeafe",
        color: "#1e40af",
      };
    }
    return null;
  };

  return (
    <div className="dashboard-shell">
      {/* Enhanced header with friend info and primary actions */}
      <div className="section-card friend-detail-card">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
          <button
            className="button secondary"
            type="button"
            onClick={() => navigate("/private/friends")}
            title="Back to friends list"
            aria-label="Back to friends list"
            style={{ flexShrink: 0 }}
          >
            ← Back
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 900 }}>{friendName}</div>
            <div className="muted" style={{ fontSize: 13 }}>
              {selectedFriend?.email || "No email on record"}
            </div>
          </div>
        </div>

        {/* Clear balance and status section */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16, alignItems: "center" }}>
          <div>
            <div className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>BALANCE</div>
            <div className={`currency ${friendBalance > 0 ? "positive" : friendBalance < 0 ? "negative" : "primary"}`} style={{ marginBottom: 8 }}>
              {formatCurrency(friendBalance)}
            </div>
            <div style={{ fontSize: 13, color: friendBalance !== 0 ? (friendBalance > 0 ? "#10b981" : "#ef4444") : "var(--muted)" }}>
              {statusDescription()}
            </div>
          </div>

          {/* Single highest-priority urgency indicator */}
          {(() => {
            const signal = getUrgencySignal();
            return signal && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ padding: "8px 12px", background: signal.background, borderRadius: "6px", fontSize: 12 }}>
                  <span style={{ fontWeight: 600, color: signal.color }}>
                    {signal.label}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Action buttons - prioritized hierarchy */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          <button
            className="button"
            type="button"
            disabled={!selectedReminderLink}
            onClick={() => window.open(selectedReminderLink, "_blank", "noopener,noreferrer")}
            aria-label={`Send balance reminder to ${friendName}`}
            title="Send reminder via email"
            style={{ fontWeight: 600 }}
          >
            Send reminder
          </button>
          <button
            className="button"
            type="button"
            disabled={!selectedFriend?.phone_number || friendBalance === 0}
            onClick={() =>
              sendDebtReminder({
                phoneNumber: selectedFriend.phone_number,
                friendName: friendName,
                amount: Math.abs(friendBalance),
                type: friendBalance > 0 ? "LENT" : "BORROWED",
              })
            }
            aria-label={`Send WhatsApp reminder to ${friendName}`}
            title="Send reminder via WhatsApp"
            style={{ fontWeight: 600 }}
          >
            WhatsApp
          </button>
          <button
            className="button"
            type="button"
            onClick={() => setShowSettleModal(true)}
            aria-label={`Settle up with ${friendName}`}
            title="Record a settlement"
            style={{ fontWeight: 600 }}
          >
            Settle up
          </button>
          <button 
            className="button secondary sm" 
            type="button" 
            onClick={() => setShowExpenseModal(true)}
            aria-label={`Add expense with ${friendName}`}
          >
            + Expense
          </button>
          <button 
            className="button secondary sm" 
            type="button" 
            onClick={() => setShowItemModal(true)}
            aria-label={`Lend item to ${friendName}`}
          >
            + Item
          </button>
        </div>
      </div>

      {actionError && <div className="error-text" style={{ marginBottom: 16 }}>{actionError}</div>}

      {/* Tab navigation */}
      <div className="section-card friend-detail-tabs">
        <div className="tab-control">
          {["expenses", "items", "reminders", "chat"].map((tab) => (
            <button
              key={tab}
              type="button"
              className={`tab-button ${selectedTab === tab ? "tab-active" : ""}`}
              onClick={() => setSelectedTab(tab)}
              title={`View ${tab}`}
            >
              {tab === "expenses" && "Expenses"}
              {tab === "items" && "Items"}
              {tab === "reminders" && `Reminders${dueReminders.length > 0 ? ` (${dueReminders.length})` : ""}`}
              {tab === "chat" && "Chat"}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="tab-content">
        {selectedTab === "expenses" && renderExpensesTab()}
        {selectedTab === "items" && renderItemsTab()}
        {selectedTab === "reminders" && renderRemindersTab()}
        {selectedTab === "chat" && renderChatTab()}
      </div>

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
