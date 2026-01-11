import api from "./apiClient";

export const getPrivateSummary = () => api.get("private/transactions/summary/");

export const getPrivateTransactions = () => api.get("private/transactions/");

export const createPrivateTransaction = (payload) => api.post("private/transactions/", payload);

export const updatePrivateTransaction = (id, payload) =>
  api.patch(`private/transactions/${id}/`, payload);

export const deletePrivateTransaction = (id) =>
  api.delete(`private/transactions/${id}/`);

export const getPrivateItems = () => api.get("private/items/");

export const createPrivateItem = (payload) => api.post("private/items/", payload);

export const returnPrivateItem = (id) =>
  api.post(`private/items/${id}/return/`, { status: "RETURNED" });

export const getPrivateConnections = () => api.get("private/connections/");
