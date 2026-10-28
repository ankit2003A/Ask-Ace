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

/* Each stage of indexing owns a slice of the bar, sized by how long it
   actually takes: on a 143-page PDF, reading pages is about 1s and embedding
   about 4.5s of the total. Within a stage the bar moves with real work done
   (pages read, chunks embedded), so the percentage is never invented. */
const STAGES = {
  uploading: { from: 0, to: 5, label: "Uploading" },
  reading: { from: 5, to: 20, label: "Reading pages" },
  embedding: { from: 20, to: 97, label: "Learning your PDF" },
  saving: { from: 97, to: 99, label: "Saving" },
  done: { from: 100, to: 100, label: "Ready" },
};

export function progressOf({ stage, done = 1, total = 1 }) {
  const { from, to, label } = STAGES[stage];
  const share = total > 0 ? Math.min(1, done / total) : 1;
  return { label, percent: Math.round(from + (to - from) * share) };
}

/* Progress arrives from two sources (upload bytes, then server events);
   use with setState so the bar never steps backwards between them. */
export const advance = (next) => (prev) => ({
  ...next,
  percent: Math.max(prev?.percent ?? 0, next.percent),
});

/* Upload a PDF and report indexing progress as it happens.

   XMLHttpRequest rather than fetch: it is the only browser API that reports
   upload progress and can also read the server's streamed events as they
   arrive. The server sends one JSON event per line (see the documents
   router), ending in "done" with the document, or "error". */
function uploadWithProgress(file, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/documents?stream=true`);
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    let read = 0;
    let document = null;
    let failure = null;

    function drain() {
      const text = xhr.responseText;
      let end;
      while ((end = text.indexOf("\n", read)) !== -1) {
        const line = text.slice(read, end).trim();
        read = end + 1;
        if (!line) continue;
        const event = JSON.parse(line);
        if (event.stage === "done") document = event.document;
        else if (event.stage === "error") failure = new ApiError(event.detail, event.status);
        else onProgress(progressOf(event));
      }
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(progressOf({ stage: "uploading", done: e.loaded, total: e.total }));
    };
    xhr.onprogress = () => {
      if (xhr.status === 200) drain();
    };
    xhr.onload = () => {
      if (xhr.status !== 200) {
        // Rejected before indexing began (too large, not a PDF, signed out).
        let detail = null;
        try {
          detail = JSON.parse(xhr.responseText).detail;
        } catch {
          /* non-JSON error body */
        }
        reject(new ApiError(messageFrom(detail), xhr.status));
        return;
      }
      drain();
      if (failure) reject(failure);
      else if (document) {
        onProgress(progressOf({ stage: "done" }));
        resolve(document);
      } else reject(new ApiError("Indexing stopped before it finished. Please try again.", 0));
    };
    xhr.onerror = () => reject(new ApiError("Cannot reach the server. Is the backend running?", 0));

    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

export const api = {
  register: (email, password) => request("/auth/register", { method: "POST", json: { email, password } }),
  login: (email, password) => request("/auth/login", { method: "POST", json: { email, password } }),
  documents: () => request("/documents"),
  upload: (file, onProgress) => uploadWithProgress(file, onProgress),
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
