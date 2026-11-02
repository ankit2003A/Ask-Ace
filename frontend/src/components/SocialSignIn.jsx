import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api";
import Icon from "./Icon.jsx";

const GIS_SRC = "https://accounts.google.com/gsi/client";
export const GITHUB_STATE_KEY = "askace_github_state";
export const RETURN_TO_KEY = "askace_return_to";

/* Google Identity Services, loaded once and shared by every mount. */
let gisPromise = null;
function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GIS_SRC;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => {
        gisPromise = null; // let a later mount retry
        reject(new Error("Could not load Google sign-in."));
      };
      document.head.appendChild(script);
    });
  }
  return gisPromise;
}

/* Google's multicolour G, from their sign-in branding kit. */
function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/* "Continue with Google" and "Continue with GitHub", drawn to the design,
   then an OR rule. Each button only appears once its provider is configured
   on the server, so an unconfigured one is never a dead button.

   Google only issues ID tokens through its own button, so that button sits
   invisibly over ours: the click lands on Google's, the eye sees ours. */
export default function SocialSignIn({ onToken, onError, onProviders = () => {} }) {
  const { pathname, search } = useLocation();
  const holder = useRef(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [githubId, setGithubId] = useState("");
  // Google calls back long after the effect ran; a ref keeps the handlers
  // current instead of capturing the first render's copies.
  const handlers = useRef({ onToken, onError, onProviders });
  useEffect(() => {
    handlers.current = { onToken, onError, onProviders };
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let config;
      try {
        config = await api.authConfig();
      } catch {
        return; // server unreachable: the email form still works
      }
      if (cancelled) return;
      setGithubId(config.github_client_id || "");
      handlers.current.onProviders({
        google: Boolean(config.google_client_id),
        github: Boolean(config.github_client_id),
      });

      if (!config.google_client_id) return;
      try {
        await loadGis();
      } catch {
        return; // blocked script or no network: stay quiet
      }
      if (cancelled || !holder.current) return;

      window.google.accounts.id.initialize({
        client_id: config.google_client_id,
        callback: async ({ credential }) => {
          try {
            const { access_token } = await api.googleLogin(credential);
            handlers.current.onToken(access_token);
          } catch (err) {
            handlers.current.onError(err.message);
          }
        },
      });
      window.google.accounts.id.renderButton(holder.current, {
        type: "standard",
        size: "large",
        // Google needs a pixel width; cover the whole of our button.
        width: Math.round(Math.min(400, Math.max(200, holder.current.clientWidth || 320))),
      });
      setGoogleReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function startGitHub() {
    // A random state ties GitHub's reply to this browser, so a link someone
    // else crafted cannot sign you in to their account.
    const state = crypto.randomUUID();
    sessionStorage.setItem(GITHUB_STATE_KEY, state);
    sessionStorage.setItem(RETURN_TO_KEY, pathname + search);
    const params = new URLSearchParams({ client_id: githubId, scope: "read:user user:email", state });
    window.location.assign(`https://github.com/login/oauth/authorize?${params}`);
  }

  return (
    <div className={googleReady || githubId ? "social-signin is-ready" : "social-signin"}>
      <div className={googleReady ? "social-btn google" : "social-btn google is-hidden"}>
        <span className="social-face" aria-hidden="true">
          <GoogleG /> Continue with Google
        </span>
        <div ref={holder} className="google-overlay" />
      </div>
      {githubId && (
        <button type="button" className="social-btn github" onClick={startGitHub}>
          <Icon name="github" size={20} /> Continue with GitHub
        </button>
      )}
      <div className="or"><span>OR</span></div>
    </div>
  );
}
