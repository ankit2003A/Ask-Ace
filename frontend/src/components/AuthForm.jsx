import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import Icon from "./Icon.jsx";
import SocialSignIn from "./SocialSignIn.jsx";

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

/* The cards floating either side of the form, placed as a share of the form's
   height so they keep their spots as it grows. The curves are drawn in the
   same percentage space (0-100 each way). Every line is something the app
   does. */
const SIDES = {
  login: {
    left: {
      cards: [
        { top: 17, icon: "file", title: "Upload Notes", text: "PDFs, books or class notes" },
        { top: 59, icon: "chart", title: "Track Progress", text: "Your best score on every test" },
      ],
      path: "M 56 37 C 56 50, 78 52, 108 60",
    },
    right: {
      cards: [{ top: 40, icon: "help", title: "Generate Exams", text: "MCQs, true/false and more with AI" }],
      path: "M 44 60 C 44 72, 20 76, -8 82",
    },
  },
  register: {
    left: {
      cards: [
        { top: 19, icon: "cap", title: "Ask Your PDF", text: "Answers that show the exact page" },
        { top: 55, icon: "star", title: "Personalized Exams", text: "Tailored to your own notes" },
      ],
      path: "M 56 35 C 56 45, 80 48, 108 50",
    },
    right: {
      cards: [
        { top: 19, icon: "book", title: "Learn Smarter", text: "AI-powered practice from your PDFs" },
        { top: 57, icon: "rocket", title: "Achieve More", text: "Retake, improve and beat your best" },
      ],
      path: "M 44 35 C 44 47, 22 50, -8 54",
    },
  },
};

const TRUST = [
  ["lock", "Secure & Private"],
  ["creditCard", "No Credit Card Required"],
  ["users", "Built for Students"],
];

const CHECKS = [
  [(p) => p.length >= 8, "At least 8 characters"],
  [(p) => /\d/.test(p), "Include a number"],
  [(p) => /[^A-Za-z0-9]/.test(p), "Include a special character"],
];

function FloatSide({ side, data }) {
  return (
    <aside className={`auth-float ${side}`} aria-hidden="true">
      <svg className="auth-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d={data.path} vectorEffect="non-scaling-stroke" />
      </svg>
      {data.cards.map((c, i) => (
        <div className="float-card" key={c.title} style={{ top: `${c.top}%`, animationDelay: `${i * 1.6}s` }}>
          <span className="float-icon"><Icon name={c.icon} size={20} /></span>
          <strong>{c.title}</strong>
          <span>{c.text}</span>
        </div>
      ))}
    </aside>
  );
}

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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [providers, setProviders] = useState({ google: false, github: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const registering = mode === "register";

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (registering) {
      const unmet = CHECKS.find(([test]) => !test(password));
      if (unmet) {
        setError(`Password: ${unmet[1].toLowerCase()}.`);
        return;
      }
    }
    setBusy(true);
    try {
      const { access_token } = registering
        ? await api.register(email, password, name)
        : await api.login(email, password);
      onSuccess(access_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(registering ? "login" : "register");
    setError("");
    setForgot(false);
  }

  return (
    <main className="auth">
      <div className={`auth-orbs ${mode}`} aria-hidden="true"><i /><i /><i /></div>

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
              ? "Start asking your PDFs and generating exams with AI in seconds."
              : "Log in to continue your learning journey with Ask & Ace."}
          </p>

          <SocialSignIn onToken={onSuccess} onError={setError} onProviders={setProviders} />

          {registering && (
            <label className="auth-field">
              Full Name
              <span className="input-wrap">
                <Icon name="user" size={18} className="input-icon" />
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
                       placeholder="Enter your full name" autoComplete="name" />
              </span>
            </label>
          )}

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

          {registering ? (
            <ul className="pw-checks" aria-label="Password requirements">
              {CHECKS.map(([test, label]) => (
                <li key={label} className={test(password) ? "met" : ""}>
                  <Icon name="check" size={10} />
                  {label}
                </li>
              ))}
            </ul>
          ) : (
            <div className="forgot">
              <button type="button" className="link" aria-expanded={forgot}
                      onClick={() => setForgot(!forgot)}>
                Forgot password?
              </button>
              {/* No email is sent from this app, but a provider sign-in with the
                  same address is a real way back in: it links to the account. */}
              {forgot && (
                <p className="forgot-help">
                  {providers.google || providers.github ? (
                    <>
                      Use{" "}
                      {[providers.google && "Continue with Google", providers.github && "Continue with GitHub"]
                        .filter(Boolean)
                        .map((label, i) => <span key={label}>{i > 0 && " or "}<strong>{label}</strong></span>)}{" "}
                      with the same email address. You&apos;ll be signed straight in to your account.
                    </>
                  ) : (
                    "This app can't send reset emails yet. Create a new account to keep going."
                  )}
                </p>
              )}
            </div>
          )}

          {error && <p className="error" role="alert">{error}</p>}

          <button className="primary block" disabled={busy}>
            {busy ? "Please wait…" : registering ? "Create Account" : "Log In"}
            {!busy && <Icon name="arrowRight" size={17} />}
          </button>

          <p className="auth-switch">
            {registering ? "Already have an account?" : "Don't have an account?"}{" "}
            <button type="button" className="link" onClick={switchMode}>
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
