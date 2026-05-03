export default function VerificationCodeCard({
  title = "Verification Code",
  subtitle,
  code,
  onCodeChange,
  onSubmit,
  onResend,
  onBack,
  status,
  error,
  submitting = false,
  resendLabel = "Resend",
  submitLabel = "Confirm Code",
}) {
  const digits = Array.from({ length: 6 }, (_, index) => code[index] || "");

  const handleChange = (event) => {
    onCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6));
  };

  return (
    <div className="verification-stage">
      <div className="verification-card">
        <div className="verification-illustration" aria-hidden="true">
          <div className="mail-lines">
            <span />
            <span />
            <span />
          </div>
          <div className="mail-icon">
            <div className="phone-shape" />
            <div className="check-badge">✓</div>
          </div>
        </div>

        <h2>{title}</h2>
        {subtitle && <p className="verification-subtitle">{subtitle}</p>}

        {status && <div className="verification-status">{status}</div>}
        {error && <div className="verification-error">{error}</div>}

        <form onSubmit={onSubmit} className="verification-form">
          <label className="verification-code-wrap">
            <span className="sr-only">6-digit verification code</span>
            <input
              className="verification-code-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={handleChange}
              disabled={submitting}
              required
            />
            <span className="verification-digits" aria-hidden="true">
              {digits.map((digit, index) => (
                <span key={index} className={digit ? "filled" : ""}>
                  {digit}
                </span>
              ))}
              {code.length === 6 && <span className="digit-check">✓</span>}
            </span>
          </label>

          <button
            className="verification-primary"
            type="submit"
            disabled={submitting || code.length !== 6}
          >
            {submitting ? "Checking..." : submitLabel}
          </button>
        </form>

        <div className="verification-actions">
          {onResend && (
            <button type="button" onClick={onResend} disabled={submitting}>
              {resendLabel}
            </button>
          )}
          {onBack && (
            <button type="button" onClick={onBack} disabled={submitting}>
              Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
