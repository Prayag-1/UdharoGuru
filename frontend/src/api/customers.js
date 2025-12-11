import api from "./apiClient";

export const getCustomers = () => api.get("customers/");
export const createCustomer = (data) => api.post("customers/", data);
export const deleteCustomer = (id) => api.delete(`customers/${id}/`);
