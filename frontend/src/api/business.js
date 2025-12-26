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
