import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { getOrCreateDirectThread, getPrivateTransactions, getThreadMessages, sendThreadMessage } from "../../api/private";
import ChatPanel from "./components/ChatPanel";
import "./PrivateDashboard.css";

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const normalizeConnection = (conn) => {
  const target = conn.connected_user || {};
  return {
    id: conn.connected_user_id || target.id || conn.id,
    email: conn.connected_user_email || target.email || conn.email,
    full_name: target.full_name || conn.full_name,
  };
};

export default function FriendsView() {
  const { connections, user } = useOutletContext();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [chatThread, setChatThread] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState(null);
  const pollRef = useRef(null);

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
        console.error("Failed to load friend data", err);
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

  const balances = useMemo(() => {
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

  const filteredTx = useMemo(() => {
    if (!selectedFriend) return [];
    const conn = normalizedConnections.find((c) => String(c.id) === String(selectedFriend));
    if (!conn) return [];
    const label = (conn.email || conn.full_name || "").toLowerCase();
    return transactions.filter((tx) => (tx.person_name || "").toLowerCase() === label);
  }, [normalizedConnections, selectedFriend, transactions]);

  const loadChat = async (friendId) => {
    if (!friendId) return;
    setChatLoading(true);
    setChatError(null);
    setChatInput("");
    if (pollRef.current) clearInterval(pollRef.current);
    setChatThread(null);
    setChatMessages([]);
    try {
      const { data: thread } = await getOrCreateDirectThread({ user_id: friendId });
      setChatThread(thread);
      const { data: msgs } = await getThreadMessages(thread.id);
      setChatMessages(msgs);
    } catch (err) {
      console.error("Failed to load chat", err);
      setChatThread(null);
      setChatMessages([]);
      setChatError("Unable to load chat right now.");
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    if (!chatThread?.id) return;
    const run = async () => {
      try {
        const { data } = await getThreadMessages(chatThread.id);
        setChatMessages(data);
      } catch (err) {
        console.error("Failed to poll chat", err);
      }
    };
    run();
    pollRef.current = setInterval(run, 7000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [chatThread?.id]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!chatThread?.id || !chatInput.trim()) return;
    setChatSending(true);
    setChatError(null);
    try {
      await sendThreadMessage(chatThread.id, { message: chatInput.trim() });
      setChatInput("");
      const { data } = await getThreadMessages(chatThread.id);
      setChatMessages(data);
    } catch (err) {
      console.error("Failed to send message", err);
      setChatError("Unable to send message.");
    } finally {
      setChatSending(false);
    }
  };

  const activeFriend = useMemo(
    () => normalizedConnections.find((c) => String(c.id) === String(selectedFriend)),
    [normalizedConnections, selectedFriend]
  );

  const handleClearSelection = () => {
    setSelectedFriend(null);
    setChatThread(null);
    setChatMessages([]);
    setChatInput("");
    setChatError(null);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  return (
    <div className="dashboard-shell">
      <div className="section-heading" style={{ marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>Friends</div>
          <div className="muted">Connections and balances</div>
        </div>
      </div>

      {loading ? (
        <div className="section-card">
          <span className="skeleton" style={{ width: "100%", height: 80 }} />
        </div>
      ) : error ? (
        <div className="error-text">{error}</div>
      ) : normalizedConnections.length === 0 ? (
        <div className="empty-state">No connections yet.</div>
      ) : (
        <div className="section-card">
          <div className="list">
            {normalizedConnections.map((conn) => {
              const net = balances[conn.id] || 0;
              return (
                <div
                  key={conn.id}
                  className="row-card"
                  style={{ gridTemplateColumns: "1fr auto", cursor: "pointer" }}
                  onClick={() => {
                    setSelectedFriend(conn.id);
                    loadChat(conn.id);
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>{conn.full_name || conn.email || `User ${conn.id}`}</div>
                    <div className="muted">{conn.email}</div>
                  </div>
                  <div className="currency" style={{ color: net > 0 ? "#0b7a34" : net < 0 ? "#b91c1c" : "#0f172a" }}>
                    {formatCurrency(net)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedFriend && (
        <div className="section-card">
          <div className="section-heading" style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 800 }}>Expenses with this friend</div>
            <button className="button secondary" type="button" onClick={handleClearSelection}>
              Clear filter
            </button>
          </div>
          {filteredTx.length === 0 ? (
            <div className="empty-state">No expenses with this friend yet.</div>
          ) : (
            <div className="list">
              {filteredTx.map((tx) => {
                const isLent = tx.transaction_type === "LENT";
                return (
                  <div key={tx.id} className="row-card" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{tx.note || "Expense"}</div>
                      <div className="muted">{formatDate(tx.transaction_date)}</div>
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>{isLent ? "You lent" : "You borrowed"}</div>
                    <div className="currency" style={{ color: isLent ? "#0b7a34" : "#b91c1c" }}>
                      {formatCurrency(tx.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedFriend && (
        <ChatPanel
          title={`Chat with ${activeFriend?.full_name || activeFriend?.email || "friend"}`}
          subtitle="Text-only chat. Polls every few seconds and stays scoped to this friend."
          loading={chatLoading}
          messages={chatMessages}
          inputValue={chatInput}
          onInputChange={setChatInput}
          onSend={handleSend}
          sending={chatSending}
          currentUserEmail={user?.email}
          error={chatError}
        />
      )}
    </div>
  );
}
