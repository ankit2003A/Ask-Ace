import { Link } from "react-router-dom";
import SiteFooter from "../components/SiteFooter.jsx";

/* The idea the whole page hangs on: a PDF is normally a dead file you scroll
   through. Ask & Ace brings it to life — it answers, shows its sources and
   quizzes you. Every claim below is something the app actually does. */

const STEPS = [
  ["Upload", "Drop in a text-based PDF. It is read page by page and indexed in seconds."],
  ["Ask", "Question it in your own words. Every answer points to the page it came from."],
  ["Ace", "Let it quiz you from its own pages — no second upload — and mark your answers."],
  ["Revise", "Every miss links back to the exact page. Read it, retake, move on."],
];

/* Capability counts, not invented popularity figures. */
const FACTS = [
  ["1", "upload, then ask and ace"],
  ["3", "question types"],
  ["30", "questions per test, max"],
  ["100%", "marked server-side"],
];

const BEFORE = [
  "You scroll and hope you spot it",
  "Ctrl+F only finds the exact words",
  "No way to check what actually stuck",
  "Before the exam, you re-read all of it",
];

const AFTER = [
  "Ask in your own words, get a direct answer",
  "Every answer shows the page it came from",
  "It writes a practice test from its own pages",
  "It marks you and points to the page to revise",
];

