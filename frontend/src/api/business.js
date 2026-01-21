import api from "./apiClient";

export const submitBusinessPayment = (formData) =>
  api.post("business/payment/submit/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const getBusinessStatus = () => api.get("business/status/");

export const submitBusinessKyc = (formData) =>
  api.post("business/kyc/submit/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const uploadBusinessOcr = (formData) => api.post("business/ocr/upload/", formData);

export const listBusinessOcr = () => api.get("business/ocr/");

export const getBusinessOcr = (id) => api.get(`business/ocr/${id}/`);

export const confirmBusinessOcr = (id, payload) =>
  api.post(`business/ocr/${id}/confirm/`, payload);
