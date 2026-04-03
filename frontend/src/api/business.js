import api from "./apiClient";

export const getCreditSales = () => api.get("credit-sales/");

export const submitBusinessPayment = (formData) =>
  api.post("business/payment/submit/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const getBusinessStatus = () => api.get("business/status/");

export const submitBusinessKyc = (formData) =>
  api.post("business/kyc/submit/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const getBusinessProfile = () => api.get("business/profile/");

export const createBusinessProfile = (formData) =>
  api.post("business/profile/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const updateBusinessProfile = (formData) =>
  api.patch("business/profile/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const uploadBusinessOcr = (formData) => api.post("business/ocr/upload/", formData);

export const listBusinessOcr = () => api.get("business/ocr/");

export const getBusinessOcr = (id) => api.get(`business/ocr/${id}/`);

export const confirmBusinessOcr = (id, payload) =>
  api.post(`business/ocr/${id}/confirm/`, payload);

export const updateBusinessOcr = (id, payload) =>
  api.patch(`business/ocr/${id}/`, payload);

export const deleteBusinessOcr = (id) => api.delete(`business/ocr/${id}/`);

export const getBusinessLedger = () => api.get("business/ledger/");
export const getBusinessLedgerSummary = () => api.get("business/ledger/summary/");

export const addBusinessLedgerTransaction = (payload) =>
  api.post("business/ledger/add/", payload);

export const settleBusinessTransaction = (id) =>
  api.patch(`business/ledger/${id}/settle/`);

export const generateBusinessInvoice = (transactionId) =>
  api.post(`business/invoices/${transactionId}/generate/`);

export const listBusinessInvoices = () => api.get("business/invoices/");

export const getBusinessCustomerBalances = () => api.get("business/ledger/customers/");

export const getBusinessCustomerTransactions = (name) =>
  api.get(`business/ledger/customers/${encodeURIComponent(name)}/`);
