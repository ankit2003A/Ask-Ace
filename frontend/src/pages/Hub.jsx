import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { API_BASE } from "../api";
import Icon from "../components/Icon.jsx";
import SiteFooter from "../components/SiteFooter.jsx";
import { AceShowcase, AskShowcase, BooksArt, HeroArt, TrustVisual, WhyVisual } from "./HubArt.jsx";

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
  ["quote", "Case studies"],
  ["cap", "Past papers"],
];

const WHY = [
  ["fileText", "upload", "Upload Any PDF", "Notes, textbooks or slides. It is read page by page and indexed in seconds."],
  ["chat", "chat", "It Talks Back", "Ask in your own words. Every answer is drawn from your pages and cites them."],
  ["help", "exam", "Writes Smart Exams", "Multiple choice, true/false and short answer — 5 to 30 questions, from the whole document."],
  ["target", "revise", "Revise What Matters", "Your attempt is marked instantly, and every miss points to the page to reread."],
];

const STEPS = [
  ["upload", "Upload Your PDF", "Drop in a text-based PDF. It is ready in seconds."],
  ["chat", "Ask Anything", "Get answers with the exact page each one came from."],
  ["target", "Ace a Practice Test", "It writes a test from its own pages and marks you."],
  ["checkCircle", "Revise and Retake", "Read the page you missed, then try again."],
];

/* The app's real limits, not invented popularity figures. */
const STATS = [
  ["200", "pages per PDF"],
  ["30", "questions per test"],
  ["3", "question types"],
  ["1", "upload for both"],
];

const TRUST = [
  {
    wide: true,
    icon: "quote",
    visual: "cite",
    title: "It shows you where it read that",
    body:
      "Your PDF answers only from its own pages, and every answer is numbered back to them. " +
      "Click a citation to see the exact passage, on the exact page.",
  },
  {
    icon: "shield",
    visual: "refuse",
    title: "It admits when it doesn't know",
    body: "If the answer isn't in your PDF, it says so plainly instead of making something up.",
  },
  {
    icon: "spread",
    visual: "spread",
    title: "Not just chapter one",
    body: "Tests are drawn from across the whole document, so the last chapter counts as much as the first.",
  },
  {
    icon: "lock",
    visual: "lock",
    title: "No peeking at the answers",
    body: "Questions reach your screen without their answers. The server marks you, then reveals the key.",
  },
  {
    icon: "link",
    visual: "link",
    title: "One upload does both",
    body: "The PDF you asked questions of is the one that quizzes you. No re-uploading.",
  },
];

const PLAN = [
  "Answers with page citations, on every question",
  "Practice tests: MCQ, true/false, short answer",
  "Instant marking and best-score tracking",
  "PDFs up to 10 MB and 200 pages",
];

const SELF_HOST = [
  "Every feature, on your own server",
  "Any OpenAI-compatible model, or a local one",
  "Your documents never leave your machine",
  "One Docker image, one-click Render deploy",
];

const STACK = ["FastAPI", "ChromaDB", "fastembed", "Groq / any LLM", "React 19", "Vite", "SQLite", "Docker"];

const REPO = "https://github.com/ankit2003A/Ask-Ace";

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

/* A soft light that follows the pointer across a card. */
function spotlight(e) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}

/* Fades sections in as they scroll into view. Anything already on screen, or
   every section when the browser can't observe or the reader prefers less
   motion, is shown straight away. */
function useScrollReveal(root) {
  useEffect(() => {
    const items = root.current?.querySelectorAll("[data-reveal]") ?? [];
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-shown"));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-shown");
          io.unobserve(entry.target);
        }
      }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [root]);
}

