import { useEffect, useMemo, useRef } from "react";

const formatTimestamp = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const sortMessages = (messages = []) =>
  [...messages].sort(
    (a, b) => new Date(a?.created_at || 0).getTime() - new Date(b?.created_at || 0).getTime()
  );

export default function ChatPanel({
  title,
  subtitle,
  loading,
  messages = [],
  inputValue,
  onInputChange,
  onSend,
  sending,
  onClose,
  emptyLabel = "No messages yet.",
  currentUserEmail,
  error,
}) {
  const listRef = useRef(null);
  const normalizedEmail = (currentUserEmail || "").toLowerCase();

  const orderedMessages = useMemo(() => sortMessages(messages), [messages]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [orderedMessages.length, loading]);

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (!inputValue?.trim() || sending) return;
    if (typeof onSend === "function") onSend(e);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="section-card chat-panel">
      <div className="chat-header">
        <div>
          <div style={{ fontWeight: 800 }}>{title}</div>
          {subtitle && <div className="muted" style={{ fontSize: 13 }}>{subtitle}</div>}
        </div>
        {onClose && (
          <button className="button secondary" type="button" onClick={onClose}>
            Close
          </button>
        )}
      </div>

      {error && <div className="error-text">{error}</div>}

      {loading ? (
        <div className="skeleton" style={{ width: "100%", height: 180 }} />
      ) : (
        <>
          <div className="chat-body" ref={listRef}>
            <div className="chat-messages">
              {orderedMessages.length === 0 ? (
                <div className="chat-empty">{emptyLabel}</div>
              ) : (
                orderedMessages.map((m) => {
                  const isSelf = normalizedEmail && m.sender_email?.toLowerCase() === normalizedEmail;
                  return (
                    <div key={m.id || `${m.created_at}-${m.message}`} className={isSelf ? "chat-row me" : "chat-row"}>
                      <div className="chat-meta">
                        <span className="chat-author">{isSelf ? "You" : m.sender_email}</span>
                        <span className="chat-time">{formatTimestamp(m.created_at)}</span>
                      </div>
                      <div className={isSelf ? "chat-bubble self" : "chat-bubble"}>{m.message}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="chat-footer">
            <textarea
              className="chat-input"
              placeholder="Type a message"
              value={inputValue}
              onChange={(e) => onInputChange?.(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
            />
            <button className="button chat-send" type="submit" disabled={sending || !inputValue?.trim()}>
              {sending ? "Sending..." : "Send"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
