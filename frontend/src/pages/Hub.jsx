import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import SiteFooter from "../components/SiteFooter.jsx";

/* The idea the whole page hangs on: a PDF is normally a dead file you scroll
   through. Ask & Ace brings it to life — it answers, shows its sources and
   quizzes you. Every claim below is something the app actually does. */

/* What people bring, in place of a wall of borrowed logos. */
const WORKS_WITH = [
  ["book", "Textbooks"],
  ["fileText", "Lecture notes"],
  ["grid", "Slide decks"],
  ["search", "Research papers"],
  ["bookmark", "Revision guides"],
  ["settings", "Manuals"],
];

const WHY = [
  ["fileText", "Upload Any PDF", "Notes, textbooks or slides. It is read page by page and indexed in seconds."],
  ["chat", "It Talks Back", "Ask in your own words. Every answer is drawn from your pages and cites them."],
  ["help", "Writes Smart Exams", "Multiple choice, true/false and short answer — 5 to 30 questions, from the whole document."],
  ["target", "Revise What Matters", "Your attempt is marked instantly, and every miss points to the page to reread."],
];

const STEPS = [
  ["upload", "Upload Your PDF", "Drop in a text-based PDF. It is ready in seconds."],
  ["chat", "Ask Anything", "Get answers with the exact page each one came from."],
  ["target", "Ace a Practice Test", "It writes a test from its own pages and marks you."],
  ["checkCircle", "Revise and Retake", "Read the page you missed, then try again."],
];

const TRUST = [
  {
    wide: true,
    icon: "quote",
    title: "It shows you where it read that",
    body:
      "Your PDF answers only from its own pages, and every answer is numbered back to them. " +
      "Click a citation to see the exact passage, on the exact page.",
  },
  {
    icon: "shield",
    title: "It admits when it doesn't know",
    body:
      "If the answer isn't in your PDF, it says so plainly instead of making something up. " +
      "No confident inventions.",
  },
  {
    icon: "spread",
    title: "Not just chapter one",
    body:
      "Tests are drawn from across the whole document, so the end of the book gets the same " +
      "attention as the start.",
  },
  {
    icon: "lock",
    title: "No peeking at the answers",
    body:
      "Questions reach your screen without their answers. The server marks your attempt and " +
      "only then reveals the key.",
  },
  {
    icon: "link",
    title: "One upload does both",
    body:
      "The same PDF you asked questions of is the one that quizzes you. No re-uploading, no " +
      "copying files around.",
  },
];

const FAQ = [
  [
    "What does “bringing a PDF to life” actually mean?",
    "Once uploaded, your PDF can answer questions about itself, show you which page each " +
      "answer came from, write a practice test from its own content, and mark your attempt. " +
      "It stops being a file you scroll and becomes something you can talk to.",
  ],
  [
    "What kind of PDFs work?",
    "Text-based ones: notes, textbooks, slides exported to PDF. Scanned pages are rejected " +
      "with a clear message, because there is no text in them to read.",
  ],
  [
    "Will it answer from outside my PDF?",
    "No, and that is deliberate. It only uses what is in your document, so you can trust " +
      "that an answer matches what you'll be examined on.",
  ],
  [
    "How are short answers marked?",
    "By comparing your wording with the expected answer, which is approximate, so those " +
      "results say so and show the expected answer beside yours. Multiple choice and " +
      "true/false are marked exactly.",
  ],
  [
    "Can anyone else see my PDFs?",
    "No. Every document belongs to one account, and asking for another account's document " +
      "is refused.",
  ],
];

