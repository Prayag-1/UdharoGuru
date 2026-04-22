import api from './apiClient';

/**
 * Payment Request API functions
 */

export const createPaymentRequest = async (data) => {
  /**
   * Create a new payment request
   * @param {Object} data
   *   - request_type: "PRIVATE" or "BUSINESS"
   *   - receiver_id: (for PRIVATE)
   *   - customer_id: (for BUSINESS)
   *   - amount: number
   *   - description: string (optional)
   */
  return api.post('/payment-requests/create_payment_request/', data);
};

export const getPaymentRequest = async (id) => {
  return api.get(`/payment-requests/${id}/`);
};

export const listSentRequests = async () => {
  return api.get('/payment-requests/sent_requests/');
};

export const listReceivedRequests = async () => {
  return api.get('/payment-requests/received_requests/');
};

export const listPendingCustomerRequests = async () => {
  return api.get('/payment-requests/pending_customer_requests/');
};

export const getPublicPaymentRequest = async (id) => {
  return api.get(`/payment-requests/${id}/get_public_request/`);
};

export const cancelPaymentRequest = async (id) => {
  return api.post(`/payment-requests/${id}/cancel_request/`);
};

export const getCheckoutUrl = async (paymentRequestId) => {
  const response = await getPaymentRequest(paymentRequestId);
  return response.data.checkout_url;
};

export const getQRCode = async (paymentRequestId) => {
  const response = await getPaymentRequest(paymentRequestId);
  return response.data.qr_code_data;
};
