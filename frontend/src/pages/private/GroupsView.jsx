import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";

import {
  addGroupMember,
  addPrivateFriendByEmail,
  createGroup,
  getGroupThread,
  getGroups,
  getPrivateFriends,
  getThreadMessages,
  sendThreadMessage,
} from "../../api/private";
import ChatPanel from "./components/ChatPanel";
import "./PrivateDashboard.css";
import CreateGroupModal from "./modals/CreateGroupModal";
import AddGroupMemberModal from "./modals/AddGroupMemberModal";

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export default function GroupsView() {
  const { user } = useOutletContext();
  const [groups, setGroups] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddMemberFor, setShowAddMemberFor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [friendError, setFriendError] = useState(null);
  const [chatGroup, setChatGroup] = useState(null);
  const [chatThread, setChatThread] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [groupsRes, friendsRes] = await Promise.all([getGroups(), getPrivateFriends()]);
        if (!active) return;
        setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : groupsRes.data?.results || []);
        setFriends(Array.isArray(friendsRes.data) ? friendsRes.data : friendsRes.data?.results || []);
      } catch (err) {
        console.error("Failed to load groups", err);
        if (!active) return;
        setGroups([]);
        setFriends([]);
        setError("Unable to load groups.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const friendOptions = useMemo(
    () => friends.map((f) => ({ id: f.id, label: f.email || f.invite_code || `User ${f.id}` })),
    [friends]
  );

  const handleCreateGroup = async (name) => {
    setSaving(true);
    try {
      await createGroup({ name });
      const { data } = await getGroups();
      setGroups(Array.isArray(data) ? data : data?.results || []);
      setShowCreate(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async (groupId, userId) => {
    setSaving(true);
    try {
      await addGroupMember(groupId, { user_id: userId });
      setShowAddMemberFor(null);
      const { data } = await getGroups();
      setGroups(Array.isArray(data) ? data : data?.results || []);
    } finally {
      setSaving(false);
    }
  };

  const loadGroupChat = async (group) => {
    if (!group) return;
    setChatLoading(true);
    setChatError(null);
    setChatInput("");
    if (pollRef.current) clearInterval(pollRef.current);
    setChatThread(null);
    setChatMessages([]);
    setChatGroup(group);
    try {
      const { data: thread } = await getGroupThread(group.id);
      setChatThread(thread);
      const { data: msgs } = await getThreadMessages(thread.id);
      setChatMessages(msgs);
    } catch (err) {
      console.error("Failed to load group chat", err);
      setChatThread(null);
      setChatMessages([]);
      setChatError("Unable to load group chat.");
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
        console.error("Failed to poll group chat", err);
      }
    };
    run();
    pollRef.current = setInterval(run, 8000);
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
      console.error("Failed to send group message", err);
      setChatError("Unable to send message.");
    } finally {
      setChatSending(false);
    }
  };

  const handleAddFriendByEmail = async (email) => {
    setFriendError(null);
    try {
      await addPrivateFriendByEmail({ email });
      const { data } = await getPrivateFriends();
      setFriends(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.email ||
        err?.response?.data?.invite_code ||
        "Unable to add friend.";
      setFriendError(msg);
    }
  };

  const handleCloseChat = () => {
    setChatGroup(null);
    setChatThread(null);
    setChatMessages([]);
    setChatInput("");
    setChatError(null);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  if (loading) {
    return (
      <div className="dashboard-shell">
        <div className="section-card">
          <span className="skeleton" style={{ width: "100%", height: 80 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <div className="section-heading" style={{ marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Groups</div>
          <div className="muted">Create groups, manage members, and coordinate with in-context chat.</div>
        </div>
        <button className="button" type="button" onClick={() => setShowCreate(true)}>
          Create group
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}

      <div className="section-card">
        <div className="section-heading" style={{ marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 700 }}>Your groups</div>
            <div className="muted" style={{ fontSize: 13 }}>Groups you own or are a member of.</div>
          </div>
        </div>
        {groups.length === 0 ? (
          <div className="empty-state">No groups yet. Create one to get started.</div>
        ) : (
          <div className="list">
            {groups.map((group) => (
              <div
                key={group.id}
                className="row-card"
                style={{ gridTemplateColumns: "1.4fr 0.6fr 0.6fr auto" }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{group.name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Created {formatDate(group.created_at)} · {group.member_count} members
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>Role</div>
                <div className="pill" style={{ justifySelf: "start" }}>{group.role}</div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button className="button secondary" type="button" onClick={() => setShowAddMemberFor(group)}>
                    Add member
                  </button>
                  <button className="button" type="button" onClick={() => loadGroupChat(group)}>
                    Open chat
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section-card">
        <div className="section-heading" style={{ marginBottom: 8 }}>
          <div>
            <div style={{ fontWeight: 700 }}>Friends</div>
            <div className="muted" style={{ fontSize: 13 }}>Add friends to invite them to groups.</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <EmailAddForm onSubmit={handleAddFriendByEmail} submitting={saving} />
        </div>
        {friendError && <div className="error-text">{friendError}</div>}
        {friends.length === 0 ? (
          <div className="empty-state">No friends yet. Add by invite code or email.</div>
        ) : (
          <div className="list">
            {friends.map((f) => (
              <div key={f.id} className="row-card" style={{ gridTemplateColumns: "1fr auto" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{f.email}</div>
                  <div className="muted" style={{ fontSize: 13 }}>Invite code: {f.invite_code}</div>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>Connected {formatDate(f.connected_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateGroupModal open={showCreate} onClose={() => setShowCreate(false)} onSubmit={handleCreateGroup} submitting={saving} />
      <AddGroupMemberModal
        open={Boolean(showAddMemberFor)}
        onClose={() => setShowAddMemberFor(null)}
        group={showAddMemberFor}
        friends={friendOptions}
        onSubmit={handleAddMember}
        submitting={saving}
      />

      {chatGroup && (
        <ChatPanel
          title={`Group chat - ${chatGroup.name}`}
          subtitle="Text-only chat inside this group. Polling every few seconds."
          loading={chatLoading}
          messages={chatMessages}
          inputValue={chatInput}
          onInputChange={setChatInput}
          onSend={handleSend}
          sending={chatSending}
          currentUserEmail={user?.email}
          onClose={handleCloseChat}
          error={chatError}
        />
      )}
    </div>
  );
}

function EmailAddForm({ onSubmit, submitting }) {
  const [email, setEmail] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    await onSubmit(email);
    setEmail("");
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input
        className="input"
        type="email"
        placeholder="friend@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        style={{ minWidth: 240 }}
      />
      <button className="button" type="submit" disabled={submitting}>
        {submitting ? "Adding..." : "Add by email"}
      </button>
    </form>
  );
}
