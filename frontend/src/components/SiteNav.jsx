import { Link, NavLink, useLocation } from "react-router-dom";
import Icon from "./Icon.jsx";

/* Shared across every page. Section links jump down the landing page; the two
   module links are the two halves of the name: Ask, then Ace. Signed out on a
   module page means the sign-in card is showing, so the way out is home. */
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
        <Link className="nav-section" to="/#features">Features</Link>
        <Link className="nav-section" to="/#how">How It Works</Link>
        <NavLink to="/documents">Ask your PDF</NavLink>
        <NavLink to="/exams">Ace your exam</NavLink>
        <Link className="nav-section" to="/#faq">FAQ</Link>
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
            <Link className="btn-outline sm" to="/documents">Log in</Link>
            <Link className="primary sm" to="/documents?signup=1">Start Free</Link>
          </>
        )}
      </div>
    </header>
  );
}
