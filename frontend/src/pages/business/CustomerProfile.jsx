import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { getCustomer } from "../../api/customers";
import { resolveHomeRoute, useAuth } from "../../context/AuthContext";
import LedgerSection from "../../components/LedgerSection";

const formatMoney = (value) => {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return "0.00";
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    if (user.account_type !== "BUSINESS") {
      navigate(resolveHomeRoute(user), { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    let active = true;
    const loadCustomer = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await getCustomer(id);
        if (active) setCustomer(data);
      } catch {
        if (active) setError("Unable to load customer profile.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadCustomer();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "28px 24px", fontFamily: "Inter, system-ui" }}>
        <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 }}>
          <div style={{ height: 26, width: 200, background: "#e2e8f0", borderRadius: 8 }} />
          <div style={{ background: "#ffffff", borderRadius: 14, padding: 16, border: "1px solid #e2e8f0" }}>
            <div style={{ height: 18, width: 240, background: "#e2e8f0", borderRadius: 8 }} />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "28px 24px", fontFamily: "Inter, system-ui" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid #fecdd3", background: "#fff1f2", color: "#b91c1c", fontWeight: 700 }}>
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!customer) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "28px 24px", fontFamily: "Inter, system-ui" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#0f172a" }}>{customer.name}</div>
            <div style={{ color: "#475569" }}>Customer profile and ledger overview.</div>
          </div>
          <Link
            to="/business/customers"
            style={{
              color: "#0f172a",
              fontWeight: 800,
              border: "1px solid #cbd5e1",
              padding: "8px 12px",
              borderRadius: 10,
              textDecoration: "none",
              background: "#ffffff",
            }}
          >
            Back to customers
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 12 }}>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, display: "grid", gap: 6 }}>
            <div style={{ color: "#475569", fontWeight: 700, fontSize: 13 }}>Outstanding balance</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Rs. {formatMoney(customer.outstanding_balance)}</div>
          </div>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, display: "grid", gap: 6 }}>
            <div style={{ color: "#475569", fontWeight: 700, fontSize: 13 }}>Opening balance</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Rs. {formatMoney(customer.opening_balance)}</div>
          </div>
        </div>

        <div style={{ border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 14, padding: 16, display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a" }}>Profile details</div>
          <div style={{ display: "grid", gap: 6, color: "#0f172a" }}>
            <div><strong>Phone:</strong> {customer.phone || "-"}</div>
            <div><strong>Address:</strong> {customer.address || "-"}</div>
            <div><strong>Notes:</strong> {customer.notes || "-"}</div>
          </div>
        </div>

        <div style={{ border: "1px dashed #cbd5e1", background: "#ffffff", borderRadius: 14, padding: 16, display: "grid", gap: 8 }}>
          <LedgerSection customerId={id} />
        </div>
      </div>
    </div>
  );
}
