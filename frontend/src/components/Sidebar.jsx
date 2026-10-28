import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { seconds, useElapsed } from "../useElapsed";

export default function Sidebar({ docs, scope, setScope, onUploaded, onRemoved, onLogout, guard }) {
  const navigate = useNavigate();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /* Indexing a long PDF takes seconds with nothing to look at, so show the
     clock. It runs from the moment the file is sent to the moment the
     document is added to the list below. */
  const [startedAt, setStartedAt] = useState(null);
  const [took, setTook] = useState(null);
  const elapsed = useElapsed(startedAt);

  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setTook(null);
    const begun = Date.now();
    setStartedAt(begun);
    setBusy(true);
    try {
      const doc = await api.upload(file);
      onUploaded(doc);
      setTook({ name: doc.filename, value: (Date.now() - begun) / 1000 });
    } catch (err) {
      if (err.status === 401) guard(err);
      else setError(err.message);
    } finally {
      setBusy(false);
      setStartedAt(null);
    }
  }

  async function remove(id) {
    try {
      await api.removeDocument(id);
      onRemoved(id);
    } catch (err) {
      guard(err);
    }
  }

  return (
    <aside className="sidebar">
      <div className="brand">Ask your PDF</div>
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={upload} />
      <button className="primary" onClick={() => input.current.click()} disabled={busy}>
        {busy ? `Indexing… ${seconds(elapsed)}` : "Upload PDF"}
      </button>
      {busy && (
        <p className="muted small" role="status">
          Reading pages and building the index. Stays on this page.
        </p>
      )}
      {took && !busy && (
        <p className="indexed" role="status">
          ✓ Indexed <strong>{took.name}</strong> in {seconds(took.value)}
        </p>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      <h2>Search in</h2>
      <ul className="docs">
        <li>
          <button className={scope === null ? "doc active" : "doc"} onClick={() => setScope(null)}>
            All documents
          </button>
        </li>
        {docs.map((d) => (
          <li key={d.id}>
            <button className={scope === d.id ? "doc active" : "doc"} onClick={() => setScope(d.id)} title={d.filename}>
              <span className="doc-name">{d.filename}</span>
              <span className="muted">{d.pages} pp</span>
            </button>
            <button className="icon" aria-label={`Delete ${d.filename}`} onClick={() => remove(d.id)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      {docs.length === 0 && <p className="muted">No documents yet. Upload a text-based PDF to begin.</p>}

      <div className="sidebar-actions">
        {/* Carries the document across to exam prep by id, so it is never re-uploaded. */}
        <button
          className="btn-ghost"
          disabled={scope === null}
          title={scope === null ? "Select a single document first" : undefined}
          onClick={() => navigate(`/exams?doc=${scope}`)}
        >
          Create practice questions
        </button>
        {scope === null && docs.length > 0 && (
          <p className="muted" style={{ fontSize: "0.78rem" }}>
            Pick one document above to send it to exam prep.
          </p>
        )}
      </div>

      <button className="link logout" onClick={onLogout}>Log out</button>
    </aside>
  );
}
