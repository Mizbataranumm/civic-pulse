import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("cp_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const CATEGORY_LABELS = {
  pothole: "Pothole",
  garbage: "Garbage",
  water_leakage: "Water Leakage",
  streetlight: "Streetlight",
  drainage: "Drainage",
  sewage: "Sewage",
  illegal_construction: "Illegal Construction",
  other: "Other",
};

export const STATUS_LABELS = {
  submitted: "Submitted",
  acknowledged: "Acknowledged",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const STATUS_COLORS = {
  submitted: { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444", border: "rgba(239, 68, 68, 0.4)" },
  acknowledged: { bg: "rgba(245, 158, 11, 0.15)", text: "#f59e0b", border: "rgba(245, 158, 11, 0.4)" },
  in_progress: { bg: "rgba(6, 182, 212, 0.15)", text: "#06b6d4", border: "rgba(6, 182, 212, 0.4)" },
  verification_pending: { bg: "rgba(245, 158, 11, 0.15)", text: "#f59e0b", border: "rgba(245, 158, 11, 0.4)" },
  suspicious_resolution: { bg: "rgba(239, 68, 68, 0.15)", text: "#ef4444", border: "rgba(239, 68, 68, 0.4)" },
  resolved: { bg: "rgba(16, 185, 129, 0.15)", text: "#10b981", border: "rgba(16, 185, 129, 0.4)" },
  closed: { bg: "rgba(148, 163, 184, 0.15)", text: "#94a3b8", border: "rgba(148, 163, 184, 0.4)" },
};

export const PRIORITY_COLORS = {
  low: { bg: "rgba(148, 163, 184, 0.15)", text: "#94a3b8" },
  medium: { bg: "rgba(6, 182, 212, 0.15)", text: "#06b6d4" },
  high: { bg: "rgba(245, 158, 11, 0.18)", text: "#f59e0b" },
  critical: { bg: "rgba(239, 68, 68, 0.2)", text: "#ef4444" },
};

export const CATEGORY_ICONS = {
  pothole: "fa-road",
  garbage: "fa-trash",
  water_leakage: "fa-droplet",
  streetlight: "fa-lightbulb",
  drainage: "fa-water",
  sewage: "fa-poo",
  illegal_construction: "fa-helmet-safety",
  fallen_tree: "fa-tree",
  other: "fa-circle-exclamation",
};
