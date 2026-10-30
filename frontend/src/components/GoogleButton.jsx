import { useEffect, useRef, useState } from "react";
import { api } from "../api";

const GIS_SRC = "https://accounts.google.com/gsi/client";

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

/* Renders Google's own button and hands the resulting ID token to the API.

   Nothing is drawn unless the server reports a client ID, so an instance
   without Google configured simply shows the email form on its own. */
export default function GoogleButton({ onToken, onError }) {
  const holder = useRef(null);
  const [ready, setReady] = useState(false);
  // Google calls back long after this effect ran; a ref keeps the handlers
  // current instead of capturing the first render's copies.
  const handlers = useRef({ onToken, onError });
  useEffect(() => {
    handlers.current = { onToken, onError };
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let clientId = "";
      try {
        ({ google_client_id: clientId } = await api.authConfig());
      } catch {
        return; // server unreachable: the email form still works
      }
      if (!clientId || cancelled) return;
      try {
        await loadGis();
      } catch {
        return; // blocked script or no network: same, stay quiet
      }
      if (cancelled || !holder.current) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
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
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text: "continue_with",
        logo_alignment: "center",
        // Google needs a pixel width; match whatever the card gives us.
        width: Math.round(Math.min(400, Math.max(200, holder.current.clientWidth || 320))),
      });
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={ready ? "google-signin is-ready" : "google-signin"}>
      <div className="or">
        <span>or</span>
      </div>
      <div ref={holder} />
    </div>
  );
}
