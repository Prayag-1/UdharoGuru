import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import {
  addPrivateFriendByEmail,
  addPrivateFriendByInviteCode,
  getPrivateConnections,
  getPrivateItemReminders,
  getPrivateItems,
  getPrivateSummary,
  getPrivateTransactions,
} from "../../api/private";
import FriendCard from "./components/FriendCard";
import {
  connectionDisplayName,
  formatCurrency,
  getConnectionBalanceMap,
  getConnectionTransactionMap,
  normalizeConnection,
} from "./privateShared";
import "./PrivateDashboard.css";

/**
 * FriendsView - CLEAN FRIENDS LIST
 * Shows: summary cards, add friends, friend list (clickable to detail)
 * Removes: friend detail panel, chat, expense modals, settle UI
 * Those move to FriendDetailView which is accessible via /private/friends/:id
 */
export default function FriendsView() {
  const { connections, setConnections } = useOutletContext();

  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [items, setItems] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchValue, setSearchValue] = useState("");
  const [sortMode, setSortMode] = useState("balance");
  const [showAddFriend, setShowAddFriend] = useState(false);

  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [inviteSaving, setInviteSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [friendActionError, setFriendActionError] = useState(null);
  const [friendActionSuccess, setFriendActionSuccess] = useState("");

  // Load friends data on mount
  const loadFriendsData = async () => {
    const [summaryRes, txRes, itemsRes, remindersRes] = await Promise.all([
      getPrivateSummary(),
      getPrivateTransactions(),
      getPrivateItems(),
      getPrivateItemReminders(),
    ]);
    setSummary(summaryRes.data);
    setTransactions(Array.isArray(txRes.data) ? txRes.data : txRes.data?.results || []);
    setItems(Array.isArray(itemsRes.data) ? itemsRes.data : itemsRes.data?.results || []);
    setReminders(Array.isArray(remindersRes.data) ? remindersRes.data : remindersRes.data?.results || []);
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        await loadFriendsData();
      } catch (err) {
        console.error("Failed to load friends view", err);
        if (!active) return;
        setSummary(null);
        setTransactions([]);
        setItems([]);
        setReminders([]);
        setError("Unable to load your private friend balances.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  // Clear success message after delay
  useEffect(() => {
    if (!friendActionSuccess) return;
    const timer = setTimeout(() => setFriendActionSuccess(""), 2200);
    return () => clearTimeout(timer);
  }, [friendActionSuccess]);

  // Compute friend rows with balances and metadata
  const normalizedConnections = useMemo(
    () => connections.map(normalizeConnection),
    [connections]
  );
  const balances = useMemo(
    () => getConnectionBalanceMap(normalizedConnections, transactions),
    [normalizedConnections, transactions]
  );
  const transactionMap = useMemo(
    () => getConnectionTransactionMap(normalizedConnections, transactions),
    [normalizedConnections, transactions]
  );

  const friendRows = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    const rows = normalizedConnections.map((conn) => {
      const friendTransactions = [...(transactionMap[conn.id] || [])].sort(
        (a, b) => new Date(b.transaction_date || 0).getTime() - new Date(a.transaction_date || 0).getTime()
      );
      const friendItems = items.filter((loan) => String(loan.borrower) === String(conn.id));
      const activeItems = friendItems.filter((loan) => loan.status === "ACTIVE");
      const returnedItems = friendItems.filter((loan) => loan.status === "RETURNED");
      const dueReminders = reminders.filter((item) => String(item.borrower) === String(conn.id));
      const balance = Number(balances[conn.id] || 0);

      return {
        ...conn,
        balance,
        friendTransactions,
        friendItems,
        activeItems,
        returnedItems,
        dueReminders,
        latestActivity:
          friendTransactions[0]?.transaction_date ||
          friendItems[0]?.expected_return_date ||
          conn.connected_at,
      };
    });

    const filtered = rows.filter((row) => {
      if (!query) return true;
      const haystack = [row.full_name, row.email, row.invite_code].join(" ").toLowerCase();
      return haystack.includes(query);
    });

    filtered.sort((a, b) => {
      if (sortMode === "recent") {
        return new Date(b.latestActivity || 0).getTime() - new Date(a.latestActivity || 0).getTime();
      }
      return Math.abs(b.balance) - Math.abs(a.balance);
    });

    return filtered;
  }, [balances, items, normalizedConnections, reminders, searchValue, sortMode, transactionMap]);

  const owed = Number(summary?.total_receivable || 0);
  const owes = Number(summary?.total_payable || 0);
  const net = Number(summary?.net_balance || 0);

  // Add friend handlers
  const refreshConnections = async () => {
    const { data } = await getPrivateConnections();
    setConnections(Array.isArray(data) ? data : data?.results || []);
  };

  const handleAddByInviteCode = async (event) => {
    event.preventDefault();
    const nextCode = inviteCodeInput.trim().toUpperCase();
    if (!nextCode) return;

    setInviteSaving(true);
    setFriendActionError(null);
    setFriendActionSuccess("");
    try {
      await addPrivateFriendByInviteCode({ invite_code: nextCode });
      await refreshConnections();
      setInviteCodeInput("");
      setFriendActionSuccess("Friend added by invite code.");
    } catch (err) {
      setFriendActionError(
        err?.response?.data?.detail || err?.response?.data?.invite_code || "Unable to add friend by invite code."
      );
    } finally {
      setInviteSaving(false);
    }
  };

  const handleAddByEmail = async (event) => {
    event.preventDefault();
    const nextEmail = emailInput.trim();
    if (!nextEmail) return;

    setEmailSaving(true);
    setFriendActionError(null);
    setFriendActionSuccess("");
    try {
      await addPrivateFriendByEmail({ email: nextEmail });
      await refreshConnections();
      setEmailInput("");
      setFriendActionSuccess("Friend invite sent by email.");
    } catch (err) {
      setFriendActionError(
        err?.response?.data?.detail || err?.response?.data?.email || "Unable to add friend by email."
      );
    } finally {
      setEmailSaving(false);
    }
  };

  return (
    <div className="dashboard-shell private-friends-shell">
      {/* Header */}
      <div className="section-card">
        <div className="section-heading friends-header">
          <div>
            <div style={{ fontSize: 24, fontWeight: 900 }}>Friends</div>
            <div className="muted" style={{ fontSize: 14 }}>
              Track balances, settle up, and manage item loans.
            </div>
          </div>
          <div className="friends-toolbar">
            <input
              className="input search-input"
              placeholder="Search friends"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
            <button
              className="button secondary"
              type="button"
              onClick={() => setSortMode((prev) => (prev === "balance" ? "recent" : "balance"))}
            >
              Sort: {sortMode === "balance" ? "Balance" : "Recent"}
            </button>
            <button
              className="button"
              type="button"
              onClick={() => setShowAddFriend((prev) => !prev)}
            >
              {showAddFriend ? "Close" : "Add friends"}
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid-3">
          <div className="summary-card">
            <div className="card-title">You are owed</div>
            <div className="currency positive" style={{ marginTop: 6 }}>
              {formatCurrency(owed)}
            </div>
          </div>
          <div className="summary-card">
            <div className="card-title">You owe</div>
            <div className="currency negative" style={{ marginTop: 6 }}>
              {formatCurrency(owes)}
            </div>
          </div>
          <div className="summary-card">
            <div className="card-title">Net position</div>
            <div
              className={`currency ${
                net > 0 ? "positive" : net < 0 ? "negative" : "primary"
              }`}
              style={{ marginTop: 6 }}
            >
              {formatCurrency(net)}
            </div>
          </div>
        </div>

        {/* Add friend panel */}
        {showAddFriend && (
          <div className="friend-entry-panel">
            <form className="friend-entry-form" onSubmit={handleAddByInviteCode}>
              <div style={{ fontWeight: 700 }}>Add by invite code</div>
              <input
                className="input"
                type="text"
                value={inviteCodeInput}
                onChange={(event) => setInviteCodeInput(event.target.value)}
                placeholder="Enter invite code"
                style={{ textTransform: "uppercase" }}
              />
              <button
                className="button"
                type="submit"
                disabled={inviteSaving || !inviteCodeInput.trim()}
              >
                {inviteSaving ? "Adding..." : "Add friend"}
              </button>
            </form>

            <form className="friend-entry-form" onSubmit={handleAddByEmail}>
              <div style={{ fontWeight: 700 }}>Add by email</div>
              <input
                className="input"
                type="email"
                value={emailInput}
                onChange={(event) => setEmailInput(event.target.value)}
                placeholder="friend@example.com"
              />
              <button
                className="button secondary"
                type="submit"
                disabled={emailSaving || !emailInput.trim()}
              >
                {emailSaving ? "Sending..." : "Invite"}
              </button>
            </form>
          </div>
        )}

        {/* Messages */}
        {friendActionError && <div className="error-text">{friendActionError}</div>}
        {friendActionSuccess && <div className="pill success-pill">{friendActionSuccess}</div>}
        {error && <div className="error-text">{error}</div>}
      </div>

      {/* Friends list */}
      <div className="section-card">
        <div className="section-heading">
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Friend balances</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Click a friend to view details, send money, or lend items.
            </div>
          </div>
          <div className="pill">{friendRows.length} friends</div>
        </div>

        {loading ? (
          <div className="list">
            {[...Array(4)].map((_, index) => (
              <span key={index} className="skeleton" style={{ width: "100%", height: 86 }} />
            ))}
          </div>
        ) : friendRows.length === 0 ? (
          <div className="empty-state">
            No friends yet. Add someone to start tracking balances.
          </div>
        ) : (
          <div className="list">
            {friendRows.map((friend) => (
              <FriendCard key={friend.id} friend={friend} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
