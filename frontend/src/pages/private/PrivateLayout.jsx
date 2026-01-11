import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { clearTokens } from "../../api/apiClient";
import { getMe } from "../../api/auth";
import { getPrivateConnections } from "../../api/private";
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

  const inviteCode = user?.invite_code || "";

  const navItems = useMemo(
    () => [
      { to: "/private/dashboard", label: "Dashboard" },
      { to: "/private/activity", label: "Recent activity" },
      { to: "/private/expenses", label: "All expenses" },
      { to: "/private/friends", label: "Friends" },
    ],
    []
  );

  const handleLogout = () => {
    clearTokens();
    navigate("/auth/login", { replace: true });
  };

  const handleCopy = async () => {
    if (!inviteCode || !navigator?.clipboard) return;
    await navigator.clipboard.writeText(inviteCode);
  };

  return (
    <div className="private-layout">
      <header className="top-bar">
        <div className="app-title">Udharo Guru</div>
        <div className="user-menu">
          {loading ? (
            <SkeletonBlock height={20} />
          ) : (
            <>
              <span className="muted" style={{ fontWeight: 700 }}>{user?.email}</span>
              <button className="button secondary" type="button" onClick={() => navigate("/private/dashboard")}>
                Your account
              </button>
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
                  Copy
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
