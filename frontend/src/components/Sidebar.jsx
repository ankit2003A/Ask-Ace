import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { advance, api } from "../api";
import UploadProgress from "./UploadProgress.jsx";

export default function Sidebar({ docs, scope, setScope, onUploaded, onRemoved, onLogout, guard }) {
  const navigate = useNavigate();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(null); // {label, percent} while indexing
  const [ready, setReady] = useState(null); // filename of the last upload

  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setReady(null);
    setProgress({ label: "Uploading", percent: 0 });
    setBusy(true);
    try {
      const doc = await api.upload(file, (p) => setProgress(advance(p)));
      onUploaded(doc);
      setReady(doc.filename);
    } catch (err) {
      if (err.status === 401) guard(err);
      else setError(err.message);
    } finally {
      setBusy(false);
      setProgress(null);
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
        {busy ? "Indexing…" : "Upload PDF"}
      </button>
      {progress && <UploadProgress progress={progress} />}
      {ready && !busy && (
        <p className="indexed" role="status">
          ✓ <strong>{ready}</strong> is ready
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
