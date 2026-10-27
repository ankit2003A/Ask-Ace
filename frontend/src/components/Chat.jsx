import { useEffect, useRef, useState } from "react";
import { api } from "../api";

// Turn "[1]" markers in an answer into small clickable chips.
function Answer({ text, sources, onPick }) {
  const parts = text.split(/(\[\d+\])/g);
  return (
    <p>
      {parts.map((part, i) => {
        const m = part.match(/^\[(\d+)\]$/);
        if (m && sources.some((s) => s.index === Number(m[1]))) {
          return (
            <button key={i} className="chip" onClick={() => onPick(Number(m[1]))}>
              {m[1]}
            </button>
          );
        }
        return part;
      })}
    </p>
  );
}

function Message({ m }) {
  const [open, setOpen] = useState(null);
  if (m.role === "user") return <div className="msg user"><p>{m.content}</p></div>;
  return (
    <div className="msg assistant">
      <Answer text={m.content} sources={m.sources || []} onPick={(n) => setOpen(open === n ? null : n)} />
      {m.sources?.length > 0 && (
        <ul className="sources">
          {m.sources.map((s) => (
            <li key={s.index} className={open === s.index ? "source open" : "source"}>
              <button onClick={() => setOpen(open === s.index ? null : s.index)}>
                <span className="chip static">{s.index}</span>
                {s.filename} · page {s.page}
              </button>
              {open === s.index && <blockquote>{s.snippet}</blockquote>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Chat({ messages, setMessages, scope, hasDocs, pageError, guard }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(e) {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 3 || busy) return;
    setError("");
    setQuestion("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setBusy(true);
    try {
      const { answer, sources } = await api.ask(q, scope);
      setMessages((m) => [...m, { role: "assistant", content: answer, sources }]);
    } catch (err) {
      if (err.status === 401) guard(err);
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    try {
      await api.clearHistory();
      setMessages([]);
    } catch (err) {
      guard(err);
    }
  }

  return (
    <section className="chat">
      <header>
        <span className="muted">{scope === null ? "Searching all documents" : "Searching one document"}</span>
        {messages.length > 0 && <button className="link" onClick={clear}>Clear history</button>}
      </header>

      <div className="thread" aria-live="polite">
        {messages.length === 0 && (
          <p className="empty">
            {hasDocs ? "Ask a question about your documents." : "Upload a PDF in the sidebar, then ask a question."}
          </p>
        )}
        {messages.map((m, i) => <Message key={m.id ?? i} m={m} />)}
        {busy && <div className="msg assistant"><p className="muted">Searching your documents…</p></div>}
        {(error || pageError) && <p className="error" role="alert">{error || pageError}</p>}
        <div ref={end} />
      </div>

      <form className="composer" onSubmit={send}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about your documents…"
          maxLength={1000}
          aria-label="Question"
        />
        <button className="primary" disabled={busy || question.trim().length < 3}>Ask</button>
      </form>
    </section>
  );
}
