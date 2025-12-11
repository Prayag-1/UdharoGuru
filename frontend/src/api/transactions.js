import api from "./apiClient";

export const getTransactions = (customerId = null) =>
  api.get("transactions/", {
    params: customerId ? { customer: customerId } : {},
  });

export const createTransaction = (data) =>
  api.post("transactions/", data);

export const getSummary = (customerId) =>
  api.get("transactions/summary/", {
    params: { customer: customerId },
  });
