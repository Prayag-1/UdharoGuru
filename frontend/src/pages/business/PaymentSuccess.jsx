import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Processing your payment...');

  useEffect(() => {
    const fetchProfileStatus = async () => {
      try {
        const token = localStorage.getItem('access_token');

        // Wait a moment for webhook to process
        await new Promise(resolve => setTimeout(resolve, 2000));

        const response = await axios.get(
          'http://localhost:8000/api/accounts/profile-status/',
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            }
          }
        );

        const { business_status, kyc_status } = response.data;

        // Check if payment was approved
        if (business_status === 'KYC_PENDING') {
          setStatus('success');
          setMessage('Payment successful! Redirecting to KYC form...');
          
          // Redirect to KYC after 2 seconds
          setTimeout(() => {
            navigate('/business/kyc');
          }, 2000);
        } else if (business_status === 'PAYMENT_PENDING') {
          setStatus('processing');
          setMessage('Payment is still being processed. Please wait...');
          
          // Retry after 3 seconds
          setTimeout(fetchProfileStatus, 3000);
        } else {
          setStatus('processing');
          setMessage(`Current status: ${business_status}. Please refresh if this takes too long.`);
        }
      } catch (error) {
        console.error('Error fetching profile status:', error);
        setStatus('error');
        setMessage('Error retrieving payment status. Please refresh the page.');
      }
    };

    fetchProfileStatus();
  }, [navigate]);

  return (
    <div className="payment-success-container">
      <div className="success-card">
        {status === 'loading' && (
          <div className="loading">
            <div className="spinner"></div>
            <p>{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="success">
            <div className="success-icon">✓</div>
            <h2>Payment Successful!</h2>
            <p>{message}</p>
          </div>
        )}

        {status === 'processing' && (
          <div className="processing">
            <div className="spinner"></div>
            <h2>Processing Payment</h2>
            <p>{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="refresh-button"
            >
              Refresh Page
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="error">
            <div className="error-icon">✗</div>
            <h2>Error Processing Payment</h2>
            <p>{message}</p>
            <button 
              onClick={() => navigate('/business/dashboard')}
              className="return-button"
            >
              Return to Dashboard
            </button>
          </div>
        )}
      </div>

      <style>{`
        .payment-success-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 20px;
        }

        .success-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          padding: 40px;
          max-width: 500px;
          width: 100%;
          text-align: center;
        }

        .spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #667eea;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 20px auto;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .loading, .processing {
          padding: 20px 0;
        }

        .success-icon {
          font-size: 60px;
          color: #4caf50;
          margin: 20px 0;
        }

        .error-icon {
          font-size: 60px;
          color: #f44336;
          margin: 20px 0;
        }

        .success h2 {
          color: #4caf50;
          margin-bottom: 10px;
        }

        .error h2 {
          color: #f44336;
          margin-bottom: 10px;
        }

        .processing h2 {
          color: #ff9800;
          margin-bottom: 10px;
        }

        .success p, .error p, .processing p, .loading p {
          color: #666;
          font-size: 16px;
          line-height: 1.6;
        }

        .refresh-button, .return-button {
          margin-top: 20px;
          padding: 12px 30px;
          background-color: #667eea;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          cursor: pointer;
          transition: background-color 0.3s;
        }

        .refresh-button:hover, .return-button:hover {
          background-color: #5568d3;
        }
      `}</style>
    </div>
  );
};

export default PaymentSuccess;
