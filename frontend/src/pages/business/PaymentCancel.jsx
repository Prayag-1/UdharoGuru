import React from 'react';
import { useNavigate } from 'react-router-dom';

const PaymentCancel = () => {
  const navigate = useNavigate();

  return (
    <div className="payment-cancel-container">
      <div className="cancel-card">
        <div className="cancel-icon">✗</div>
        <h2>Payment Cancelled</h2>
        <p>Your payment was cancelled. You can try again whenever you're ready.</p>
        
        <div className="button-group">
          <button 
            onClick={() => navigate(-1)}
            className="retry-button"
          >
            Try Again
          </button>
          <button 
            onClick={() => navigate('/business/dashboard')}
            className="return-button"
          >
            Return to Dashboard
          </button>
        </div>
      </div>

      <style>{`
        .payment-cancel-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
        }

        .cancel-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          padding: 40px;
          max-width: 500px;
          width: 100%;
          text-align: center;
        }

        .cancel-icon {
          font-size: 60px;
          color: #ff9800;
          margin: 20px 0;
        }

        h2 {
          color: #ff9800;
          margin-bottom: 10px;
        }

        p {
          color: #666;
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 30px;
        }

        .button-group {
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .retry-button, .return-button {
          padding: 12px 30px;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
          transition: background-color 0.3s;
        }

        .retry-button {
          background-color: #4caf50;
          color: white;
        }

        .retry-button:hover {
          background-color: #45a049;
        }

        .return-button {
          background-color: #667eea;
          color: white;
        }

        .return-button:hover {
          background-color: #5568d3;
        }
      `}</style>
    </div>
  );
};

export default PaymentCancel;