export default function Hub() {
  const { hash } = useLocation();
  const page = useRef(null);
  useScrollReveal(page);

  // Nav links like /#how land here; the browser won't scroll to them by itself
  // because the sections only exist once this page has rendered.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  return (
    <>
      <div className="page hub" ref={page}>
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
              <Link className="primary lg" to="/dashboard?signup=1">
                Start Asking — It&apos;s Free
              </Link>
              <Link className="btn-outline lg" to="/#how">
                <Icon name="play" size={14} /> See How It Works
              </Link>
            </div>
            <ul className="ticks rise d4">
              <li><Icon name="check" size={15} />No Credit Card</li>
              <li><Icon name="check" size={15} />Instant Results</li>
              <li><Icon name="check" size={15} />Built for Students</li>
            </ul>
          </div>

          <HeroArt />
        </section>

        <section className="works-with" data-reveal>
          <p>Works with any text-based PDF</p>
          {/* Two copies, so the strip can loop without a seam. */}
          <div className="marquee">
            <ul>
              {[...WORKS_WITH, ...WORKS_WITH].map(([icon, label], i) => (
                <li key={i} aria-hidden={i >= WORKS_WITH.length}><Icon name={icon} size={22} />{label}</li>
              ))}
            </ul>
          </div>
        </section>

        <section id="features" className="center-section glow-l" data-reveal>
          <span className="pill-label"><Icon name="sparkle" size={14} /> Why Ask &amp; Ace?</span>
          <h2 className="section-title">
            Everything your PDF <span className="title-accent">could never do</span>.
          </h2>
          <p className="section-lede">
            One upload turns a file you scroll into a study partner that answers, cites and tests.
          </p>
          <div className="why-grid">
            {WHY.map(([icon, visual, title, text]) => (
              <article className="why-card" key={title} onMouseMove={spotlight}>
                <span className="orb-icon"><Icon name={icon} size={26} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
                <WhyVisual kind={visual} />
              </article>
            ))}
          </div>
        </section>

        <section className="showcase" data-reveal>
          <div className="show-row">
            <div className="show-copy">
              <span className="pill-label"><Icon name="chat" size={14} /> Ask your PDF</span>
              <h2>
                Answers you can <span className="title-accent">check</span>, not just trust.
              </h2>
              <p>
                Ask a question the way you&apos;d ask a tutor. The answer comes from your own
                pages, with numbered citations that open the exact passage it used.
              </p>
              <ul className="show-points">
                <li><Icon name="checkCircle" size={18} />Plain-language questions, not keywords</li>
                <li><Icon name="checkCircle" size={18} />Every answer numbered back to its page</li>
                <li><Icon name="checkCircle" size={18} />Says so when the answer isn&apos;t there</li>
              </ul>
              <Link className="primary" to="/documents">
                Ask your PDF <Icon name="arrowRight" size={17} />
              </Link>
            </div>
            <AskShowcase />
          </div>

          <div className="show-row flip">
            <div className="show-copy">
              <span className="pill-label"><Icon name="target" size={14} /> Ace your exam</span>
              <h2>
                A practice test, <span className="title-accent">marked in seconds</span>.
              </h2>
              <p>
                Pick a question type and difficulty. It writes a test from across the whole
                document, marks your attempt, and sends every miss back to the page to reread.
              </p>
              <ul className="show-points">
                <li><Icon name="checkCircle" size={18} />5 to 30 questions, easy to hard</li>
                <li><Icon name="checkCircle" size={18} />Answer key stays hidden until you submit</li>
                <li><Icon name="checkCircle" size={18} />Your best score kept for every test</li>
              </ul>
              <Link className="btn-outline" to="/exams">
                Ace your exam <Icon name="arrowRight" size={17} />
              </Link>
            </div>
            <AceShowcase />
          </div>
        </section>

        <section id="how" className="center-section how" data-reveal>
          <span className="pill-label"><Icon name="sparkle" size={14} /> Simple. Fast. Powerful.</span>
          <h2 className="section-title">How It Works</h2>
          <p className="section-lede">From a silent file to a marked practice test in four steps.</p>
          <div className="how-panel">
            <span className="how-line" aria-hidden="true" />
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
          </div>
        </section>

        <section className="stats" data-reveal>
          {STATS.map(([value, label]) => (
            <div className="stat" key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </section>

        <section id="trust" className="center-section glow-r" data-reveal>
          <span className="pill-label"><Icon name="shield" size={14} /> Why You Can Trust It</span>
          <h2 className="section-title">
            Smart, but never <span className="title-accent">making things up</span>.
          </h2>
          <div className="bento">
            {TRUST.map((f) => (
              <article className={f.wide ? "bento-card span-2" : "bento-card"} key={f.title}
                       onMouseMove={spotlight}>
                <span className="bento-icon"><Icon name={f.icon} size={21} /></span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
                <TrustVisual kind={f.visual} />
              </article>
            ))}
          </div>
        </section>

        <section id="pricing" className="center-section glow-l" data-reveal>
          <span className="pill-label"><Icon name="creditCard" size={14} /> Pricing</span>
          <h2 className="section-title">
            Simple pricing: <span className="title-accent">free</span>.
          </h2>
          <div className="price-grid">
            <article className="price-card featured">
              <span className="price-tag">Hosted</span>
              <h3>Free</h3>
              <p className="price"><b>$0</b><span>no card, no trial clock</span></p>
              <ul>
                {PLAN.map((item) => <li key={item}><Icon name="checkCircle" size={17} />{item}</li>)}
              </ul>
              <Link className="primary block" to="/dashboard?signup=1">
                Get Started Free <Icon name="arrowRight" size={17} />
              </Link>
            </article>
            <article className="price-card">
              <span className="price-tag alt">Open source</span>
              <h3>Self-host</h3>
              <p className="price"><b>Your key</b><span>run it on your own server</span></p>
              <ul>
                {SELF_HOST.map((item) => <li key={item}><Icon name="checkCircle" size={17} />{item}</li>)}
              </ul>
              <a className="btn-outline block" href={REPO}>
                <Icon name="github" size={17} /> View the Source
              </a>
            </article>
          </div>
        </section>

        <section id="about" className="center-section" data-reveal>
          <span className="pill-label"><Icon name="user" size={14} /> About</span>
          <h2 className="section-title">
            Built by a student, <span className="title-accent">for students</span>.
          </h2>
          <div className="about-card">
            <span className="about-mark" aria-hidden="true">AV</span>
            <p>
              Ask &amp; Ace is a personal project by <strong>Ankit Verma</strong>. It started from a
              simple frustration: a PDF of notes can&apos;t tell you what&apos;s in it, and
              re-reading all of it before an exam doesn&apos;t tell you what stuck. So this app
              reads the PDF, answers from it with the page attached, and then tests you on it.
            </p>
            <ul className="stack">
              {STACK.map((tech) => <li key={tech}>{tech}</li>)}
            </ul>
          </div>
        </section>

        <section id="faq" className="faq-section" data-reveal>
          <div className="faq-intro">
            <span className="pill-label"><Icon name="help" size={14} /> Questions</span>
            <h2 className="section-title">Before You Bring a PDF to Life</h2>
            <p className="section-lede">The things people ask first. Still curious? It&apos;s all open.</p>
            <div className="faq-links">
              <a href={`${API_BASE}/docs`}><Icon name="book" size={18} />API documentation</a>
              <a href={REPO}><Icon name="github" size={18} />Source code</a>
            </div>
          </div>
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

        <section className="cta-band" data-reveal>
          <div className="cta-copy">
            <h2>Ready to bring your PDF to life?</h2>
            <p>Upload one file. Ask it anything. Then let it make sure you know it.</p>
          </div>
          <div className="cta-action">
            <Link className="primary lg" to="/dashboard?signup=1">
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
