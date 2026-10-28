const BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
const TOKEN_KEY = "documind_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function messageFrom(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg.replace(/^Value error, /, "");
  return "Something went wrong.";
}

async function request(path, { method = "GET", json, body } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: json ? JSON.stringify(json) : body });
  } catch {
    throw new ApiError("Cannot reach the server. Is the backend running?", 0);
  }
  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) throw new ApiError(messageFrom(data?.detail), res.status);
  return data;
}

export const api = {
  register: (email, password) => request("/auth/register", { method: "POST", json: { email, password } }),
  login: (email, password) => request("/auth/login", { method: "POST", json: { email, password } }),
  documents: () => request("/documents"),
  upload: (file) => {
    const form = new FormData();
    form.append("file", file);
    return request("/documents", { method: "POST", body: form });
  },
  removeDocument: (id) => request(`/documents/${id}`, { method: "DELETE" }),
  ask: (question, documentId) =>
    request("/ask", { method: "POST", json: { question, document_id: documentId ?? null } }),
  exams: () => request("/exams"),
  // Generation calls the model for a whole test, so this can take a minute.
  createExam: (documentId, { count, type, difficulty }) =>
    request("/exams", {
      method: "POST",
      json: { document_id: documentId, count, question_type: type, difficulty },
    }),
  exam: (id) => request(`/exams/${id}`),
  submitAttempt: (id, responses) => request(`/exams/${id}/attempt`, { method: "POST", json: { responses } }),
  removeExam: (id) => request(`/exams/${id}`, { method: "DELETE" }),
  history: () => request("/history"),
  clearHistory: () => request("/history", { method: "DELETE" }),
};
