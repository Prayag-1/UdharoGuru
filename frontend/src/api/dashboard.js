import apiClient from "./apiClient";

// Get dashboard analytics data
export const getDashboardData = () => {
  return apiClient.get("/business/dashboard/");
};
