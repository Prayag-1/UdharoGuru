import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { formatDateTime } from "./privateShared";
import { toggleTwoFactor, updatePhone } from "../../api/auth";
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

  const [phoneEdit, setPhoneEdit] = useState(false);
  const [phoneValue, setPhoneValue] = useState(user?.phone_number || "");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [phoneSuccess, setPhoneSuccess] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(Boolean(user?.two_factor_enabled));
  const [twoFactorSaving, setTwoFactorSaving] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState("");
  const [twoFactorSuccess, setTwoFactorSuccess] = useState("");

  const recentNotifications = useMemo(() => notifications.slice(0, 5), [notifications]);

  const handlePhoneSave = async () => {
    setPhoneError("");
    setPhoneSuccess("");
    
    if (!phoneValue.trim()) {
      setPhoneError("Phone number cannot be empty.");
      return;
    }
    
    setPhoneSaving(true);
    try {
      await updatePhone(phoneValue.trim());
      setPhoneSuccess("Phone number updated successfully.");
      setPhoneEdit(false);
      setTimeout(() => setPhoneSuccess(""), 3000);
    } catch (err) {
      setPhoneError(err.message || "Failed to update phone number.");
    } finally {
      setPhoneSaving(false);
    }
  };

  const handlePhoneCancel = () => {
    setPhoneValue(user?.phone_number || "");
    setPhoneEdit(false);
    setPhoneError("");
    setPhoneSuccess("");
  };

  const handleTwoFactorToggle = async () => {
    const nextValue = !twoFactorEnabled;
    setTwoFactorSaving(true);
    setTwoFactorError("");
    setTwoFactorSuccess("");
    try {
      const { data } = await toggleTwoFactor(nextValue);
      setTwoFactorEnabled(Boolean(data?.two_factor_enabled));
      setTwoFactorSuccess(
        data?.two_factor_enabled ? "Email OTP 2FA enabled." : "Email OTP 2FA disabled."
      );
      setTimeout(() => setTwoFactorSuccess(""), 3000);
    } catch (err) {
      setTwoFactorError(err?.response?.data?.detail || "Failed to update 2FA setting.");
    } finally {
      setTwoFactorSaving(false);
    }
  };

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
              <strong>{user?.google_linked ? "Connected ✓" : "Not connected"}</strong>
            </div>
            <div className="account-field">
              <span>Phone number</span>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px" }}>
                <strong>
                  {phoneEdit ? (
                    <input
                      type="tel"
                      value={phoneValue}
                      onChange={(e) => setPhoneValue(e.target.value)}
                      placeholder="+977 98..."
                      style={{
                        padding: "6px 8px",
                        borderRadius: "4px",
                        border: "1px solid #ddd",
                        fontSize: "14px",
                      }}
                    />
                  ) : (
                    user?.phone_number || "Not set"
                  )}
                </strong>
                {phoneEdit ? (
                  <>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={handlePhoneSave}
                      disabled={phoneSaving}
                      style={{ padding: "4px 12px", fontSize: "12px" }}
                    >
                      {phoneSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={handlePhoneCancel}
                      disabled={phoneSaving}
                      style={{ padding: "4px 12px", fontSize: "12px" }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => setPhoneEdit(true)}
                    style={{ padding: "4px 12px", fontSize: "12px" }}
                  >
                    Edit
                  </button>
                )}
              </div>
              {phoneError && (
                <div style={{ color: "#d32f2f", fontSize: "12px", marginTop: "4px" }}>
                  {phoneError}
                </div>
              )}
              {phoneSuccess && (
                <div style={{ color: "#388e3c", fontSize: "12px", marginTop: "4px" }}>
                  {phoneSuccess}
                </div>
              )}
            </div>
            <div className="account-field">
              <span>Notifications</span>
              <strong>{unreadCount} unread</strong>
            </div>
            <div className="account-field">
              <span>Email OTP 2FA</span>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px" }}>
                <strong>{twoFactorEnabled ? "Enabled" : "Disabled"}</strong>
                <button
                  className="button secondary"
                  type="button"
                  onClick={handleTwoFactorToggle}
                  disabled={twoFactorSaving}
                  style={{ padding: "4px 12px", fontSize: "12px" }}
                >
                  {twoFactorSaving ? "Saving..." : twoFactorEnabled ? "Disable" : "Enable"}
                </button>
              </div>
              {twoFactorError && (
                <div style={{ color: "#d32f2f", fontSize: "12px", marginTop: "4px" }}>
                  {twoFactorError}
                </div>
              )}
              {twoFactorSuccess && (
                <div style={{ color: "#388e3c", fontSize: "12px", marginTop: "4px" }}>
                  {twoFactorSuccess}
                </div>
              )}
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
                Authentication runs through the existing auth flow. Phone numbers can now be updated here and used for
                WhatsApp reminders. Google account linking is also supported.
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
