import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import Icon from "./Icon.jsx";

// One click to a useful first question, instead of an empty box.
const SUGGESTIONS = [
  "Summarise this document in five points",
  "What are the key terms I should know?",
  "Explain the hardest idea simply",
];

// Turn "[1]" markers in an answer into small clickable chips.
// Some models emit fullwidth brackets ("【1】"), so accept those too.
function Answer({ text, sources, onPick }) {
  const parts = text.split(/([[【]\d+[\]】])/g);
  return (
    <p>
      {parts.map((part, i) => {
        const m = part.match(/^[[【](\d+)[\]】]$/);
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

export default function Chat({ messages, setMessages, scope, hasDocs, pageError, guard, handoff, onDismissHandoff }) {
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
    if (!q || busy) return;
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

      {handoff?.ok && (
        <div className="banner" role="status" style={{ margin: "1rem 1.25rem 0" }}>
          <span>
            {handoff.page
              ? <>Revising <strong>page {handoff.page}</strong> of <strong>{handoff.filename}</strong> after your test.</>
              : <>Brought over from exam prep: <strong>{handoff.filename}</strong></>}
          </span>
          {/* One click to the obvious question, rather than an empty box. */}
          {handoff.page && (
            <button className="link" onClick={() => setQuestion(`Explain what page ${handoff.page} covers.`)}>
              Ask about page {handoff.page}
            </button>
          )}
          <button className="link" onClick={onDismissHandoff}>Dismiss</button>
        </div>
      )}
      {handoff && !handoff.ok && (
        <div className="banner warn" role="alert" style={{ margin: "1rem 1.25rem 0" }}>
          <span>
            That document couldn&apos;t be found — it may have been deleted. Pick one from the
            sidebar instead.
          </span>
          <button className="link" onClick={onDismissHandoff}>Dismiss</button>
        </div>
      )}

      <div className="thread" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-empty">
            <span className="chat-empty-orb"><Icon name="chat" size={28} /></span>
            <h2>{hasDocs ? "Ask your PDF anything" : "Upload a PDF to begin"}</h2>
            <p>
              {hasDocs
                ? "Answers come from your own pages, with the page number attached."
                : "Use Upload PDF on the left. Text-based PDFs work best."}
            </p>
            {hasDocs && (
              <div className="chat-suggest">
                {SUGGESTIONS.map((s) => (
                  <button type="button" key={s} onClick={() => setQuestion(s)}>{s}</button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => <Message key={m.id ?? i} m={m} />)}
        {busy && (
          <div className="msg assistant typing" role="status">
            <i /><i /><i />
            <span className="sr-only">Searching your documents…</span>
          </div>
        )}
        {(error || pageError) && <p className="error" role="alert">{error || pageError}</p>}
        <div ref={end} />
      </div>

      <form className="composer" onSubmit={send}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask your PDF anything…"
          maxLength={1000}
          aria-label="Question"
        />
        <button className="primary" disabled={busy || !question.trim()}>Ask</button>
      </form>
    </section>
  );
}
