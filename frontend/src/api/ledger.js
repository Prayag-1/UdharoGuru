import apiClient from "./apiClient";

// Get customer ledger with all credit sales and payments
export const getCustomerLedger = (customerId) => {
  return apiClient.get(`/customers/${customerId}/ledger/`);
};
