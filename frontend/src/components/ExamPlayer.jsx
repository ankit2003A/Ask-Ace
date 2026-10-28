import { useState } from "react";
import { api } from "../api";

/* Take a generated test and see the result.

   The correct answers are not in this component's data: the server sends the
   questions without them, grades the submission and returns the key with the
   result. So there is nothing to read out of the page while answering. */
export default function ExamPlayer({ exam, onExit, onReview, onGraded, guard }) {
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const total = exam.questions.length;
  const answered = exam.questions.filter((q) => (answers[q.id] ?? "").trim()).length;

  function setAnswer(id, value) {
    setAnswers((a) => ({ ...a, [id]: value }));
  }

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const responses = exam.questions.map((q) => ({
        question_id: q.id,
        answer: answers[q.id] ?? "",
      }));
      const graded = await api.submitAttempt(exam.id, responses);
      setResult(graded);
      onGraded?.();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      guard(err);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    setAnswers({});
    setResult(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const graded = result ? new Map(result.results.map((r) => [r.id, r])) : null;
  const percent = result ? Math.round((result.score / Math.max(result.total, 1)) * 100) : 0;

  return (
    <section className="exam-player">
      <header className="exam-head">
        <div>
          <h1>{exam.filename}</h1>
          <p className="muted">
            {total} question{total === 1 ? "" : "s"} · {LABELS[exam.question_type] ?? exam.question_type}
            {" · "}
            {exam.difficulty} difficulty
          </p>
        </div>
        <button className="btn-ghost" onClick={onExit}>
          ← All tests
        </button>
      </header>

      {result && (
        <div className={percent >= 70 ? "score-card pass" : "score-card"} role="status">
          <div className="score-number">
            {result.score}
            <span>/{result.total}</span>
          </div>
          <div>
            <strong>{percent}% correct</strong>
            <p className="muted">
              {percent === 100
                ? "Everything right. This material is solid."
                : "Open the page behind anything you missed, then take it again."}
            </p>
          </div>
          <button className="btn-ghost" onClick={retake}>
            Take it again
          </button>
        </div>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      <ol className="question-list">
        {exam.questions.map((q, i) => {
          const verdict = graded?.get(q.id);
          const chosen = answers[q.id] ?? "";
          return (
            <li
              key={q.id}
              className={verdict ? (verdict.correct ? "question correct" : "question wrong") : "question"}
            >
              <div className="question-head">
                <span className="question-number">{i + 1}</span>
                <p className="question-prompt">{q.prompt}</p>
                {verdict && (
                  <span className="verdict">{verdict.correct ? "Correct" : "Incorrect"}</span>
                )}
              </div>

              {q.options ? (
                <div className="options">
                  {q.options.map((option) => (
                    <label
                      key={option}
                      className={optionClass(option, chosen, verdict)}
                    >
                      <input
                        type="radio"
                        name={`q${q.id}`}
                        value={option}
                        checked={chosen === option}
                        disabled={Boolean(result)}
                        onChange={() => setAnswer(q.id, option)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  rows={2}
                  className="short-answer"
                  placeholder="Your answer…"
                  value={chosen}
                  disabled={Boolean(result)}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                />
              )}

              {verdict && (
                <div className="feedback">
                  {!verdict.correct && (
                    <p>
                      <strong>Answer:</strong> {verdict.correct_answer}
                    </p>
                  )}
                  {verdict.explanation && <p className="muted">{verdict.explanation}</p>}
                  {verdict.approximate && (
                    /* Short answers are matched on wording, not meaning — say so
                       rather than let a correct-but-differently-worded answer
                       look like a flat failure. */
                    <p className="muted small">
                      Short answers are matched on wording, so this grade is approximate.
                      Compare yours with the answer above.
                    </p>
                  )}
                  {verdict.page !== null && verdict.page !== undefined && (
                    <button className="link" onClick={() => onReview(verdict.page)}>
                      Revise page {verdict.page} in the document →
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {!result && (
        <div className="exam-submit">
          <span className="muted">
            {answered} of {total} answered
          </span>
          <button className="primary" onClick={submit} disabled={busy || answered === 0}>
            {busy ? "Marking…" : "Submit answers"}
          </button>
        </div>
      )}
    </section>
  );
}

const LABELS = {
  mcq: "multiple choice",
  truefalse: "true / false",
  short: "short answer",
  mixed: "mixed types",
};

function optionClass(option, chosen, verdict) {
  const classes = ["option"];
  if (chosen === option) classes.push("chosen");
  if (verdict) {
    if (option === verdict.correct_answer) classes.push("is-correct");
    else if (chosen === option) classes.push("is-wrong");
  }
  return classes.join(" ");
}
