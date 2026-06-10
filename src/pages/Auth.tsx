import { useState } from "react";
import logIn from "../firebase/auth/login";
import signUp from "../firebase/auth/signup";
import { saveUserProfile } from "../firebase/firestore/user";
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

function AuthInput({
  type,
  placeholder,
  value,
  onChange,
}: {
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      className="family-name-input"
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={type === "password" ? "current-password" : type === "email" ? "email" : "name"}
      style={inputStyle}
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
  );
}

const Auth = ({ isLoggingIn }: { isLoggingIn?: boolean }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    try {
      if (isLoggingIn) {
        const { error } = await logIn(email, password);
        if (error) throw error;
        navigate("/");
      } else {
        const { result, error } = await signUp(email, password);
        if (error) throw error;
        if (name.trim() && result?.user?.uid) {
          await saveUserProfile(result.user.uid, { name: name.trim() });
        }
        navigate("/family/new");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 800,
    color: "#6f6291",
    letterSpacing: 0.3,
    paddingLeft: 4,
    textAlign: "left",
  };

  return (
    <div className="layout">
      <div className="layout-content">

        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h1 style={{
            fontSize: 32,
            fontWeight: 900,
            color: "#473a68",
            letterSpacing: -0.5,
            lineHeight: 1.1,
            margin: 0,
          }}>
            {isLoggingIn ? "Welcome back" : "Create account"}
          </h1>
          <p style={{
            fontSize: 15.5,
            fontWeight: 600,
            color: "#7b6fa0",
            lineHeight: 1.5,
            margin: 0,
          }}>
            {isLoggingIn
              ? "Sign in to continue tracking."
              : "Fill in your details to get started."}
          </p>
        </div>

        {/* Form */}
        <form
          className="family-create-form"
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 22 }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {!isLoggingIn && (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <label style={labelStyle}>Name</label>
                <AuthInput
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={setName}
                />
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <label style={labelStyle}>Email</label>
              <AuthInput
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={setEmail}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <label style={labelStyle}>Password</label>
              <AuthInput
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={setPassword}
              />
            </div>

          </div>

          {error && (
            <p style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: "#c0416a",
              background: "rgba(192,65,106,0.08)",
              border: "1px solid rgba(192,65,106,0.2)",
              borderRadius: 12,
              padding: "10px 14px",
              margin: 0,
            }}>
              {error}
            </p>
          )}

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
            {isLoggingIn ? "Log in" : "Sign up"}
          </button>

          <p style={{ textAlign: "center", fontSize: 14, fontWeight: 600, color: "#7b6fa0", margin: 0 }}>
            {isLoggingIn ? "Don't have an account? " : "Already have an account? "}
            <Link
              to={isLoggingIn ? "/signup" : "/login"}
              style={{ color: ACCENT, fontWeight: 800, textDecoration: "none" }}
            >
              {isLoggingIn ? "Sign up" : "Log in"}
            </Link>
          </p>
        </form>

      </div>
    </div>
  );
};

export default Auth;
