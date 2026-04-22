import { useMemo } from "react";
import { useOutletContext } from "react-router-dom";

import { formatDateTime } from "./privateShared";
import "./PrivateDashboard.css";

export default function AccountView() {
  const {
    user,
    inviteCode,
    copyState,
    handleCopyInvite,
    handleLogout,
    notifications,
    unreadCount,
    theme,
    toggleTheme,
  } = useOutletContext();

  const recentNotifications = useMemo(() => notifications.slice(0, 5), [notifications]);

  return (
    <div className="dashboard-shell">
      <div className="section-card">
        <div className="section-heading">
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>Account</div>
            <div className="muted" style={{ fontSize: 14 }}>
              Personal settings, invite tools, and account utilities.
            </div>
          </div>
          <button className="button secondary" type="button" onClick={toggleTheme}>
            Theme: {theme === "dark" ? "Dark" : "Light"}
          </button>
        </div>

        <div className="grid-2">
          <div className="summary-card">
            <div className="card-title">Profile</div>
            <div className="account-field">
              <span>Name</span>
              <strong>{user?.full_name || "Private user"}</strong>
            </div>
            <div className="account-field">
              <span>Email</span>
              <strong>{user?.email}</strong>
            </div>
            <div className="account-field">
              <span>Account type</span>
              <strong>{user?.account_type}</strong>
            </div>
          </div>

          <div className="summary-card">
            <div className="card-title">Connected status</div>
            <div className="account-field">
              <span>Google sign-in</span>
              <strong>Not exposed in current account payload</strong>
            </div>
            <div className="account-field">
              <span>Phone</span>
              <strong>Not available for private profile yet</strong>
            </div>
            <div className="account-field">
              <span>Notifications</span>
              <strong>{unreadCount} unread</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="section-card">
        <div className="section-heading">
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Friend code</div>
            <div className="muted" style={{ fontSize: 14 }}>
              Share this code when someone wants to connect with you directly.
            </div>
          </div>
          <button className="button" type="button" onClick={handleCopyInvite} disabled={!inviteCode}>
            {copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy code"}
          </button>
        </div>
        <div className="invite-code-card">
          <div className="invite-code-value">{inviteCode || "Invite code unavailable"}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            You can also add friends from the Friends tab by invite code or email.
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="section-card">
          <div className="section-heading">
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Notifications</div>
              <div className="muted" style={{ fontSize: 14 }}>
                Recent updates tied to settlements, reminders, and connection activity.
              </div>
            </div>
          </div>
          {recentNotifications.length === 0 ? (
            <div className="empty-state">No notifications yet.</div>
          ) : (
            <div className="list">
              {recentNotifications.map((notification) => (
                <div key={notification.id} className="row-card simple-row">
                  <div>
                    <div style={{ fontWeight: 700 }}>{notification.message}</div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {notification.sender_name || "System"} · {formatDateTime(notification.created_at)}
                    </div>
                  </div>
                  {!notification.is_read && <span className="badge warning">Unread</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="section-card">
          <div className="section-heading">
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Utilities</div>
              <div className="muted" style={{ fontSize: 14 }}>
                Keep the current product focused while leaving room for future tools.
              </div>
            </div>
          </div>
          <div className="list">
            <div className="summary-card">
              <div className="card-title">Reminder preferences</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Item reminder timing is set when you lend an item. Friend-level reminder preferences can be added later
                without changing the current workflow.
              </div>
            </div>
            <div className="summary-card">
              <div className="card-title">Future scope</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Currency conversion and other utilities stay out of the main tabs for now so the private workflow
                remains clean.
              </div>
            </div>
            <div className="summary-card">
              <div className="card-title">Security</div>
              <div className="muted" style={{ fontSize: 13 }}>
                Authentication still runs through the existing auth flow. Profile editing and linked-account management
                need dedicated account APIs before they can be safely added here.
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
            <button className="button danger" type="button" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
