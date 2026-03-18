import api from "./apiClient";

export const getPayments = () => api.get("payments/");
export const createPayment = (data) => api.post("payments/", data);
export const getPayment = (id) => api.get(`payments/${id}/`);
export const updatePayment = (id, data) => api.patch(`payments/${id}/`, data);
export const deletePayment = (id) => api.delete(`payments/${id}/`);

export const getPaymentsBySale = (saleId) =>
  api.get("payments/by_sale/", { params: { sale: saleId } });

export const getPaymentsByCustomer = (customerId) =>
  api.get("payments/by_customer/", { params: { customer: customerId } });

export const getPaymentsSummary = () => api.get("payments/summary/");
