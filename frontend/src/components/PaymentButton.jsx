import React, { useState } from 'react';
import axios from 'axios';

const PaymentButton = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get auth token from localStorage
      const token = localStorage.getItem('access_token');

      // Call backend to create checkout session
      const response = await axios.post(
        'http://localhost:8000/api/accounts/create-checkout-session/',
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      // Redirect to Stripe checkout
      if (response.data.checkout_url) {
        window.location.href = response.data.checkout_url;
      } else {
        setError('Failed to create checkout session');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(
        err.response?.data?.error || 
        'An error occurred while processing payment'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-button-container">
      <button 
        onClick={handlePayment} 
        disabled={loading}
        className="payment-button"
      >
        {loading ? 'Processing...' : 'Activate Business Account'}
      </button>
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
};

export default PaymentButton;
