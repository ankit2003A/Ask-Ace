import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import Chat from "./Chat.jsx";
import Sidebar from "./Sidebar.jsx";

export default function Workspace({ onLogout }) {
  const [params, setParams] = useSearchParams();
  const [docs, setDocs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [scope, setScope] = useState(null); // null = all documents
  const [handoff, setHandoff] = useState(null); // {ok, filename} | {ok:false}
  const [error, setError] = useState("");

  const requested = params.get("doc");
  // Set when exam prep sends the user back to revise a specific page.
  const page = params.get("page");

  // Any 401 means the token expired: send the user back to login.
  const guard = useCallback(
    (err) => {
      if (err.status === 401) onLogout();
      else setError(err.message);
    },
    [onLogout]
  );

  useEffect(() => {
    Promise.all([api.documents(), api.history()])
      .then(([d, h]) => {
        setDocs(d);
        setMessages(h);
        if (requested === null) return;
        const match = d.find((x) => x.id === Number(requested));
        // Never silently fall back to "all documents" — say what went wrong.
        if (match) {
          setScope(match.id);
          setHandoff({ ok: true, filename: match.filename, page: Number(page) || null });
        } else {
          setHandoff({ ok: false });
        }
      })
      .catch(guard);
  }, [guard, requested, page]);

  function dismissHandoff() {
    setHandoff(null);
    params.delete("doc");
    params.delete("page");
    setParams(params, { replace: true });
  }

  return (
    <div className="layout">
      <Sidebar
        docs={docs}
        scope={scope}
        setScope={setScope}
        onUploaded={(doc) => setDocs((d) => [doc, ...d])}
        onRemoved={(id) => {
          setDocs((d) => d.filter((x) => x.id !== id));
          setScope((s) => (s === id ? null : s));
        }}
        onLogout={onLogout}
        guard={guard}
      />
      <Chat
        messages={messages}
        setMessages={setMessages}
        scope={scope}
        hasDocs={docs.length > 0}
        pageError={error}
        guard={guard}
        handoff={handoff}
        onDismissHandoff={dismissHandoff}
      />
    </div>
  );
}
