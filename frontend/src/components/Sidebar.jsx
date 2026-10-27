import { useRef, useState } from "react";
import { api } from "../api";

export default function Sidebar({ docs, scope, setScope, onUploaded, onRemoved, onLogout, guard }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      onUploaded(await api.upload(file));
    } catch (err) {
      if (err.status === 401) guard(err);
      else setError(err.message);
    } finally {
      setBusy(false);
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
      <div className="brand">DocuMind AI</div>
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={upload} />
      <button className="primary" onClick={() => input.current.click()} disabled={busy}>
        {busy ? "Indexing…" : "Upload PDF"}
      </button>
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

      <button className="link logout" onClick={onLogout}>Log out</button>
    </aside>
  );
}
