import api from "./apiClient";

export const getProducts = () => api.get("products/");
export const createProduct = (data) => api.post("products/", data);
export const getProduct = (id) => api.get(`products/${id}/`);
export const updateProduct = (id, data) => api.patch(`products/${id}/`, data);
export const deleteProduct = (id) => api.delete(`products/${id}/`);
