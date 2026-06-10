"use client";

import { createFamily } from "../firebase/firestore/family";
import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/layout.css";
import "../styles/family-create.css";
import { BabyForm } from "../components";
import { linkUserFamily } from "../firebase/firestore/user";
import { AuthContext } from "../context/AuthContext";

export type Baby = {
  name: string;
  dob: string;
  gender?: "boy" | "girl" | string;
  picture?: string;
};

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

const Family = () => {
  const [familyName, setFamilyName] = useState("");
  const [babies, setBabies] = useState<Baby[]>([{ name: "", dob: "", gender: "girl" }]);
  const auth = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const userId = auth?.user?.uid;
    const email = auth?.user?.email;
    if (!userId || !email) throw "not logged in";

    const familyRef = await createFamily(familyName, babies, userId, email);
    await linkUserFamily(userId, familyRef);
    navigate("/");
  };

  const handleAddAnotherBaby = () => {
    setBabies([...babies, { name: "", dob: "" }]);
  };

  const removeBaby = (i: number) => {
    setBabies(babies.filter((_, idx) => idx !== i));
  };

  const familyInputStyle: React.CSSProperties = {
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

  const submitButtonStyle: React.CSSProperties = {
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
            👶
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
            Create a Family
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
            Tell us a little about your family. You'll be able to share your account with your partner.
          </p>
        </div>

        {/* Form — submit button is outside so it can be pinned on mobile */}
        <form id="family-form" className="family-create-form" onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 22 }}
        >
          {/* Family name */}
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
              Family name
            </label>
            <input
              className="family-name-input"
              style={familyInputStyle}
              placeholder="e.g. The Riveras"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
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

          {/* Baby cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {babies.map((baby, i) => (
              <BabyForm
                key={i}
                baby={baby}
                index={i}
                canRemove={babies.length > 1}
                onRemove={() => removeBaby(i)}
                setName={(name) =>
                  setBabies((prev) => {
                    const next = [...prev];
                    next[i].name = name;
                    return next;
                  })
                }
                setDOB={(dob) =>
                  setBabies((prev) => {
                    const next = [...prev];
                    next[i].dob = dob;
                    return next;
                  })
                }
                setGender={(gender) =>
                  setBabies((prev) => {
                    const next = [...prev];
                    next[i].gender = gender;
                    return next;
                  })
                }
                setPicture={(picture) => {
                  setBabies((prev) => {
                    const next = [...prev];
                    next[i].picture = picture;
                    return next;
                  });
                }}
              />
            ))}
          </div>

          {/* Add another baby */}
          <button
            type="button"
            onClick={handleAddAnotherBaby}
            style={{
              width: "100%",
              padding: "13px",
              fontFamily: "inherit",
              fontSize: 15,
              fontWeight: 800,
              cursor: "pointer",
              color: ACCENT,
              background: withAlpha(ACCENT, 0.1),
              border: `1.5px dashed ${withAlpha(ACCENT, 0.4)}`,
              borderRadius: 15,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "all .18s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = withAlpha(ACCENT, 0.17))}
            onMouseLeave={(e) => (e.currentTarget.style.background = withAlpha(ACCENT, 0.1))}
          >
            <span style={{ fontSize: 18, lineHeight: "1", marginTop: -2 }}>+</span>
            Add another baby
          </button>

          <button
            type="submit"
            style={submitButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = `0 20px 34px -10px ${withAlpha(ACCENT, 0.8)}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = `0 14px 28px -10px ${withAlpha(ACCENT, 0.7)}`;
            }}
          >
            Let's go! ✨
          </button>

          {/* Footer link */}
          <p style={{ textAlign: "center", fontSize: 14, fontWeight: 600, color: "#7b6fa0", margin: 0 }}>
            Trying to join an existing family?{" "}
            <Link to="/family/join" style={{ color: ACCENT, fontWeight: 800, textDecoration: "none" }}>
              Join one here
            </Link>
          </p>
        </form>

      </div>

    </div>
  );
};

export default Family;
