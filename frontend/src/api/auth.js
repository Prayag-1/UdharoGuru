import api from "./apiClient";

export const login = (credentials) => api.post("auth/login/", credentials);
export const register = (payload) => api.post("auth/register/", payload);
export const getMe = () => api.get("auth/me/");
