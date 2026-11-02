import Icon from "../components/Icon.jsx";

/* Pictures of the product for the landing page. All decorative: every claim
   they make is also made in words, so each is hidden from screen readers.
   The figures illustrate one document and stay inside the app's real limits
   (200 pages, 30 questions, three question types). */

export function HeroArt() {
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
                    <li><i className="k-easy" /><span>Easy</span><b>30% <small>(9)</small></b></li>
                    <li><i className="k-med" /><span>Medium</span><b>50% <small>(15)</small></b></li>
                    <li><i className="k-hard" /><span>Hard</span><b>20% <small>(6)</small></b></li>
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

      <PdfPage className="mock-pdf" />

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

/* The PDF itself, waking up: a pale page, a red PDF tag, a voice meter that
   pulses, and the cited lines lit up in blue. */
function PdfPage({ className, page = 3 }) {
  return (
    <div className={className}>
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
      <div className="pdf-page">page {page}</div>
    </div>
  );
}

/* A small live preview at the foot of each "Why" card. */
export function WhyVisual({ kind }) {
  if (kind === "upload") {
    return (
      <div className="wv wv-upload" aria-hidden="true">
        <span className="wv-file"><Icon name="fileText" size={16} /></span>
        <div className="wv-grow">
          <b>water_cycle.pdf</b>
          <div className="wv-bar"><i /></div>
        </div>
        <em className="wv-ok"><Icon name="check" size={12} /></em>
      </div>
    );
  }
  if (kind === "chat") {
    return (
      <div className="wv wv-chat" aria-hidden="true">
        <p className="wv-q">What causes tides?</p>
        <p className="wv-a">The Moon&apos;s pull on the oceans <b>1</b></p>
      </div>
    );
  }
  if (kind === "exam") {
    return (
      <div className="wv wv-exam" aria-hidden="true">
        <span className="wv-tag">MCQ · Medium</span>
        <div className="wv-opt">Evaporation</div>
        <div className="wv-opt right">Condensation <Icon name="check" size={12} /></div>
      </div>
    );
  }
  return (
    <div className="wv wv-revise" aria-hidden="true">
      <span className="wv-ring"><b>8</b>/10</span>
      <div className="wv-grow">
        <small>2 to revise</small>
        <b className="wv-link">Revise page 12 →</b>
      </div>
    </div>
  );
}

/* Showcase: asking. The PDF page with the passage that was used, lit up, and
   the chat answer that cites it. */
export function AskShowcase() {
  return (
    <div className="show-art ask" aria-hidden="true">
      <div className="show-glow" />
      <div className="show-page">
        <div className="show-page-head"><span className="pdf-tag">PDF</span><small>water_cycle.pdf · page 3</small></div>
        <i /><i className="s" /><i />
        <div className="show-hl"><span className="show-hl-n">1</span><i /><i className="s" /></div>
        <i /><i /><i className="s" />
        <div className="show-hl alt"><span className="show-hl-n">2</span><i className="s" /></div>
        <i /><i className="s" />
      </div>
      <div className="show-chat">
        <div className="show-chat-bar"><i /><i /><i /><span>Ask your PDF</span></div>
        <p className="show-q">Why does urbanisation cause flash flooding?</p>
        <p className="show-a">
          Roads and rooftops stop rain soaking in <b>1</b>, so more of it runs straight off the
          surface into drains, which raises the risk of flash floods <b>2</b>.
        </p>
        <div className="show-sources">
          <span><b>1</b> page 3</span>
          <span><b>2</b> page 3</span>
        </div>
      </div>
    </div>
  );
}

/* Showcase: acing. A marked attempt with its score, what was right, and the
   page to read for what was not. */
export function AceShowcase() {
  return (
    <div className="show-art ace" aria-hidden="true">
      <div className="show-glow alt" />
      <div className="show-result">
        <div className="show-result-head">
          <span className="show-score"><b>8</b><small>/10</small></span>
          <div>
            <strong>Water Cycle · Practice Test</strong>
            <small>10 questions · Medium · marked instantly</small>
          </div>
        </div>
        <ul className="show-qs">
          <li className="ok"><Icon name="check" size={13} /><span>What drives evaporation?</span></li>
          <li className="ok"><Icon name="check" size={13} /><span>Define an aquifer.</span></li>
          <li className="miss"><span className="x">✕</span><span>What is transpiration?</span><em>Revise page 12</em></li>
          <li className="ok"><Icon name="check" size={13} /><span>True or false: clouds are vapour.</span></li>
          <li className="miss"><span className="x">✕</span><span>Name the four stages.</span><em>Revise page 2</em></li>
        </ul>
        <div className="show-best"><span>Best score</span><div className="show-best-bar"><i /></div><b>9/10</b></div>
      </div>
      <PdfPage className="show-pdf" page={12} />
    </div>
  );
}

/* A small picture for each trust tile. */
export function TrustVisual({ kind }) {
  if (kind === "cite") {
    return (
      <div className="tv tv-cite" aria-hidden="true">
        <b>1</b><span className="chip-page">water_cycle.pdf · page 3</span>
        <b>2</b><span className="chip-page">water_cycle.pdf · page 1</span>
        <span className="tv-note">← what a citation opens</span>
      </div>
    );
  }
  if (kind === "refuse") {
    return (
      <div className="tv tv-refuse" aria-hidden="true">
        <Icon name="shield" size={15} />
        I couldn&apos;t find that in your documents.
      </div>
    );
  }
  if (kind === "spread") {
    return (
      <div className="tv tv-spread" aria-hidden="true">
        {[42, 70, 55, 88, 62, 76, 50, 83, 66, 58].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}
        <small>p.1</small><small>p.143</small>
      </div>
    );
  }
  if (kind === "lock") {
    return (
      <div className="tv tv-lock" aria-hidden="true">
        <Icon name="lock" size={14} />
        <span>Answer:</span><span className="tv-blur">Condensation</span>
        <small>until you submit</small>
      </div>
    );
  }
  return (
    <div className="tv tv-link" aria-hidden="true">
      <span>Ask</span><i /><span className="tv-file"><Icon name="fileText" size={13} />one PDF</span><i /><span>Ace</span>
    </div>
  );
}

/* Books and a mortarboard for the closing band, drawn rather than imported. */
export function BooksArt() {
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
