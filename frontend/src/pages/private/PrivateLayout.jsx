import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { clearTokens } from "../../api/apiClient";
import { getMe } from "../../api/auth";
import { getPrivateConnections } from "../../api/private";
import { getNotifications, markNotificationRead } from "../../api/notifications";
import "./PrivateDashboard.css";

const SkeletonBlock = ({ height = 48 }) => (
  <div className="skeleton" style={{ width: "100%", height, borderRadius: 10 }} />
);

export default function PrivateLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copyState, setCopyState] = useState("idle");
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState(null);
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem("private_theme") || "light";
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [meRes, connRes] = await Promise.all([getMe(), getPrivateConnections()]);
        if (!active) return;
        if (meRes.data?.account_type !== "PRIVATE") {
          throw new Error("Private account required.");
        }
        setUser(meRes.data);
        setConnections(Array.isArray(connRes.data) ? connRes.data : connRes.data?.results || []);
      } catch (err) {
        console.error("Failed to load private layout data", err);
        if (!active) return;
        setError("Unable to load account.");
        setUser(null);
        clearTokens();
        navigate("/auth/login", { replace: true });
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("private_theme", theme);
  }, [theme]);

  const loadNotifications = async (opts = {}) => {
    const { silent = false } = opts;
    if (!user) {
      setNotifications([]);
      return;
    }
    if (!silent) {
      setNotifLoading(true);
      setNotifError(null);
    }
    try {
      const { data } = await getNotifications();
      const list = Array.isArray(data) ? data : data?.results || [];
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setNotifications(list);
    } catch (err) {
      console.error("Failed to load notifications", err);
      setNotifications([]);
      setNotifError("Unable to load notifications.");
    } finally {
      if (!silent) setNotifLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadNotifications({ silent: true });
  }, [user]);

  useEffect(() => {
    if (user && notifOpen) {
      loadNotifications({ silent: true });
    }
  }, [notifOpen, user]);

  const inviteCode = user?.invite_code || "";

  const navItems = useMemo(
    () => [
      { to: "/private/dashboard", label: "Dashboard" },
      { to: "/private/activity", label: "Recent activity" },
      { to: "/private/expenses", label: "All expenses" },
      { to: "/private/friends", label: "Friends" },
      { to: "/private/groups", label: "Groups" },
    ],
    []
  );

  const handleLogout = () => {
    clearTokens();
    navigate("/auth/login", { replace: true });
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleToggleNotifications = () => {
    setNotifOpen((prev) => !prev);
  };

  const handleMarkRead = async (notif) => {
    if (!notif || notif.is_read) return;
    try {
      await markNotificationRead(notif.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error("Failed to mark notification read", err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleCopy = async () => {
    if (!inviteCode) return;
    if (!navigator?.clipboard) {
      setCopyState("error");
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopyState("copied");
    } catch (copyError) {
      console.error("Failed to copy invite code", copyError);
      setCopyState("error");
    }
  };

  useEffect(() => {
    if (copyState !== "copied" && copyState !== "error") return;
    const timer = setTimeout(() => setCopyState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [copyState]);

  if (loading) {
    return (
      <div className={`private-layout ${theme === "dark" ? "dark" : ""}`}>
        <header className="top-bar">
          <div className="app-title">Udharo Guru</div>
          <div className="user-menu">
            <SkeletonBlock height={20} />
          </div>
        </header>

        <div className="layout-shell">
          <aside className="sidebar">
            <div className="sidebar-nav">
              {[...Array(5)].map((_, idx) => (
                <SkeletonBlock key={idx} height={38} />
              ))}
            </div>
            <div className="sidebar-section">
              <SkeletonBlock height={32} />
            </div>
          </aside>

          <main className="main-content">
            <div className="dashboard-shell">
              <div className="section-card">
                <SkeletonBlock height={28} />
              </div>
              <div className="grid-3">
                <SkeletonBlock height={96} />
                <SkeletonBlock height={96} />
                <SkeletonBlock height={96} />
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={`private-layout ${theme === "dark" ? "dark" : ""}`}>
      <header className="top-bar">
        <div className="app-title">Udharo Guru</div>
        <div className="user-menu">
          {loading ? (
            <SkeletonBlock height={20} />
          ) : (
            <>
              <button className="theme-toggle" type="button" onClick={toggleTheme} aria-pressed={theme === "dark"}>
                <span className="theme-toggle-track">
                  <span className="theme-toggle-thumb" />
                </span>
                <span className="theme-toggle-text">{theme === "dark" ? "Dark" : "Light"}</span>
              </button>
              <div className="notif-wrap">
                <button
                  className="notification-bell"
                  type="button"
                  onClick={handleToggleNotifications}
                  aria-label="Notifications"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-14 0v5l-2 2v1h18v-1l-2-2Zm-2 1H7v-6a5 5 0 0 1 10 0v6Z"
                      fill="currentColor"
                    />
                  </svg>
                  {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
                </button>
                {notifOpen && (
                  <div className="notification-panel">
                    <div className="notification-title">Notifications</div>
                    {notifError && <div className="error-text">{notifError}</div>}
                    {notifLoading ? (
                      <div className="muted">Loading...</div>
                    ) : notifications.length === 0 ? (
                      <div className="muted">No notifications yet.</div>
                    ) : (
                      <div className="notification-list">
                        {notifications.map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            className={`notification-item ${n.is_read ? "" : "unread"}`}
                            onClick={() => handleMarkRead(n)}
                          >
                            <div className="notification-message">{n.message}</div>
                            <div className="notification-meta">
                              <span>{n.sender_name || "Someone"}</span>
                              <span>
                                {n.transaction_source === "private" ? "PVT" : "TX"}-{n.transaction_id || "--"}
                              </span>
                              <span>{new Date(n.created_at).toLocaleString()}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <span className="muted" style={{ fontWeight: 700 }}>{user?.email}</span>
              <button className="button" type="button" onClick={handleLogout}>
                Log out
              </button>
            </>
          )}
        </div>
      </header>

      <div className="layout-shell">
        <aside className="sidebar">
          <div className="sidebar-nav">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
          <div className="sidebar-section">
            <div className="label" style={{ fontSize: 12, letterSpacing: 0.5 }}>Invite friends</div>
            {loading ? (
              <SkeletonBlock height={32} />
            ) : (
              <div className="invite-box">
                <input className="input" value={inviteCode} readOnly />
                <button className="button secondary" type="button" onClick={handleCopy} disabled={!inviteCode}>
                  {copyState === "copied" ? "Copied!" : copyState === "error" ? "Copy failed" : "Copy"}
                </button>
              </div>
            )}
          </div>
          {error && <div className="error-text">{error}</div>}
        </aside>

        <main className="main-content">
          <Outlet context={{ user, connections, setConnections }} />
        </main>
      </div>
    </div>
  );
}
