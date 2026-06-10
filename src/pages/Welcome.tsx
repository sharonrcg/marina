import { Link } from "react-router-dom";
import "../styles/welcome.css";

const ACCENT = "#8b5cf6";

function shade(hex: string) {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.slice(0, 2), 16) * 0.78);
  const g = Math.round(parseInt(h.slice(2, 4), 16) * 0.74);
  const b = Math.round(parseInt(h.slice(4, 6), 16) * 0.86);
  return `rgb(${r}, ${g}, ${b})`;
}

function withAlpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const Welcome = () => {
  return (
    <div className="welcome-layout">
      <div className="welcome-content">

        {/* Logo */}
        <img src="/logo.png" alt="marina logo" className="welcome-logo" />

        {/* Wordmark */}
        <h1 className="welcome-title">marina</h1>

        {/* Tagline */}
        <p style={{
          fontSize: 16,
          fontWeight: 600,
          color: withAlpha("#473a68", 0.75),
          lineHeight: 1.55,
          maxWidth: 300,
          margin: "0 auto",
          textAlign: "center",
        }}>
          Track feedings, sleep, and more — parenting made a little simpler.
        </p>

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
          <Link to="/signup" style={{ textDecoration: "none" }}>
            <button
              className="welcome-btn-primary"
              style={{
                background: `linear-gradient(135deg, ${ACCENT} 0%, ${shade(ACCENT)} 100%)`,
                boxShadow: `0 14px 28px -10px ${withAlpha(ACCENT, 0.7)}`,
              }}
            >
              Get started
            </button>
          </Link>

          <Link to="/login" style={{ textDecoration: "none" }}>
            <button className="welcome-btn-secondary">
              Log in
            </button>
          </Link>
        </div>

      </div>
    </div>
  );
};

export default Welcome;