const FEATURES = [
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
      "Tests are drawn from across the whole document, not just the first chapter, so the " +
      "end of the book gets the same attention as the start.",
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
  return (
    <>
      <div className="page hub">
        <section className="hero">
          <div className="hero-copy">
            <span className="badge reveal">✦ Make any PDF smart</span>
            <h1 className="reveal d1">
              Bring your PDF
              <br />
              <span className="shine">to life.</span>
            </h1>
            <p className="reveal d2">
              A PDF just sits there. <strong>Ask &amp; Ace</strong> makes it talk back. Ask it
              anything and it answers with the page it came from. Then it quizzes you, until
              you know it cold.
            </p>
            <div className="hero-cta reveal d3">
              <Link className="primary lg" to="/documents">
                Bring a PDF to life →
              </Link>
              <Link className="btn-ghost lg" to="/exams">
                Make a practice test
              </Link>
            </div>
            <ul className="ticks reveal d4">
              <li>It answers, and shows you the page</li>
              <li>It quizzes you from its own pages</li>
              <li>It says so when it doesn&apos;t know</li>
            </ul>
          </div>

          {/* The PDF waking up: the page itself at the back, its answer in front of
              it, and the quiz it wrote. Decorative — the same claims are made in
              words above and below, so it is hidden from screen readers. */}
          <div className="hero-art reveal d2" aria-hidden="true">
            <div className="mock-pdf">
              <div className="pdf-tag">PDF</div>
              <div className="pdf-voice">
                <i /><i /><i /><i />
              </div>
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

            <div className="mock mock-chat">
              <div className="mock-bar">
                <i /><i /><i />
                <span>water_cycle.pdf is answering</span>
              </div>
              <p className="mock-ask">Why does urbanisation cause flash flooding?</p>
              <p className="mock-answer">
                Roads and rooftops stop water soaking into the ground, so more of it runs
                off the surface <b>1</b>, which raises the risk of flash flooding <b>2</b>.
              </p>
              <div className="mock-source">
                <b>1</b> water_cycle.pdf · page 3
              </div>
            </div>

            <div className="mock mock-quiz">
              <div className="mock-kind">Your PDF quizzes you · page 2</div>
              <p className="mock-q">
                A well drilled into a confined aquifer under pressure is called?
              </p>
              <div className="mock-opt">Observation well</div>
              <div className="mock-opt right">Artesian well ✓</div>
              <div className="mock-score">
                <strong>18/20</strong>
                <span>Revise page 2 →</span>
              </div>
            </div>
          </div>
        </section>

        <section className="facts">
          {FACTS.map(([value, label]) => (
            <div className="fact" key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </section>

        <section className="compare-section">
          <Eyebrow n="01" label="Before and after" />
          <h2 className="section-title">
            From a file you scroll to a tutor you{" "}
            <span className="gradient-text">talk to</span>.
          </h2>
          <div className="compare">
            <article className="compare-card plain">
              <div className="compare-head">
                <span className="compare-icon">📄</span>
                <h3>A plain PDF</h3>
              </div>
              <ul>
                {BEFORE.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>

            <div className="compare-arrow" aria-hidden="true">→</div>

            <article className="compare-card smart">
              <div className="compare-head">
                <span className="compare-icon">✨</span>
                <h3>
                  The same PDF on Ask <span className="amp">&amp;</span> Ace
                </h3>
              </div>
              <ul>
                {AFTER.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>
          </div>
        </section>

        <section className="modules">
          <Eyebrow n="02" label="Ask, then Ace" />
          <h2 className="section-title">
            Two things your PDF can do <span className="gradient-text">now</span>.
          </h2>

          <div className="module-grid">
            <article className="card module-card">
              <div className="card-icon" aria-hidden="true">
                <Icon name="chat" />
              </div>
              <span className="module-tag">Ask</span>
              <h3>Ask your PDF</h3>
              <p>
                Have a conversation with your study material. Ask it to explain, summarise or
                find something, and it answers from its own pages with the citation attached.
              </p>
              <ul>
                <li>Ask in your own words, not exact keywords</li>
                <li>Every answer links to the page it came from</li>
                <li>Says so honestly when the answer isn&apos;t there</li>
              </ul>
              <Link className="primary" to="/documents">Ask your PDF →</Link>
            </article>

            <article className="card module-card">
              <div className="card-icon alt" aria-hidden="true">
                <Icon name="check" />
              </div>
              <span className="module-tag alt">Ace</span>
              <h3>Ace your exam</h3>
              <p>
                Let the same PDF test you. It writes a practice exam from across all of its
                pages, marks your answers instantly, and shows you exactly where to revise.
              </p>
              <ul>
                <li>Multiple choice, true / false or short answer</li>
                <li>5 to 30 questions, at the difficulty you pick</li>
                <li>Every wrong answer points back to its page</li>
              </ul>
              <Link className="btn-ghost" to="/exams">Ace your exam →</Link>
            </article>
          </div>
        </section>

        <section className="flow">
          <Eyebrow n="03" label="How it works" />
          <h2 className="section-title">Upload once. Ask. Ace. Repeat.</h2>
          <p className="section-lede">
            The PDF you ask questions of is the same one that quizzes you, so moving between
            the two costs nothing and never asks you to upload it twice.
          </p>
          <ol className="flow-steps">
            {STEPS.map(([label, text], i) => (
              <li className="flow-step" key={label}>
                <span className="flow-num">{i + 1}</span>
                <h3>{label}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="bento-section">
          <Eyebrow n="04" label="Why you can trust it" />
          <h2 className="section-title">
            Smart, but never <span className="gradient-text">making things up</span>.
          </h2>
          <p className="section-lede">
            A PDF that talks is only useful if it tells the truth. Each of these is built into
            how Ask &amp; Ace works, not just promised.
          </p>
          <div className="bento">
            {FEATURES.map((f) => (
              <article className={f.wide ? "bento-card span-2" : "bento-card"} key={f.title}>
                <div className="bento-icon" aria-hidden="true">
                  <Icon name={f.icon} />
                </div>
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

        <section className="faq-section">
          <Eyebrow n="05" label="Questions" />
          <h2 className="section-title">Before you bring a PDF to life</h2>
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
          <h2>
            Your PDF has been quiet <span className="gradient-text">long enough</span>.
          </h2>
          <p>Upload one file. Ask it anything. Then let it make sure you know it.</p>
          <div className="hero-cta">
            <Link className="primary lg" to="/documents">Bring a PDF to life →</Link>
            <Link className="btn-ghost lg" to="/exams">Ace your exam</Link>
          </div>
        </section>
      </div>
      <SiteFooter />
    </>
  );
}

function Eyebrow({ n, label }) {
  return (
    <div className="eyebrow">
      <span className="eyebrow-n">{n}</span>
      {label}
    </div>
  );
}

/* Inline so the icons inherit colour and need no icon package. */
const PATHS = {
  chat: <><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /><path d="M8.5 11h7M8.5 14.5h4" /></>,
  check: <><path d="M9 11l3 3 8-8" /><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></>,
  quote: <><path d="M4 7h16M4 12h10M4 17h7" /><circle cx="18" cy="16" r="3" /><path d="M20.5 18.5L22 20" /></>,
  shield: <><path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  spread: <><path d="M4 5h16M4 12h16M4 19h16" /><circle cx="8" cy="5" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="11" cy="19" r="1.6" /></>,
  lock: <><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></>,
};

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
         strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name]}
    </svg>
  );
}
