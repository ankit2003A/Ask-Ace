import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import Icon from "../components/Icon.jsx";

/* The student's own AI workspace: progress, scores and what to revise next,
   all computed by the server from what this account has actually done. */

const KIND_LABEL = { mcq: "Multiple choice", truefalse: "True / False", short: "Short answer" };
const LEVEL_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard", mixed: "Mixed" };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function when(stamp) {
  // SQLite stamps are UTC without a zone; say so before formatting locally.
  const d = new Date(`${stamp.replace(" ", "T")}Z`);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function tone(percent) {
  if (percent === null || percent === undefined) return "none";
  return percent >= 80 ? "good" : percent >= 50 ? "fair" : "low";
}

export default function Dashboard({ onLogout }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const guard = useCallback(
    (err) => (err.status === 401 ? onLogout() : setError(err.message)),
    [onLogout]
  );

  useEffect(() => {
    api.dashboard().then(setData).catch(guard);
  }, [guard]);

  if (error) {
    return <div className="page"><p className="error" role="alert">{error}</p></div>;
  }
  if (!data) {
    return (
      <div className="page dashboard">
        <div className="db-skeleton" aria-label="Loading your dashboard">
          {Array.from({ length: 8 }, (_, i) => <span key={i} />)}
        </div>
      </div>
    );
  }

  const t = data.totals;
  const who = data.name || data.email.split("@")[0];
  const fresh = t.attempts === 0;

  return (
    <div className="page dashboard">
      <header className="db-head">
        <div>
          <span className="pill-label"><Icon name="sparkle" size={14} /> Your AI Workspace</span>
          <h1>
            {greeting()}, <span className="title-accent">{who}</span>.
          </h1>
          <p>
            {fresh
              ? "Take your first practice test and your progress will start appearing here."
              : data.weak_pages.length
                ? `You have ${data.weak_pages.length} page${data.weak_pages.length > 1 ? "s" : ""} to revise. Close the gaps, then retake.`
                : "No open gaps right now. Try a harder test to keep improving."}
          </p>
        </div>
        <div className="db-actions">
          <Link className="btn-outline" to="/documents"><Icon name="chat" size={17} /> Ask your PDF</Link>
          <Link className="primary" to="/exams"><Icon name="sparkle" size={17} /> New practice test</Link>
        </div>
      </header>

      <section className="db-stats">
        <Stat icon="target" label="Average Score" value={t.average_percent ?? "–"} unit={t.average_percent !== null ? "%" : ""}
              note={t.best_percent !== null ? `Best ${t.best_percent}%` : "No tests yet"} color="amber" />
        <Stat icon="checkCircle" label="Tests Taken" value={t.attempts} note={`${t.tests} test${t.tests === 1 ? "" : "s"} written`} color="cyan" />
        <Stat icon="help" label="Questions Answered" value={t.questions_answered}
              note={`${t.correct} correct`} color="blue" />
        <Stat icon="bolt" label="Day Streak" value={data.streak_days} unit={data.streak_days === 1 ? " day" : " days"}
              note={data.active_today ? "Studied today" : "Study today to keep it"} color="violet" />
      </section>

      <section className="db-grid">
        <article className="db-card span-2">
          <CardHead icon="chart" title="Score Trend" hint={fresh ? "" : `Last ${data.trend.length} attempt${data.trend.length > 1 ? "s" : ""}`} />
          {fresh ? <Empty text="Your scores will chart here after your first test." /> : <Trend points={data.trend} />}
        </article>

        <article className="db-card">
          <CardHead icon="target" title="Overall Accuracy" />
          <Ring percent={t.questions_answered ? Math.round((100 * t.correct) / t.questions_answered) : null}
                label={`${t.correct} of ${t.questions_answered} right`} />
        </article>

        <article className="db-card">
          <CardHead icon="spread" title="By Difficulty" />
          <Bars rows={data.by_difficulty.filter((d) => d.total).map((d) => ({
            key: d.difficulty, label: LEVEL_LABEL[d.difficulty], percent: d.percent, detail: `${d.correct}/${d.total}`,
          }))} empty="Answer a few questions to compare levels." />
        </article>

        <article className="db-card">
          <CardHead icon="grid" title="By Question Type" />
          <Bars rows={data.by_type.filter((k) => k.total).map((k) => ({
            key: k.kind, label: KIND_LABEL[k.kind], percent: k.percent, detail: `${k.correct}/${k.total}`,
          }))} empty="Each question type gets its own score here." />
        </article>

        <article className="db-card">
          <CardHead icon="bolt" title="Activity" hint="Last 4 weeks" />
          <Activity days={data.activity} />
        </article>

        <article className="db-card">
          <CardHead icon="bookmark" title="Pages to Revise" />
          {data.weak_pages.length === 0 ? (
            <Empty text={fresh ? "Missed questions point to their page here." : "Nothing to revise. Nice work."} />
          ) : (
            <ul className="db-list">
              {data.weak_pages.map((w) => (
                <li key={`${w.document_id}-${w.page}`}>
                  <Link to={`/documents?doc=${w.document_id}&page=${w.page}`} className="db-row">
                    <span className="db-badge low">p.{w.page}</span>
                    <span className="db-row-main"><b>{w.filename}</b><small>{w.misses} missed on your latest attempt</small></span>
                    <Icon name="arrowRight" size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="db-card">
          <CardHead icon="checkCircle" title="Recent Results" />
          {data.recent.length === 0 ? (
            <Empty text="Your marked tests will be listed here." />
          ) : (
            <ul className="db-list">
              {data.recent.map((r) => (
                <li key={r.attempt_id}>
                  <Link to="/exams" className="db-row">
                    <span className={`db-badge ${tone(r.percent)}`}>{r.percent}%</span>
                    <span className="db-row-main"><b>{r.filename}</b><small>{r.score}/{r.total} · {LEVEL_LABEL[r.difficulty]} · {when(r.at)}</small></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="db-card">
          <CardHead icon="book" title="Your Documents" hint={`${t.documents} · ${t.pages} pages`} />
          {data.documents.length === 0 ? (
            <Empty text="Upload a PDF to get started." action={<Link className="primary sm" to="/documents">Upload a PDF</Link>} />
          ) : (
            <ul className="db-list">
              {data.documents.slice(0, 5).map((d) => (
                <li key={d.id}>
                  <Link to={`/exams?doc=${d.id}`} className="db-row">
                    <span className="db-file"><Icon name="fileText" size={16} /></span>
                    <span className="db-row-main"><b>{d.filename}</b><small>{d.pages} pages · {d.tests} test{d.tests === 1 ? "" : "s"}</small></span>
                    <span className={`db-best ${tone(d.best_percent)}`}>{d.best_percent !== null ? `${d.best_percent}%` : "–"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
      <p className="db-foot"><Icon name="chat" size={14} /> {t.questions_asked} question{t.questions_asked === 1 ? "" : "s"} asked of your PDFs so far.</p>
    </div>
  );
}

function Stat({ icon, label, value, unit = "", note, color }) {
  return (
    <div className={`db-stat ${color}`}>
      <span className="db-stat-icon"><Icon name={icon} size={20} /></span>
      <small>{label}</small>
      <strong>{value}<em>{unit}</em></strong>
      <span className="db-stat-note">{note}</span>
    </div>
  );
}

function CardHead({ icon, title, hint }) {
  return (
    <div className="db-card-head">
      <span><Icon name={icon} size={16} /></span>
      <h2>{title}</h2>
      {hint && <small>{hint}</small>}
    </div>
  );
}

function Empty({ text, action }) {
  return <div className="db-empty"><p>{text}</p>{action}</div>;
}

/* Percent per attempt, oldest to newest, as a line over a soft area. */
function Trend({ points }) {
  const W = 600, H = 200, pad = 18;
  const step = points.length > 1 ? (W - pad * 2) / (points.length - 1) : 0;
  const xy = points.map((p, i) => [points.length > 1 ? pad + i * step : W / 2, H - pad - (p.percent / 100) * (H - pad * 2)]);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${xy[xy.length - 1][0].toFixed(1)} ${H - pad} L${xy[0][0].toFixed(1)} ${H - pad} Z`;
  return (
    <div className="db-trend">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
           aria-label={`Scores: ${points.map((p) => `${p.percent}%`).join(", ")}`}>
        <defs>
          <linearGradient id="trend-line" x1="0" x2="1"><stop offset="0" stopColor="#3b82f6" /><stop offset="1" stopColor="#a855f7" /></linearGradient>
          <linearGradient id="trend-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#6366f1" stopOpacity="0.35" /><stop offset="1" stopColor="#6366f1" stopOpacity="0" /></linearGradient>
        </defs>
        {[25, 50, 75].map((g) => {
          const y = H - pad - (g / 100) * (H - pad * 2);
          return <line key={g} x1={pad} x2={W - pad} y1={y} y2={y} className="db-grid-line" />;
        })}
        <path d={area} fill="url(#trend-area)" className="db-area" />
        <path d={line} fill="none" stroke="url(#trend-line)" strokeWidth="3" pathLength="1" className="db-line"
              vectorEffect="non-scaling-stroke" />
      </svg>
      {/* Dots and labels in HTML, so they stay round however the chart stretches. */}
      {xy.map(([x, y], i) => (
        <span key={points[i].attempt_id} className="db-dot" title={`${points[i].filename}: ${points[i].percent}%`}
              style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, animationDelay: `${0.6 + i * 0.06}s` }} />
      ))}
      <div className="db-trend-last">
        <b>{points[points.length - 1].percent}%</b>
        <small>latest</small>
      </div>
    </div>
  );
}

function Ring({ percent, label }) {
  const p = percent ?? 0;
  return (
    <div className="db-ring-wrap">
      <div className="db-ring" style={{ "--p": p }}>
        <div><b>{percent === null ? "–" : `${percent}%`}</b><small>correct</small></div>
      </div>
      <p>{label}</p>
    </div>
  );
}

function Bars({ rows, empty }) {
  if (rows.length === 0) return <Empty text={empty} />;
  return (
    <ul className="db-bars">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="db-bar-label"><span>{r.label}</span><b>{r.percent}%</b><small>{r.detail}</small></div>
          <div className="db-bar"><i className={tone(r.percent)} style={{ "--w": `${r.percent}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

/* Four weeks of study days: questions asked plus tests taken. */
function Activity({ days }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((n, d) => n + d.count, 0);
  return (
    <div className="db-activity">
      <div className="db-cells">
        {days.map((d, i) => (
          <span key={d.date} title={`${d.date}: ${d.count}`} style={{ animationDelay: `${i * 0.02}s` }}
                className={`lvl-${d.count === 0 ? 0 : Math.ceil((d.count / max) * 3)}`} />
        ))}
      </div>
      <p>{total} study action{total === 1 ? "" : "s"} in 28 days</p>
    </div>
  );
}
