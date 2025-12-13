import api from "./apiClient";

export const login = (credentials) =>
  api.post("auth/login/", credentials);

export const refreshToken = (refresh) =>
  api.post("auth/refresh/", { refresh });
