import api from "./apiClient";

export const getPrivateSummary = () => api.get("private/transactions/summary/");

export const getPrivateTransactions = () => api.get("private/transactions/");

export const createPrivateTransaction = (payload) => api.post("private/transactions/", payload);

export const updatePrivateTransaction = (id, payload) =>
  api.patch(`private/transactions/${id}/`, payload);

export const deletePrivateTransaction = (id) =>
  api.delete(`private/transactions/${id}/`);

export const getPrivateItems = () => api.get("private/items/");

export const createPrivateItem = (payload) => api.post("private/items/", payload);

export const returnPrivateItem = (id) =>
  api.post(`private/items/${id}/return/`, { status: "RETURNED" });

export const getPrivateConnections = () => api.get("private/connections/");

export const getPrivateFriends = () => api.get("private/friends/");

export const addPrivateFriendByEmail = (payload) => api.post("private/friends/add/", payload);

export const getGroups = () => api.get("private/groups/");

export const createGroup = (payload) => api.post("private/groups/", payload);

export const addGroupMember = (groupId, payload) => api.post(`private/groups/${groupId}/add-member/`, payload);

export const removeGroupMember = (groupId, payload) =>
  api.post(`private/groups/${groupId}/remove-member/`, payload);

export const getOrCreateDirectThread = (payload) => api.post("private/chat/direct/", payload);

export const getGroupThread = (groupId) => api.get(`private/chat/group/${groupId}/`);

export const getThreadMessages = (threadId) => api.get(`private/chat/threads/${threadId}/messages/`);

export const sendThreadMessage = (threadId, payload) =>
  api.post(`private/chat/threads/${threadId}/messages/`, payload);
