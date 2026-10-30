import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import GoogleButton from "./GoogleButton.jsx";
import Icon from "./Icon.jsx";

// Crossed out while the password is hidden, open once it is shown.
function EyeIcon({ crossed }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <line x1="3" y1="3" x2="21" y2="21" />}
    </svg>
  );
}

/* The cards floating either side of the form. Each side is a fixed-size box,
   so the connecting curves can be drawn in that box's own coordinates. Every
   line is something the app does. */
const SIDES = {
  login: {
    left: {
      cards: [
        { top: 70, x: 10, icon: "file", title: "Upload a PDF", text: "Notes, textbooks or slides" },
        { top: 360, x: 14, icon: "chart", title: "See what to revise", text: "Every miss points to its page" },
      ],
      path: "M 90 200 C 90 260, 150 270, 190 330 S 270 440, 290 470",
    },
    right: {
      cards: [{ top: 230, x: 40, icon: "help", title: "Generate exams", text: "MCQ, true/false and short answer" }],
      path: "M 120 370 C 120 450, 60 470, -30 520",
    },
  },
  register: {
    left: {
      cards: [
        { top: 120, x: 30, icon: "chat", title: "Ask your PDF", text: "Answers cite the exact page" },
        { top: 400, x: 26, icon: "star", title: "Personalised tests", text: "Written from your own pages" },
      ],
      path: "M 110 250 C 110 300, 170 320, 290 360",
    },
    right: {
      cards: [
        { top: 120, x: 50, icon: "book", title: "Learn smarter", text: "Revise the pages you missed" },
        { top: 420, x: 52, icon: "shield", title: "Private by default", text: "Only you see your documents" },
      ],
      path: "M 150 250 C 150 330, 60 360, -30 420",
    },
  },
};

const TRUST = [
  ["lock", "Secure & Private"],
  ["creditCard", "No Credit Card Required"],
  ["quote", "Every Answer Cites Its Page"],
];

function FloatSide({ side, data }) {
  return (
    <aside className={`auth-float ${side}`} aria-hidden="true">
      <svg className="auth-lines" viewBox="0 0 260 600" preserveAspectRatio="none">
        <path d={data.path} />
      </svg>
      {data.cards.map((c) => (
        <div className="float-card" key={c.title} style={{ top: c.top, [side === "left" ? "left" : "right"]: c.x }}>
          <span className="float-icon"><Icon name={c.icon} size={20} /></span>
          <strong>{c.title}</strong>
          <span>{c.text}</span>
        </div>
      ))}
    </aside>
  );
}

const CHECKS = [
  [(p) => p.length >= 8, "At least 8 characters"],
  [(p) => /\d/.test(p), "Include a number (recommended)"],
  [(p) => /[^A-Za-z0-9]/.test(p), "Include a special character (recommended)"],
];

export default function AuthForm({ onSuccess }) {
  const [params] = useSearchParams();
  const wantsSignup = params.has("signup");
  const [mode, setMode] = useState(wantsSignup ? "register" : "login");
  // "Start Free" while this card is already open changes only the URL, so
  // follow it here (during render, which React supports for exactly this).
  const [seenSignup, setSeenSignup] = useState(wantsSignup);
  if (wantsSignup !== seenSignup) {
    setSeenSignup(wantsSignup);
    setMode(wantsSignup ? "register" : "login");
  }
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const registering = mode === "register";

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const fn = registering ? api.register : api.login;
      const { access_token } = await fn(email, password);
      onSuccess(access_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <div className="auth-orbs" aria-hidden="true"><i /><i /><i /></div>

      <div className="auth-stage">
        <FloatSide side="left" data={SIDES[mode].left} />

        <form className="auth-card" onSubmit={submit}>
          <span className="auth-mark" aria-hidden="true"><Icon name="bolt" size={26} /></span>
          <h1>
            {registering ? "Create Your " : "Welcome "}
            <span className="title-accent">{registering ? "Account" : "Back"}</span>
          </h1>
          <p className="auth-sub">
            {registering
              ? "Start asking your PDFs questions and acing practice tests in seconds."
              : "Log in to keep bringing your PDFs to life with Ask & Ace."}
          </p>

          <GoogleButton onToken={onSuccess} onError={setError} />

          <label className="auth-field">
            Email Address
            <span className="input-wrap">
              <Icon name="mail" size={18} className="input-icon" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                     placeholder="you@example.com" required autoComplete="email" />
            </span>
          </label>

          <label className="auth-field">
            Password
            <span className="input-wrap password-field">
              <Icon name="lock" size={18} className="input-icon" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={registering ? "Create a strong password" : "Enter your password"}
                required
                minLength={8}
                maxLength={72}
                autoComplete={registering ? "new-password" : "current-password"}
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(!showPassword)}
              >
                <EyeIcon crossed={!showPassword} />
              </button>
            </span>
          </label>

          {registering && (
            <ul className="pw-checks" aria-label="Password guidance">
              {CHECKS.map(([test, label]) => (
                <li key={label} className={test(password) ? "met" : ""}>
                  <Icon name="check" size={11} />
                  {label}
                </li>
              ))}
            </ul>
          )}

          {error && <p className="error" role="alert">{error}</p>}

          <button className="primary block" disabled={busy}>
            {busy ? "Please wait…" : registering ? "Create Account" : "Log In"}
            {!busy && <Icon name="arrowRight" size={17} />}
          </button>

          <p className="auth-switch">
            {registering ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              className="link"
              onClick={() => {
                setMode(registering ? "login" : "register");
                setError("");
              }}
            >
              {registering ? "Log in" : "Sign up"}
            </button>
          </p>
        </form>

        <FloatSide side="right" data={SIDES[mode].right} />
      </div>

      <ul className="auth-trust">
        {TRUST.map(([icon, label]) => (
          <li key={label}><Icon name={icon} size={18} />{label}</li>
        ))}
      </ul>
    </main>
  );
}
