// ──────────────────────────────────────────────────────────
// src/services/api.js — Core API helpers with 403 Forbidden handling
// ──────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

/**
 * Attach the stored auth token to every request.
 */
function authHeaders() {
  const token = localStorage.getItem("stocksense_token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

/**
 * Standardize error handling for 400, 401, 403, 404, 409, and 500 status codes.
 */
async function handleResponse(response) {
  if (response.ok) {
    return response.json();
  }

  const errorBody = await response.json().catch(() => ({}));
  let message = errorBody.message || errorBody.error;

  switch (response.status) {
    case 400:
      message = message || "Bad request. Please verify submitted values.";
      break;
    case 401:
      message = message || "Session expired or unauthorized. Please log in.";
      break;
    case 403:
      message = message || "You don't have permission for this action.";
      break;
    case 404:
      message = message || "Requested resource not found.";
      break;
    case 409:
      message = message || "Conflict or insufficient stock for this operation.";
      break;
    case 429:
      message = message || "Please wait before requesting another code.";
      break;
    case 500:
      message = message || "Internal server error. Please try again later.";
      break;
    default:
      message = message || `API error: ${response.status} ${response.statusText}`;
      break;
  }

  const err = new Error(message);
  err.status = response.status;
  err.retryAfter = response.headers.get("Retry-After");
  err.isForbidden = response.status === 403;
  err.data = errorBody;
  throw err;
}

/**
 * Generic GET request.
 */
export async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: authHeaders(),
  });
  return handleResponse(response);
}

/**
 * Generic POST request.
 */
export async function apiPost(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(response);
}

/**
 * Generic PUT request.
 */
export async function apiPut(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(response);
}

/**
 * Generic DELETE request.
 */
export async function apiDelete(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse(response);
}

/**
 * Backend health check.
 */
export async function getHealth() {
  return apiGet("/api/health");
}
