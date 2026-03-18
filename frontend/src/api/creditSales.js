import api from "./apiClient";

export const getCreditSales = () => api.get("credit-sales/");
export const createCreditSale = (data) => api.post("credit-sales/", data);
export const getCreditSale = (id) => api.get(`credit-sales/${id}/`);
export const updateCreditSale = (id, data) => api.patch(`credit-sales/${id}/`, data);
export const deleteCreditSale = (id) => api.delete(`credit-sales/${id}/`);

export const addItemToCreditSale = (id, itemData) =>
  api.post(`credit-sales/${id}/add_item/`, itemData);

export const recordPayment = (id, amount) =>
  api.post(`credit-sales/${id}/record_payment/`, { amount });

export const getPendingCreditSales = () => api.get("credit-sales/pending/");
export const getCreditSalesSummary = () => api.get("credit-sales/summary/");
