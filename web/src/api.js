const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
let pendingRequests = 0;
const listeners = new Set();
const TOKEN_KEY = "priostack_auth_token";
let authToken = localStorage.getItem(TOKEN_KEY) || "";

function notifyLoading() {
  const isLoading = pendingRequests > 0;
  listeners.forEach((listener) => listener(isLoading));
}

export function subscribeApiLoading(listener) {
  listeners.add(listener);
  listener(pendingRequests > 0);
  return () => listeners.delete(listener);
}

export function setAuthToken(token) {
  authToken = token || "";
  if (authToken) {
    localStorage.setItem(TOKEN_KEY, authToken);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getAuthToken() {
  return authToken;
}

async function req(path, options = {}, meta = {}) {
  pendingRequests += 1;
  notifyLoading();
  try {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (!meta.omitAuth && authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    const res = await fetch(`${API}${path}`, {
      headers,
      ...options,
    });
    if (!res.ok) {
      if (res.status === 401 && !meta.omitAuth) {
        setAuthToken("");
      }
      const text = await res.text();
      try {
        const parsed = JSON.parse(text);
        throw new Error(parsed.detail || `Request failed: ${res.status}`);
      } catch {
        throw new Error(text || `Request failed: ${res.status}`);
      }
    }
    if (res.status === 204) return null;
    return res.json();
  } finally {
    pendingRequests = Math.max(0, pendingRequests - 1);
    notifyLoading();
  }
}

export const api = {
  authStatus: () => req("/auth/status"),
  setupMasterPassword: (password) => req("/auth/setup", { method: "POST", body: JSON.stringify({ password }) }, { omitAuth: true }),
  login: (password) => req("/auth/login", { method: "POST", body: JSON.stringify({ password }) }, { omitAuth: true }),
  forgotPassword: (newPassword) =>
    req("/auth/forgot-password", { method: "POST", body: JSON.stringify({ new_password: newPassword }) }, { omitAuth: true }),
  listGoals: () => req("/goals"),
  createGoal: (payload) => req("/goals", { method: "POST", body: JSON.stringify(payload) }),
  updateGoal: (goalId, payload) => req(`/goals/${goalId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteGoal: (goalId) => req(`/goals/${goalId}`, { method: "DELETE" }),
  reorderGoals: (payload) => req("/goals/reorder", { method: "POST", body: JSON.stringify(payload) }),
  listAllProjects: () => req("/projects"),
  listProjects: (goalId) => req(`/goals/${goalId}/projects`),
  createProject: (goalId, payload) => req(`/goals/${goalId}/projects`, { method: "POST", body: JSON.stringify(payload) }),
  updateProject: (projectId, payload) => req(`/projects/${projectId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  listAllTasks: () => req("/tasks"),
  listTasks: (projectId) => req(`/projects/${projectId}/tasks`),
  createTask: (projectId, payload) => req(`/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify(payload) }),
  updateTask: (taskId, payload) => req(`/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteTask: (taskId) => req(`/tasks/${taskId}`, { method: "DELETE" }),
  completeTask: (taskId) => req(`/tasks/${taskId}/complete`, { method: "POST" }),
  listPendingNotifications: (sendEmail = false) => req(`/notifications/pending?send_email=${sendEmail ? "true" : "false"}`),
  getNotificationSettings: () => req("/notifications/settings"),
  updateNotificationSettings: (payload) => req("/notifications/settings", { method: "PATCH", body: JSON.stringify(payload) }),
  sendTestNotification: () => req("/notifications/send-test", { method: "POST" }),
};
