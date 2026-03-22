import { useNavigate } from "react-router-dom";
import "./BusinessNav.css";

export default function BusinessNav() {
  const navigate = useNavigate();

  const menuItems = [
    { label: "Dashboard", path: "/business/dashboard", icon: "📊" },
    { label: "Customers", path: "/business/customers", icon: "👥" },
    { label: "Credit Sales", path: "/business/credit-sales", icon: "📝" },
    { label: "Payments", path: "/business/payments", icon: "💰" },
    { label: "OCR Upload", path: "/business/ocr/upload", icon: "📸" },
    { label: "Ledger", path: "/business/ledger", icon: "📚" },
  ];

  return (
    <nav className="business-nav">
      <div className="nav-container">
        <div className="nav-menu">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="nav-item"
              title={item.label}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
