import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { GITHUB_STATE_KEY, RETURN_TO_KEY } from "../components/SocialSignIn.jsx";

/* Where GitHub sends the browser back after sign-in, with ?code and ?state.
   The code is single-use, so it is spent exactly once even though React's
   development mode runs effects twice. */
export default function GitHubCallback({ onSuccess }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // Read once, before anything is cleared: is this reply the one we asked for?
  const [attempt] = useState(() => {
    const expected = sessionStorage.getItem(GITHUB_STATE_KEY);
    const code = params.get("code");
    const ok = Boolean(code && expected && params.get("state") === expected);
    return {
      code,
      ok,
      returnTo: sessionStorage.getItem(RETURN_TO_KEY) || "/documents",
      failure: ok ? "" : params.get("error_description") || "That GitHub sign-in could not be confirmed.",
    };
  });
  const [error, setError] = useState(attempt.failure);
  const spent = useRef(false);

  useEffect(() => {
    if (spent.current) return;
    spent.current = true;
    sessionStorage.removeItem(GITHUB_STATE_KEY);
    sessionStorage.removeItem(RETURN_TO_KEY);
    if (!attempt.ok) return;

    api.githubLogin(attempt.code)
      .then(({ access_token }) => {
        onSuccess(access_token);
        navigate(attempt.returnTo, { replace: true });
      })
      .catch((err) => setError(err.message));
  }, [attempt, navigate, onSuccess]);

  return (
    <main className="auth">
      <div className="auth-card callback-card">
        {error ? (
          <>
            <h1>Sign-in <span className="title-accent">failed</span></h1>
            <p className="error" role="alert">{error}</p>
            <Link className="primary block" to="/documents">Back to sign in</Link>
          </>
        ) : (
          <>
            <h1>Signing you <span className="title-accent">in</span></h1>
            <p className="auth-sub">Confirming your GitHub account…</p>
          </>
        )}
      </div>
    </main>
  );
}
