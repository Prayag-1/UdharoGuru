import { useState } from 'react';
import '../styles/QRCodeDisplay.css';

export default function QRCodeDisplay({ paymentRequest, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (!paymentRequest.checkout_url) return;
    navigator.clipboard.writeText(paymentRequest.checkout_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenCheckout = () => {
    if (!paymentRequest.checkout_url) return;
    window.location.href = paymentRequest.checkout_url;
  };

  const handleOpenWhatsApp = () => {
    if (!paymentRequest.whatsapp_url) return;
    window.open(paymentRequest.whatsapp_url, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadQR = () => {
    if (!paymentRequest.qr_code_data) return;
    const link = document.createElement('a');
    link.href = paymentRequest.qr_code_data;
    link.download = `payment-qr-${paymentRequest.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="qr-modal-overlay" onClick={onClose}>
      <div className="qr-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="qr-modal-close" onClick={onClose}>x</button>

        <div className="qr-modal-header">
          <h2>Payment Request</h2>
          <p>Share with customer</p>
        </div>

        <div className="qr-modal-body">
          <div className="qr-amount-box">
            <span className="qr-amount-label">Amount Due</span>
            <span className="qr-amount-value">
              Rs. {parseFloat(paymentRequest.amount).toLocaleString('en-IN')}
            </span>
          </div>

          {paymentRequest.qr_code_data ? (
            <div className="qr-code-section">
              <h3>Scan to Pay</h3>
              <div className="qr-code-container">
                <img
                  src={paymentRequest.qr_code_data}
                  alt="Payment QR Code"
                  className="qr-code-image"
                />
              </div>
              <button
                className="btn-secondary btn-small"
                onClick={handleDownloadQR}
              >
                Download QR Code
              </button>
            </div>
          ) : (
            <div className="qr-fallback">
              <p>QR code not available</p>
            </div>
          )}

          <div className="qr-divider">OR</div>

          <div className="qr-link-section">
            <h3>Direct Payment Link</h3>
            <div className="qr-link-box">
              <input
                type="text"
                value={paymentRequest.checkout_url || ''}
                readOnly
                className="qr-link-input"
              />
              <button
                className={`btn-copy ${copied ? 'copied' : ''}`}
                onClick={handleCopyLink}
                disabled={!paymentRequest.checkout_url}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="qr-modal-actions">
            {paymentRequest.whatsapp_url && (
              <button
                className="btn-primary btn-block"
                onClick={handleOpenWhatsApp}
              >
                Open WhatsApp
              </button>
            )}
            <button
              className="btn-primary btn-block"
              onClick={handleOpenCheckout}
              disabled={!paymentRequest.checkout_url}
            >
              Open Checkout
            </button>
            <button
              className="btn-secondary btn-block"
              onClick={() => {
                navigator.share?.({
                  title: 'Payment Request',
                  text: paymentRequest.whatsapp_message || `Pay Rs. ${paymentRequest.amount}`,
                  url: paymentRequest.checkout_url,
                });
              }}
            >
              Share
            </button>
          </div>

          {paymentRequest.description && (
            <div className="qr-description">
              <p><strong>Note:</strong> {paymentRequest.description}</p>
            </div>
          )}
        </div>

        <div className="qr-modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
