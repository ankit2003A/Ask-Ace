import { Link } from "react-router-dom";
import { API_BASE } from "../api";
import Icon from "./Icon.jsx";

const REPO = "https://github.com/ankit2003A/Ask-Ace";
const YEAR = new Date().getFullYear();

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <Link to="/" className="nav-brand">
            <span className="nav-mark" aria-hidden="true"><Icon name="bolt" size={18} /></span>
            <span>
              Ask <span className="amp">&amp;</span> <span className="brand-accent">Ace</span>
            </span>
          </Link>
          <p>Bring your PDF to life. Ask it anything, then let it quiz you.</p>
        </div>

        <nav className="footer-col" aria-label="Product">
          <h3>Product</h3>
          <Link to="/documents">Ask your PDF</Link>
          <Link to="/exams">Ace your exam</Link>
          <Link to="/#features">Features</Link>
          <Link to="/#how">How it works</Link>
        </nav>

        <nav className="footer-col" aria-label="Resources">
          <h3>Resources</h3>
          <a href={`${API_BASE}/docs`}>API documentation</a>
          <a href={REPO}>Source code</a>
          <Link to="/#faq">FAQ</Link>
        </nav>

        <nav className="footer-col" aria-label="Project">
          <h3>Project</h3>
          <Link to="/#trust">Privacy &amp; trust</Link>
          <a href={`${REPO}#readme`}>About the project</a>
        </nav>

        <div className="footer-social">
          <h3>Stay Connected</h3>
          <a className="social" href={REPO} aria-label="Ask & Ace on GitHub">
            <Icon name="github" size={20} />
          </a>
        </div>
      </div>

      <p className="footer-legal">
        © {YEAR} Ask &amp; Ace · A personal project by Ankit Verma
      </p>
    </footer>
  );
}
