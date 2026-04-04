import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { clearTokens } from "../../api/apiClient";
import { useBusinessGate } from "../../hooks/useBusinessGate";
import "./BusinessLayout.css";

export default function BusinessLayout() {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { loading, business_status, payment, kyc } = useBusinessGate(location.pathname);
  const isApproved = business_status === "APPROVED";
  const showPayment = !payment?.is_verified;
  const showKyc = payment?.is_verified && !kyc?.is_approved && business_status !== "UNDER_REVIEW" && business_status !== "REJECTED";

  const navItems = [
    { to: "/business/dashboard", label: "Dashboard" },
    { to: "/business/products", label: "Products", requiresApproval: true },
    { to: "/business/customers", label: "Customers", requiresApproval: true },
    { to: "/business/credit-sales", label: "Credit Sales", requiresApproval: true },
    { to: "/business/payments", label: "Payments", requiresApproval: true },
    { to: "/business/ocr", label: "OCR", requiresApproval: true },
    { to: "/business/payment", label: "Payment", visible: showPayment },
    { to: "/business/kyc", label: "KYC", visible: showKyc },
  ];

  const handleLogout = () => {
    clearTokens();
    window.location.replace("/auth/login");
  };

  // Don't unmount Outlet—show overlay instead to prevent component remounting
  if (!user && authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="business-layout">
      {/* Loading overlay while business gate is checking */}
      {loading && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(255,255,255,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div>Loading...</div>
        </div>
      )}

      <aside className="business-sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-title">Udharo</h1>
          <p className="sidebar-subtitle">Business</p>
        </div>

        <nav className="sidebar-nav">
          {navItems
            .filter((item) => item.visible !== false)
            .filter((item) => isApproved || !item.requiresApproval)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `sidebar-nav-item ${isActive ? "active" : ""}`
                }
              >
                {item.label}
              </NavLink>
            ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-name">{user?.full_name || user?.email || "User"}</div>
            <div className="user-type">Business Account</div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="business-main">
        <Outlet />
      </main>
    </div>
  );
}
