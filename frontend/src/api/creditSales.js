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

export const downloadInvoice = async (id) => {
  const response = await api.get(`credit-sales/${id}/invoice/`, {
    responseType: 'blob'
  });
  
  // Extract filename from response headers
  const contentDisposition = response.headers['content-disposition'];
  let filename = 'invoice.pdf';
  if (contentDisposition) {
    const matches = contentDisposition.match(/filename="(.*)"/);
    if (matches) filename = matches[1];
  }
  
  // Create blob and download
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.parentElement.removeChild(link);
  window.URL.revokeObjectURL(url);
  
  return response;
};
