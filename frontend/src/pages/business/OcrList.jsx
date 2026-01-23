import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { listBusinessOcr, uploadBusinessOcr } from "../../api/business";
import { useAuth } from "../../context/AuthContext";
import { useBusinessGate } from "../../hooks/useBusinessGate";

const statusStyle = (status) => {
  if (status === "CONFIRMED") {
    return { background: "#f1f5f9", color: "#475569", borderColor: "#e2e8f0" };
  }
  return { background: "#ecfeff", color: "#0f172a", borderColor: "#c0e8ed" };
};

const formatCurrency = (value) => {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return num.toLocaleString("en-US", { style: "currency", currency: "USD" });
};

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export default function OcrList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { loading: gateLoading } = useBusinessGate("/business/ocr");
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [success, setSuccess] = useState(location.state?.success || "");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await listBusinessOcr();
      const rows = Array.isArray(data) ? data : data?.results || [];
      setDocs(rows);
    } catch (err) {
      setError("Unable to load OCR documents right now.");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (gateLoading) return;
    if (!user) {
      setLoading(false);
      setError("Login required.");
      return;
    }
    if (user.account_type !== "BUSINESS") {
      setLoading(false);
      setError("Business account required for OCR.");
      return;
    }
    load();
  }, [gateLoading, user]);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    setSuccess("");
    try {
      const form = new FormData();
      form.append("image", file);
      const { data } = await uploadBusinessOcr(form);
      navigate(`/business/ocr/${data.id}`, { replace: false });
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.response?.data?.image?.[0] ||
        "Unable to upload. Please try again.";
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  const sortedDocs = useMemo(() => {
    const copy = [...docs];
    copy.sort((a, b) => {
      if (a.status === b.status) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return a.status === "DRAFT" ? -1 : 1;
    });
    return copy;
  }, [docs]);

  return (
    <div style={{ padding: "28px 26px", maxWidth: 1100, margin: "0 auto", fontFamily: "Inter, system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#0f172a" }}>OCR Documents</div>
          <div style={{ color: "#475569" }}>Upload receipts, review the extraction, and confirm into transactions.</div>
        </div>
        <UploadButton disabled={uploading} onFile={handleUpload} />
      </div>

      {success && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: "1px solid #bbf7d0", background: "#ecfdf3", color: "#166534", fontWeight: 700 }}>
          {success}
        </div>
      )}
      {uploadError && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: "1px solid #fecdd3", background: "#fff1f2", color: "#b91c1c", fontWeight: 700 }}>
          {uploadError}
        </div>
      )}
      {error && (
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid #fecdd3", background: "#fff1f2", color: "#b91c1c", fontWeight: 700 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ marginTop: 16, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, height: 180 }} />
      ) : sortedDocs.length === 0 ? (
        <div style={{ marginTop: 16, padding: 24, border: "1px dashed #cbd5e1", borderRadius: 12, background: "#f8fafc", textAlign: "center", color: "#475569" }}>
          No OCR documents yet. Upload a receipt to begin.
        </div>
      ) : (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 0.6fr", padding: "10px 12px", fontWeight: 800, color: "#1e293b", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12 }}>
            <span>Uploaded</span>
            <span>Merchant</span>
            <span>Amount</span>
            <span>Status</span>
          </div>
          {sortedDocs.map((doc) => (
            <div
              key={doc.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1fr 0.6fr",
                padding: "12px 12px",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                background: doc.status === "CONFIRMED" ? "#f8fafc" : "#ffffff",
                color: "#0f172a",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>{formatDate(doc.created_at)}</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>ID #{doc.id}</div>
              </div>
              <div style={{ fontWeight: 700 }}>{doc.extracted_merchant || "Unknown"}</div>
              <div style={{ fontWeight: 800 }}>{formatCurrency(doc.extracted_amount)}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 800,
                    border: "1px solid",
                    ...statusStyle(doc.status),
                  }}
                >
                  {doc.status}
                </span>
                <Link
                  to={`/business/ocr/${doc.id}`}
                  style={{
                    marginLeft: "auto",
                    fontWeight: 800,
                    color: "#0f172a",
                    textDecoration: "none",
                    border: "1px solid #e2e8f0",
                    padding: "8px 10px",
                    borderRadius: 10,
                    background: "#f8fafc",
                  }}
                >
                  {doc.status === "DRAFT" ? "Review" : "View"}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UploadButton({ onFile, disabled }) {
  const [hover, setHover] = useState(false);
  return (
    <label
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid #cbd5e1",
        background: hover ? "#0f172a" : "#0f1f3c",
        color: "#ffffff",
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <span style={{ fontSize: 14 }}>Upload receipt</span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        style={{ display: "none" }}
        onChange={(e) => {
          if (disabled) return;
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </label>
  );
}
