import { useEffect, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { getLinkedFamily } from "../firebase/firestore/user";
import "../styles/layout.css";

const ACCENT = "#8b5cf6";

function withAlpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const Settings = () => {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  const [familyId, setFamilyId] = useState<string>();
  const [familyName, setFamilyName] = useState<string>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const userId = auth?.user?.uid;
    if (!userId) return;
    getLinkedFamily(userId)
      .then(({ id, name }) => {
        setFamilyId(id);
        setFamilyName(name);
      })
      .catch((err) => console.error("getLinkedFamily failed:", err));
  }, [auth?.user?.uid]);

  const handleCopy = () => {
    if (!familyId) return;
    navigator.clipboard.writeText(familyId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="layout">
      <div className="layout-content">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4 }}>
          <button
            onClick={() => navigate("/")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 20,
              color: "#7b6fa0",
              padding: "4px 2px",
              lineHeight: 1,
            }}
          >
            ←
          </button>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#473a68", margin: 0, letterSpacing: -0.4 }}>
            Settings
          </h1>
        </div>

        {/* Family code card */}
        <div style={{
          background: "rgba(255,255,255,0.42)",
          border: "1px solid rgba(255,255,255,0.65)",
          borderRadius: 22,
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
          marginTop: 20
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32, borderRadius: 10, fontSize: 16,
              background: withAlpha(ACCENT, 0.16),
            }}>
              🔑
            </span>
            <span style={{
              fontSize: 13, fontWeight: 800, letterSpacing: 0.4,
              textTransform: "uppercase", color: withAlpha(ACCENT, 0.7),
            }}>
              Family Code
            </span>
          </div>

          <p style={{ fontSize: 13, fontWeight: 600, color: "#9a8fb8", margin: 0, lineHeight: 1.5, textAlign: 'left' }}>
            Share this code with your partner so they can join <span style={{color: withAlpha(ACCENT, 1)}}>{familyName}</span>.
          </p>

          {/* Code display */}
          <div style={{
            background: "rgba(255,255,255,0.75)",
            border: "1.5px solid rgba(139,92,246,0.18)",
            borderRadius: 14,
            padding: "14px 16px",
            fontFamily: "monospace",
            fontSize: 13,
            fontWeight: 700,
            color: "#4a3d6b",
            letterSpacing: 0.5,
            wordBreak: "break-all",
            minHeight: 48,
          }}>
            {familyId ?? "Loading…"}
          </div>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            disabled={!familyId}
            style={{
              width: "100%",
              padding: "14px",
              fontFamily: "inherit",
              fontSize: 15,
              fontWeight: 800,
              cursor: familyId ? "pointer" : "default",
              color: copied ? "#22c55e" : ACCENT,
              background: copied ? "rgba(34,197,94,0.1)" : withAlpha(ACCENT, 0.1),
              border: `1.5px solid ${copied ? "rgba(34,197,94,0.4)" : withAlpha(ACCENT, 0.4)}`,
              borderRadius: 15,
              transition: "all .2s",
            }}
          >
            {copied ? "Copied! ✓" : "Copy code"}
          </button>
        </div>

      </div>
    </div>
  );
};

export default Settings;
