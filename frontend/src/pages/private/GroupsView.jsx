import { useEffect, useMemo, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";

import {
  addGroupMember,
  createGroup,
  deleteGroup,
  getGroupThread,
  getGroups,
  getPrivateFriends,
  getThreadMessages,
  sendThreadMessage,
  updateGroup,
} from "../../api/private";
import ChatPanel from "./components/ChatPanel";
import { formatShortDate } from "./privateShared";
import "./PrivateDashboard.css";
import CreateGroupModal from "./modals/CreateGroupModal";
import AddGroupMemberModal from "./modals/AddGroupMemberModal";

export default function GroupsView() {
  const { user } = useOutletContext();
  const pollRef = useRef(null);

  const [groups, setGroups] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddMemberFor, setShowAddMemberFor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [groupActionError, setGroupActionError] = useState(null);
  const [chatGroup, setChatGroup] = useState(null);
  const [chatThread, setChatThread] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState(null);

  const loadGroupsPage = async () => {
    const [groupsRes, friendsRes] = await Promise.all([getGroups(), getPrivateFriends()]);
    setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : groupsRes.data?.results || []);
    setFriends(Array.isArray(friendsRes.data) ? friendsRes.data : friendsRes.data?.results || []);
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        await loadGroupsPage();
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
    () => friends.map((friend) => ({ id: friend.id, label: friend.email || friend.invite_code || `User ${friend.id}` })),
    [friends]
  );

  const handleCreateGroup = async (name) => {
    setSaving(true);
    try {
      await createGroup({ name });
      await loadGroupsPage();
      setShowCreate(false);
      setGroupActionError(null);
    } finally {
      setSaving(false);
    }
  };

  const handleRenameGroup = async (group) => {
    const nextName = window.prompt("Rename group", group?.name || "");
    if (!nextName?.trim()) return;
    setSaving(true);
    try {
      await updateGroup(group.id, { name: nextName.trim() });
      await loadGroupsPage();
      setGroupActionError(null);
    } catch (err) {
      setGroupActionError(err?.response?.data?.detail || "Unable to rename group.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async (group) => {
    const confirmed = window.confirm(`Delete group "${group?.name}"? This cannot be undone.`);
    if (!confirmed) return;

    setSaving(true);
    try {
      await deleteGroup(group.id);
      if (chatGroup?.id === group.id) {
        handleCloseChat();
      }
      await loadGroupsPage();
      setGroupActionError(null);
    } catch (err) {
      setGroupActionError(err?.response?.data?.detail || "Unable to delete group.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async (groupId, userId) => {
    setSaving(true);
    try {
      await addGroupMember(groupId, { user_id: userId });
      await loadGroupsPage();
      setShowAddMemberFor(null);
      setGroupActionError(null);
    } catch (err) {
      setGroupActionError(err?.response?.data?.detail || "Unable to add group member.");
    } finally {
      setSaving(false);
    }
  };

  const loadGroupChat = async (group) => {
    if (!group) return;
    if (pollRef.current) clearInterval(pollRef.current);

    setChatGroup(group);
    setChatThread(null);
    setChatMessages([]);
    setChatInput("");
    setChatError(null);
    setChatLoading(true);

    try {
      const { data: thread } = await getGroupThread(group.id);
      setChatThread(thread);
      const { data: messages } = await getThreadMessages(thread.id);
      setChatMessages(messages);
    } catch (err) {
      console.error("Failed to load group chat", err);
      setChatError("Unable to load group chat.");
    } finally {
      setChatLoading(false);
    }
  };

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
        console.error("Failed to poll group chat", err);
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

  const handleSend = async (event) => {
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
      console.error("Failed to send group message", err);
      setChatError("Unable to send message.");
    } finally {
      setChatSending(false);
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

  return (
    <div className="dashboard-shell">
      <div className="section-card">
        <div className="section-heading">
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>Groups</div>
            <div className="muted" style={{ fontSize: 14 }}>
              Group expenses stay isolated here so shared spending has a clear, dedicated flow.
            </div>
          </div>
          <button className="button" type="button" onClick={() => setShowCreate(true)}>
            Create group
          </button>
        </div>
        {error && <div className="error-text">{error}</div>}
        {groupActionError && <div className="error-text">{groupActionError}</div>}
      </div>

      {loading ? (
        <div className="section-card">
          <span className="skeleton" style={{ width: "100%", height: 88 }} />
        </div>
      ) : groups.length === 0 ? (
        <div className="section-card">
          <div className="empty-state">
            <div style={{ fontWeight: 800, fontSize: 18 }}>No groups yet</div>
            <div className="muted" style={{ fontSize: 14, maxWidth: 440 }}>
              Use groups for shared expenses with multiple people. Create one when a trip, room, event, or project
              needs a dedicated shared balance.
            </div>
            <button className="button" type="button" onClick={() => setShowCreate(true)}>
              Start a group
            </button>
          </div>
        </div>
      ) : (
        <div className="split-layout">
          <div className="stack">
            <div className="section-card">
              <div className="list">
                {groups.map((group) => (
                  <div key={group.id} className="row-card group-row">
                    <div className="group-left">
                      <div className="group-title">{group.name}</div>
                      <div className="group-meta">
                        {group.member_count} members · Created {formatShortDate(group.created_at, { year: "numeric" })}
                      </div>
                      <div className="group-badges">
                        <span className={`role-pill ${group.role === "ADMIN" ? "admin" : "member"}`}>{group.role}</span>
                        <span className="badge">Shared expenses</span>
                      </div>
                    </div>
                    <div className="group-right">
                      <button className="button sm primary" type="button" onClick={() => loadGroupChat(group)}>
                        Open chat
                      </button>
                      {group.role === "ADMIN" && (
                        <div className="group-actions">
                          <button className="button secondary sm" type="button" onClick={() => setShowAddMemberFor(group)}>
                            Add member
                          </button>
                          <button className="button secondary sm" type="button" onClick={() => handleRenameGroup(group)}>
                            Rename
                          </button>
                          <button className="button danger sm" type="button" onClick={() => handleDeleteGroup(group)}>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="stack">
            <div className="section-card">
              <div className="section-heading">
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>
                    {chatGroup ? `${chatGroup.name} chat` : "Group flow"}
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Keep group collaboration adjacent to the group list, not mixed into Friends or Account.
                  </div>
                </div>
              </div>
              {chatGroup ? (
                <ChatPanel
                  title={`Group chat - ${chatGroup.name}`}
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
              ) : (
                <div className="empty-state">
                  Select a group to open chat and continue the shared-expense workflow.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <CreateGroupModal open={showCreate} onClose={() => setShowCreate(false)} onSubmit={handleCreateGroup} submitting={saving} />
      <AddGroupMemberModal
        open={Boolean(showAddMemberFor)}
        onClose={() => setShowAddMemberFor(null)}
        group={showAddMemberFor}
        friends={friendOptions}
        onSubmit={handleAddMember}
        submitting={saving}
      />
    </div>
  );
}
