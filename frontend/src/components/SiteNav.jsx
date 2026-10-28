import { NavLink } from "react-router-dom";

/* Shared across both modules so the user always knows where they are
   and can cross over without going back to the hub. The two links are the
   two halves of the name: Ask, then Ace. */
export default function SiteNav({ authed, onLogout }) {
  return (
    <header className="site-nav">
      <NavLink to="/" className="nav-brand" aria-label="Ask & Ace home">
        <span className="nav-mark" aria-hidden="true">A</span>
        <span>
          Ask <span className="amp">&amp;</span> Ace
        </span>
      </NavLink>

      <nav className="nav-links">
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/documents">Ask your PDF</NavLink>
        <NavLink to="/exams">Ace your exam</NavLink>
        {authed && (
          <button className="link" onClick={onLogout}>Log out</button>
        )}
      </nav>
    </header>
  );
}
