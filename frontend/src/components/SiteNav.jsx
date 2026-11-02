import { Link, NavLink, useLocation } from "react-router-dom";
import { API_BASE } from "../api";
import Icon from "./Icon.jsx";

/* Shared across every page. Signed out, the links walk the landing page, as
   in the designs; signed in, they are the two modules: Ask, then Ace. Signed
   out on any other page means the sign-in card is showing, so the way out is
   home. */
export default function SiteNav({ authed, onLogout }) {
  const { pathname } = useLocation();
  const onAuthScreen = !authed && pathname !== "/";

  return (
    <header className="site-nav">
      <Link to="/" className="nav-brand" aria-label="Ask & Ace home">
        <span className="nav-mark" aria-hidden="true"><Icon name="bolt" size={18} /></span>
        <span>
          Ask <span className="amp">&amp;</span> <span className="brand-accent">Ace</span>
        </span>
      </Link>

      <nav className="nav-links" aria-label="Main">
        {authed ? (
          <>
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/documents">Ask your PDF</NavLink>
            <NavLink to="/exams">Ace your exam</NavLink>
          </>
        ) : (
          <>
            <Link to="/#features">Features</Link>
            <Link to="/#how">How It Works</Link>
          </>
        )}
        <a className="nav-section" href={`${API_BASE}/docs`}>Docs</a>
        {!authed && (
          <>
            <Link className="nav-section" to="/#pricing">Pricing</Link>
            <Link className="nav-section" to="/#about">About</Link>
          </>
        )}
      </nav>

      <div className="nav-actions">
        {authed ? (
          <button className="btn-outline sm" onClick={onLogout}>Log out</button>
        ) : onAuthScreen ? (
          <Link className="btn-outline sm accent" to="/">
            Back to Home <Icon name="arrowRight" size={15} />
          </Link>
        ) : (
          <>
            <Link className="btn-outline sm" to="/dashboard">Log in</Link>
            <Link className="primary sm" to="/dashboard?signup=1">Start Free</Link>
          </>
        )}
      </div>
    </header>
  );
}