export default function Hub() {
  const { hash } = useLocation();

  // Nav links like /#how land here; the browser won't scroll to them by itself
  // because the sections only exist once this page has rendered.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  return (
    <>
      <div className="page hub">
        <section className="hero">
          <div className="hero-copy">
            <span className="pill-label rise">
              <Icon name="sparkle" size={14} /> AI for Your PDFs, Reimagined
            </span>
            <h1 className="rise d1">
              Bring Your PDF
              <br />
              <span className="title-accent">to Life with AI.</span>
            </h1>
            <p className="rise d2">
              Upload any PDF and let <strong>Ask &amp; Ace</strong> answer your questions with
              the exact page, then write and mark practice exams from it in seconds.
            </p>
            <div className="hero-cta rise d3">
              <Link className="primary lg" to="/documents?signup=1">
                Start Asking — It&apos;s Free
              </Link>
              <Link className="btn-outline lg" to="/exams">
                <Icon name="play" size={14} /> Make a Practice Test
              </Link>
            </div>
            <ul className="ticks rise d4">
              <li><Icon name="check" size={15} />No Credit Card</li>
              <li><Icon name="check" size={15} />Page-Cited Answers</li>
              <li><Icon name="check" size={15} />Marked Instantly</li>
            </ul>
          </div>

          <HeroArt />
        </section>

        <section className="works-with">
          <p>Works with any text-based PDF</p>
          <ul>
            {WORKS_WITH.map(([icon, label]) => (
              <li key={label}><Icon name={icon} size={22} />{label}</li>
            ))}
          </ul>
        </section>

        <section id="features" className="center-section">
          <span className="pill-label"><Icon name="sparkle" size={14} /> Why Ask &amp; Ace?</span>
          <div className="why-grid">
            {WHY.map(([icon, title, text]) => (
              <article className="why-card" key={title}>
                <span className="orb-icon"><Icon name={icon} size={26} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="center-section">
          <span className="pill-label"><Icon name="sparkle" size={14} /> Simple. Fast. Powerful.</span>
          <h2 className="section-title">How It Works</h2>
          <ol className="steps">
            {STEPS.map(([icon, title, text], i) => (
              <li className="step" key={title}>
                <span className="step-ring"><Icon name={icon} size={30} /></span>
                <span className="step-num">{i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="trust" className="center-section">
          <span className="pill-label"><Icon name="shield" size={14} /> Why You Can Trust It</span>
          <h2 className="section-title">
            Smart, but never <span className="title-accent">making things up</span>.
          </h2>
          <div className="bento">
            {TRUST.map((f) => (
              <article className={f.wide ? "bento-card span-2" : "bento-card"} key={f.title}>
                <span className="bento-icon"><Icon name={f.icon} size={21} /></span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
                {f.wide && (
                  <div className="bento-demo" aria-hidden="true">
                    <b>1</b>
                    <span className="chip-page">water_cycle.pdf · page 3</span>
                    <b>2</b>
                    <span className="chip-page">water_cycle.pdf · page 1</span>
                    <span>← what a citation opens</span>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        <section id="faq" className="center-section">
          <span className="pill-label"><Icon name="help" size={14} /> Questions</span>
          <h2 className="section-title">Before You Bring a PDF to Life</h2>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span className="faq-mark" aria-hidden="true" />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="cta-band">
          <div className="cta-copy">
            <h2>Ready to bring your PDF to life?</h2>
            <p>Upload one file. Ask it anything. Then let it make sure you know it.</p>
          </div>
          <div className="cta-action">
            <Link className="primary lg" to="/documents?signup=1">
              Get Started Free <Icon name="arrowRight" size={18} />
            </Link>
            <ul className="ticks">
              <li><Icon name="check" size={15} />No Credit Card</li>
              <li><Icon name="check" size={15} />Free to Use</li>
            </ul>
          </div>
          <BooksArt />
        </section>
      </div>
      <SiteFooter />
    </>
  );
}

/* The product, pictured: the PDF itself floating in front of the workspace
   that is reading it. Decorative — every claim it makes is also made in words
   on this page — so it is hidden from screen readers. The figures are an
   illustration of one document, kept inside the app's real limits. */
function HeroArt() {
  return (
    <div className="hero-art rise d2" aria-hidden="true">
      <span className="orbit" />
      <span className="spark s1">✦</span>
      <span className="spark s2">✦</span>
      <span className="spark s3">✦</span>

      <div className="dash">
        <div className="dash-top">
          <span className="dash-home"><Icon name="home" size={16} /></span>
          <strong>AI Workspace</strong>
          <span className="dash-avatar"><Icon name="user" size={16} /></span>
        </div>
        <div className="dash-body">
          <ul className="dash-nav">
            <li className="on"><Icon name="grid" size={15} />Dashboard</li>
            <li><Icon name="chat" size={15} />Ask your PDF</li>
            <li><Icon name="file" size={15} />My Exams</li>
            <li><Icon name="upload" size={15} />Uploads</li>
            <li><Icon name="chart" size={15} />Results</li>
            <li><Icon name="settings" size={15} />Settings</li>
          </ul>

          <div className="dash-main">
            <p className="dash-label">Reading Document</p>
            <div className="dash-file">
              <span className="dash-file-icon"><Icon name="fileText" size={18} /></span>
              <div className="dash-file-name">
                <b>Biology Chapter 4.pdf</b>
                <small>2.4 MB · 143 pages</small>
              </div>
              <div className="dash-progress"><i /></div>
              <em>78%</em>
            </div>

            <div className="dash-stats">
              <div><small>Pages Read</small><b className="c-amber">112</b></div>
              <div><small>Passages Indexed</small><b className="c-cyan">211</b></div>
              <div><small>Questions Written</small><b className="c-blue">30</b></div>
            </div>

            <div className="dash-row">
              <div className="dash-panel">
                <small>Difficulty Mix</small>
                <div className="donut-wrap">
                  <span className="donut" />
                  <ul className="legend">
                    <li><i className="k-easy" />Easy <b>30%</b></li>
                    <li><i className="k-med" />Medium <b>50%</b></li>
                    <li><i className="k-hard" />Hard <b>20%</b></li>
                  </ul>
                </div>
              </div>
              <div className="dash-panel">
                <small>Question Types</small>
                <ul className="qtypes">
                  <li>MCQ <b>18</b></li>
                  <li>True / False <b>6</b></li>
                  <li>Short Answer <b>6</b></li>
                </ul>
              </div>
            </div>

            <div className="dash-cta">
              <Icon name="sparkle" size={15} /> Generate Exam Now <Icon name="arrowRight" size={15} />
            </div>
          </div>
        </div>
      </div>

      {/* The PDF itself, waking up: a pale page, a red PDF tag, a voice meter
          that pulses, and the cited lines lit up in blue. */}
      <div className="mock-pdf">
        <div className="pdf-tag">PDF</div>
        <div className="pdf-voice"><i /><i /><i /><i /></div>
        <div className="pdf-title" />
        <div className="pdf-line" />
        <div className="pdf-line short" />
        <div className="pdf-line lit" />
        <div className="pdf-line lit short" />
        <div className="pdf-line" />
        <div className="pdf-line" />
        <div className="pdf-line short" />
        <div className="pdf-page">page 3</div>
      </div>

      <div className="cite-toast">
        <span><Icon name="checkCircle" size={16} /></span>
        <div>
          <b>Answer found</b>
          <small>Biology Chapter 4.pdf · page 3</small>
        </div>
      </div>
    </div>
  );
}

/* Books and a mortarboard for the closing band, drawn rather than imported. */
function BooksArt() {
  return (
    <svg className="books-art" viewBox="0 0 220 170" aria-hidden="true">
      <defs>
        <linearGradient id="bk1" x1="0" x2="1">
          <stop offset="0" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
        <linearGradient id="bk2" x1="0" x2="1">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="cap" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#312e81" />
          <stop offset="1" stopColor="#1e1b4b" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <ellipse cx="110" cy="150" rx="90" ry="14" fill="#7c3aed" opacity="0.55" filter="url(#glow)" />
      <rect x="28" y="118" width="164" height="30" rx="7" fill="url(#bk1)" />
      <rect x="34" y="124" width="140" height="6" rx="3" fill="#e9d5ff" opacity="0.65" />
      <rect x="40" y="90" width="148" height="28" rx="7" fill="url(#bk2)" />
      <rect x="46" y="96" width="126" height="5" rx="2.5" fill="#dbeafe" opacity="0.6" />
      <rect x="50" y="64" width="132" height="26" rx="7" fill="url(#bk1)" />
      <rect x="56" y="70" width="112" height="5" rx="2.5" fill="#f3e8ff" opacity="0.6" />
      <path d="M78 52v14c0 7 64 7 64 0V52" fill="url(#cap)" />
      <path d="M110 18 176 44 110 70 44 44z" fill="#3730a3" stroke="#818cf8" strokeWidth="1.5" />
      <path d="M110 44 158 52v26" fill="none" stroke="#c4b5fd" strokeWidth="2" />
      <circle cx="158" cy="82" r="4" fill="#c4b5fd" />
    </svg>
  );
}
