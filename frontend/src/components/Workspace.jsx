import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import Chat from "./Chat.jsx";
import Sidebar from "./Sidebar.jsx";

export default function Workspace({ onLogout }) {
  const [docs, setDocs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [scope, setScope] = useState(null); // null = all documents
  const [error, setError] = useState("");

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
      })
      .catch(guard);
  }, [guard]);

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
      />
    </div>
  );
}
