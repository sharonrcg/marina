"use client";

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/layout.css";
import "../styles/family-create.css";

const ACCENT = "#8b5cf6";

function withAlpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function shade(hex: string) {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.slice(0, 2), 16) * 0.78);
  const g = Math.round(parseInt(h.slice(2, 4), 16) * 0.74);
  const b = Math.round(parseInt(h.slice(4, 6), 16) * 0.86);
  return `rgb(${r}, ${g}, ${b})`;
}

const FamilyJoin = () => {
  const [familyID, setFamilyID] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // TODO: joinFamily(familyID)
    navigate("/");
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "15px 18px",
    fontSize: 17,
    fontFamily: "inherit",
    fontWeight: 700,
    color: "#4a3d6b",
    background: "rgba(255,255,255,0.66)",
    border: "1.5px solid rgba(139,92,246,0.2)",
    borderRadius: 16,
    outline: "none",
    transition: "border-color .18s, box-shadow .18s, background .18s",
    boxSizing: "border-box",
  };

  return (
    <div className="layout">
      <div className="layout-content">

        {/* Header */}
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              alignSelf: "center",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: 18,
              marginBottom: 4,
              fontSize: 28,
              background: withAlpha(ACCENT, 0.16),
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 8px 20px -8px ${withAlpha(ACCENT, 0.5)}`,
            }}
          >
            🤝
          </div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 900,
              color: "#473a68",
              letterSpacing: -0.5,
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            Join a Family
          </h1>
          <p
            style={{
              fontSize: 15.5,
              fontWeight: 600,
              color: "#7b6fa0",
              lineHeight: 1.5,
              maxWidth: 360,
              margin: "0 auto",
            }}
          >
            Enter the Family ID from your partner's Settings tab to connect your accounts.
          </p>
        </div>

        <form
          className="family-create-form"
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 22 }}
        >
          {/* Family ID input */}
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#6f6291",
                letterSpacing: 0.3,
                paddingLeft: 4,
                textAlign: "left",
              }}
            >
              Family ID
            </label>
            <input
              className="family-name-input"
              style={inputStyle}
              placeholder="Paste the ID here"
              value={familyID}
              onChange={(e) => setFamilyID(e.target.value)}
              onFocus={(e) => {
                e.target.style.borderColor = withAlpha(ACCENT, 0.55);
                e.target.style.boxShadow = `0 0 0 4px ${withAlpha(ACCENT, 0.14)}`;
                e.target.style.background = "rgba(255,255,255,0.9)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "rgba(139,92,246,0.2)";
                e.target.style.boxShadow = "none";
                e.target.style.background = "rgba(255,255,255,0.66)";
              }}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            style={{
              width: "100%",
              padding: "16px",
              fontFamily: "inherit",
              fontSize: 17,
              fontWeight: 800,
              cursor: "pointer",
              color: "#fff",
              background: `linear-gradient(135deg, ${ACCENT} 0%, ${shade(ACCENT)} 100%)`,
              border: "none",
              borderRadius: 16,
              boxShadow: `0 14px 28px -10px ${withAlpha(ACCENT, 0.7)}`,
              transition: "transform .15s, box-shadow .15s",
              letterSpacing: 0.2,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = `0 20px 34px -10px ${withAlpha(ACCENT, 0.8)}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = `0 14px 28px -10px ${withAlpha(ACCENT, 0.7)}`;
            }}
          >
            Join family ✨
          </button>

          {/* Footer link */}
          <p style={{ textAlign: "center", fontSize: 14, fontWeight: 600, color: "#7b6fa0", margin: 0 }}>
            Don't have a family yet?{" "}
            <Link to="/family/new" style={{ color: ACCENT, fontWeight: 800, textDecoration: "none" }}>
              Create one here
            </Link>
          </p>
        </form>

      </div>
    </div>
  );
};

export default FamilyJoin;
