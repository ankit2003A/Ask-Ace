import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { advance, api } from "../api";
import UploadProgress from "../components/UploadProgress.jsx";
import ExamPlayer from "../components/ExamPlayer.jsx";
import SiteFooter from "../components/SiteFooter.jsx";

/* Exam prep module: pick an indexed document, generate a test from it, take it,
   then jump back to the document for whatever went wrong. */
export default function Exams({ onLogout }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const fileInput = useRef(null);

  const [docs, setDocs] = useState(null); // null = still loading
  const [tests, setTests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [handoff, setHandoff] = useState(null); // {ok, filename} | {ok:false}
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); // {label, percent} while indexing
  const [ready, setReady] = useState(null); // filename of the last upload
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState("");
  const [exam, setExam] = useState(null); // the test being taken
  const [config, setConfig] = useState({ count: 10, type: "mcq", difficulty: "mixed" });

  const requested = params.get("doc");

  const guard = useCallback(
    (err) => {
      if (err.status === 401) onLogout();
    },
    [onLogout]
  );

  useEffect(() => {
    Promise.all([api.documents(), api.exams()])
      .then(([list, saved]) => {
        setDocs(list);
        setTests(saved);
        if (requested === null) return;
        const id = Number(requested);
        const match = list.find((d) => d.id === id);
        // A stale or foreign id must not silently select the wrong document.
        if (match) {
          setSelected(match.id);
          setHandoff({ ok: true, filename: match.filename });
        } else {
          setHandoff({ ok: false });
        }
      })
      .catch((err) => {
        guard(err);
        setError(err.message);
      });
  }, [requested, guard]);

  function dismissHandoff() {
    setHandoff(null);
    params.delete("doc");
    setParams(params, { replace: true });
  }

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
      setDocs((d) => [doc, ...d]);
      setSelected(doc.id);
      setReady(doc.filename);
    } catch (err) {
      guard(err);
      setError(err.message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function generate() {
    if (selected === null) return;
    setError("");
    setNotice("");
    setGenerating(true);
    try {
      const created = await api.createExam(selected, config);
      setExam(created);
      setTests(await api.exams());
      // A test can come back shorter than asked for: either the document is too
      // short to carry that many distinct questions, or some generated items
      // were malformed and thrown away. Say which, rather than leaving a short
      // test looking like a bug.
      const got = created.questions.length;
      if (created.limited_by_document) {
        setNotice(
          `This document is short, so it supports ${got} distinct question${got === 1 ? "" : "s"} ` +
            `rather than the ${created.requested} you asked for.`
        );
      } else if (got < created.requested) {
        setNotice(
          `${got} of ${created.requested} questions were usable; the rest were discarded ` +
            `as malformed or duplicated.`
        );
      }
    } catch (err) {
      guard(err);
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function open(id) {
    setError("");
    try {
      setExam(await api.exam(id));
    } catch (err) {
      guard(err);
      setError(err.message);
    }
  }

  async function remove(id) {
    try {
      await api.removeExam(id);
      setTests((t) => t.filter((x) => x.id !== id));
    } catch (err) {
      guard(err);
      setError(err.message);
    }
  }

  /* Back to the other module, carrying the document id and the page worth
     re-reading. Only ids travel in the URL — never document contents. */
  function review(page) {
    const doc = exam?.document_id;
    navigate(page ? `/documents?doc=${doc}&page=${page}` : `/documents?doc=${doc}`);
  }

  if (exam) {
    return (
      <>
        <div className="page">
          {notice && (
            <div className="banner warn" role="status">
              <span>{notice}</span>
              <button className="link" onClick={() => setNotice("")}>Dismiss</button>
            </div>
          )}
          <ExamPlayer
            exam={exam}
            guard={guard}
            onExit={() => setExam(null)}
            onReview={review}
            onGraded={() => api.exams().then(setTests).catch(guard)}
          />
        </div>
        <SiteFooter />
      </>
    );
  }

  const current = docs?.find((d) => d.id === selected) ?? null;

  return (
    <>
      <div className="page">
        <h1 style={{ fontSize: "2rem", fontWeight: 800 }}>Ace your exam</h1>
        <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1.75rem" }}>
          Let your PDF quiz you. It writes a practice test from its own pages, marks it,
          and shows you exactly where to revise.
        </p>

        {handoff?.ok && (
          <div className="banner" role="status">
            <span>
              Brought over from your documents: <strong>{handoff.filename}</strong>
            </span>
            <button className="link" onClick={dismissHandoff}>Dismiss</button>
          </div>
        )}
        {handoff && !handoff.ok && (
          <div className="banner warn" role="alert">
            <span>
              That document couldn&apos;t be found — it may have been deleted, or it belongs to
              another account. Pick one from the list below.
            </span>
            <button className="link" onClick={dismissHandoff}>Dismiss</button>
          </div>
        )}
        {error && <p className="error" role="alert">{error}</p>}

        <div className="exam-grid">
          <section className="card">
            <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>1. Choose a document</h2>

            {docs === null && <p className="muted">Loading your documents…</p>}

            {docs?.length === 0 && (
              <p className="muted">
                You haven&apos;t uploaded anything yet. Upload a text-based PDF to get started.
              </p>
            )}

            {docs && docs.length > 0 && (
              <ul className="pick-list">
                {docs.map((d) => (
                  <li key={d.id}>
                    <button
                      className={selected === d.id ? "pick active" : "pick"}
                      aria-pressed={selected === d.id}
                      onClick={() => setSelected(d.id)}
                    >
                      <span className="pick-name">{d.filename}</span>
                      <span className="muted">{d.pages} pp</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <input ref={fileInput} type="file" accept="application/pdf,.pdf" hidden onChange={upload} />
            <button
              className="btn-ghost"
              style={{ marginTop: "1rem" }}
              onClick={() => fileInput.current.click()}
              disabled={busy}
            >
              {busy ? "Indexing…" : "Upload another PDF"}
            </button>
            {progress && <UploadProgress progress={progress} />}
            {ready && !busy && (
              <p className="indexed" role="status">
                ✓ <strong>{ready}</strong> is ready
              </p>
            )}

            {tests.length > 0 && (
              <>
                <h2 style={{ fontSize: "1.1rem", margin: "2rem 0 1rem" }}>Your tests</h2>
                <ul className="test-list">
                  {tests.map((t) => (
                    <li key={t.id}>
                      <button className="pick" onClick={() => open(t.id)}>
                        <span className="pick-name">{t.filename}</span>
                        <span className="muted">
                          {t.questions} q
                          {t.attempts > 0 && ` · best ${t.best_score}/${t.questions}`}
                        </span>
                      </button>
                      <button className="icon" aria-label={`Delete test on ${t.filename}`} onClick={() => remove(t.id)}>
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <aside className="card">
            <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>2. Set up the test</h2>

            <label className="field">
              Number of questions
              <select
                value={config.count}
                disabled={generating}
                onChange={(e) => setConfig({ ...config, count: Number(e.target.value) })}
              >
                {[5, 10, 20, 30].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>

            <label className="field">
              Question type
              <select
                value={config.type}
                disabled={generating}
                onChange={(e) => setConfig({ ...config, type: e.target.value })}
              >
                <option value="mcq">Multiple choice</option>
                <option value="truefalse">True / False</option>
                <option value="short">Short answer</option>
                <option value="mixed">Mixed</option>
              </select>
            </label>

            <label className="field">
              Difficulty
              <select
                value={config.difficulty}
                disabled={generating}
                onChange={(e) => setConfig({ ...config, difficulty: e.target.value })}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="mixed">Mixed</option>
              </select>
            </label>

            <button
              className="primary"
              style={{ width: "100%" }}
              onClick={generate}
              disabled={generating || selected === null}
              title={selected === null ? "Choose a document first" : undefined}
            >
              {generating ? "Writing questions…" : "Generate practice questions"}
            </button>

            {generating && (
              <p className="muted small" style={{ marginTop: "0.75rem" }}>
                Reading the whole document and writing {config.count} questions. This usually
                takes under a minute.
              </p>
            )}

            {!generating && selected === null && (
              <p className="muted small" style={{ marginTop: "0.75rem" }}>
                Pick a document on the left to enable this.
              </p>
            )}

            {current && (
              <button
                className="btn-ghost"
                style={{ width: "100%", marginTop: "1rem" }}
                onClick={() => navigate(`/documents?doc=${current.id}`)}
              >
                Understand this PDF →
              </button>
            )}
          </aside>
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
