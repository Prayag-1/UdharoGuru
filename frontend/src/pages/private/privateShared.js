export const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("ne-NP", {
    style: "currency",
    currency: "NPR",
    minimumFractionDigits: 2,
  });

export const formatShortDate = (value, options = {}) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...options,
  });
};

export const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const buildGmailLink = ({ to, subject, body }) => {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to,
    su: subject,
    body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
};

export const normalizeConnection = (conn) => {
  const target = conn.connected_user || {};
  return {
    id: conn.connected_user_id || target.id || conn.id,
    email: conn.connected_user_email || target.email || conn.email || "",
    full_name: target.full_name || conn.full_name || "",
    invite_code: target.invite_code || conn.invite_code || "",
    connected_at: conn.connected_at || target.connected_at || "",
  };
};

export const connectionDisplayName = (conn) =>
  conn?.full_name || conn?.email || conn?.invite_code || `User ${conn?.id ?? ""}`;

const connectionAliases = (conn) =>
  [conn?.email, conn?.full_name, connectionDisplayName(conn)]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);

export const matchesConnection = (transaction, conn) => {
  const person = String(transaction?.person_name || "").trim().toLowerCase();
  if (!person) return false;
  return connectionAliases(conn).includes(person);
};

export const getConnectionBalanceMap = (connections, transactions) => {
  const balances = {};

  connections.forEach((conn) => {
    balances[conn.id] = 0;
  });

  transactions.forEach((tx) => {
    const amount = Number(tx.amount || 0);
    const delta = tx.transaction_type === "LENT" ? amount : -amount;
    const match = connections.find((conn) => matchesConnection(tx, conn));
    if (match) {
      balances[match.id] = (balances[match.id] || 0) + delta;
    }
  });

  return balances;
};

export const getConnectionTransactionMap = (connections, transactions) => {
  const map = {};

  connections.forEach((conn) => {
    map[conn.id] = transactions.filter((tx) => matchesConnection(tx, conn));
  });

  return map;
};
