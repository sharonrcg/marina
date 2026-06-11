import { useEffect, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { getBabies, getUserProfile, getLinkedFamilyFull } from "../firebase/firestore/user";
import { updateFamilyName, removeFamilyMember, updateBaby } from "../firebase/firestore/family";
import { BabyForm } from "../components";
import { Baby } from "./FamilyCreate";
import { DocumentReference } from "firebase/firestore";
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

const Settings = () => {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  const currentUid = auth?.user?.uid;

  // Family
  const [familyId, setFamilyId] = useState<string>();
  const [adminId, setAdminId] = useState<string>();
  const [editFamilyName, setEditFamilyName] = useState("");
  const [savingFamilyName, setSavingFamilyName] = useState(false);
  const [familySaved, setFamilySaved] = useState(false);

  // Members
  const [members, setMembers] = useState<Array<{ uid: string; name?: string }>>([]);
  const [confirmRemoveUid, setConfirmRemoveUid] = useState<string | null>(null);
  const [removingUid, setRemovingUid] = useState<string | null>(null);

  // Babies
  const [babyRefs, setBabyRefs] = useState<DocumentReference[]>([]);
  const [babyData, setBabyData] = useState<Baby[]>([]);
  const [editBabies, setEditBabies] = useState<Baby[]>([]);
  const [editingBabyIdx, setEditingBabyIdx] = useState<number | null>(null);
  const [savingBabyIdx, setSavingBabyIdx] = useState<number | null>(null);

  // Family code
  const [familyCode, setFamilyCode] = useState<string>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!currentUid) return;

    getLinkedFamilyFull(currentUid)
      .then(async ({ id, name, adminId, parents }) => {
        setFamilyId(id);
        setFamilyCode(id);
        setAdminId(adminId);
        setEditFamilyName(name ?? "");
        const profiles = await Promise.all(
          parents.map(async (uid) => {
            try {
              const { name: n } = await getUserProfile(uid);
              return { uid, name: n };
            } catch {
              return { uid, name: undefined };
            }
          })
        );
        setMembers(profiles);
      })
      .catch(console.error);

    getBabies(currentUid)
      .then((docs) => {
        const mapped = docs.map((d) => {
          const b = d.data();
          return { name: b.name ?? "", dob: b.dob ?? "", gender: b.gender ?? "", picture: b.picture ?? "" } as Baby;
        });
        setBabyRefs(docs.map((d) => d.ref));
        setBabyData(mapped);
        setEditBabies(mapped);
      })
      .catch(console.error);
  }, [currentUid]);

  const handleSaveFamilyName = async () => {
    if (!familyId || !editFamilyName.trim() || savingFamilyName) return;
    setSavingFamilyName(true);
    try {
      await updateFamilyName(familyId, editFamilyName.trim());
      setFamilySaved(true);
      setTimeout(() => setFamilySaved(false), 2200);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingFamilyName(false);
    }
  };

  const handleRemoveMember = async (uid: string) => {
    if (!familyId || members.length <= 1) return;
    setRemovingUid(uid);
    try {
      await removeFamilyMember(familyId, uid);
      setMembers((prev) => prev.filter((m) => m.uid !== uid));
      setConfirmRemoveUid(null);
    } catch (e) {
      console.error(e);
    } finally {
      setRemovingUid(null);
    }
  };

  const setEditBaby = (i: number, fields: Partial<Baby>) => {
    setEditBabies((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...fields };
      return next;
    });
  };

  const handleSaveBaby = async (i: number) => {
    const ref = babyRefs[i];
    if (!ref || savingBabyIdx !== null) return;
    setSavingBabyIdx(i);
    try {
      await updateBaby(ref, editBabies[i]);
      setBabyData((prev) => { const next = [...prev]; next[i] = { ...editBabies[i] }; return next; });
      setEditingBabyIdx(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingBabyIdx(null);
    }
  };

  const handleCancelBabyEdit = (i: number) => {
    setEditBabies((prev) => { const next = [...prev]; next[i] = { ...babyData[i] }; return next; });
    setEditingBabyIdx(null);
  };

  const handleCopy = () => {
    if (!familyCode) return;
    navigator.clipboard.writeText(familyCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const isAdmin = !!currentUid && currentUid === adminId;

  // ── Shared styles ──────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: "rgba(255,255,255,0.42)",
    border: "1px solid rgba(255,255,255,0.65)",
    borderRadius: 22,
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 16px",
    fontSize: 16,
    fontFamily: "inherit",
    fontWeight: 600,
    color: "#4a3d6b",
    background: "rgba(255,255,255,0.75)",
    border: "1.5px solid rgba(139,92,246,0.18)",
    borderRadius: 14,
    outline: "none",
    transition: "border-color .18s, box-shadow .18s",
    boxSizing: "border-box",
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 800,
    color: "#514b6a",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    textAlign: "left",
    paddingLeft: 4,
    marginTop: 8,
  };

  const primaryBtn = (green = false): React.CSSProperties => ({
    width: "100%",
    padding: "14px",
    fontFamily: "inherit",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
    color: "#fff",
    background: green
      ? "linear-gradient(135deg, #22c55e, #16a34a)"
      : `linear-gradient(135deg, ${ACCENT} 0%, ${shade(ACCENT)} 100%)`,
    border: "none",
    borderRadius: 15,
    boxShadow: green
      ? "0 10px 22px -8px rgba(34,197,94,0.5)"
      : `0 10px 22px -8px ${withAlpha(ACCENT, 0.65)}`,
    transition: "opacity .15s",
  });

  const ghostBtn = (saved = false): React.CSSProperties => ({
    width: "100%",
    padding: "14px",
    fontFamily: "inherit",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
    color: saved ? "#22c55e" : ACCENT,
    background: saved ? "rgba(34,197,94,0.1)" : withAlpha(ACCENT, 0.1),
    border: `1.5px solid ${saved ? "rgba(34,197,94,0.4)" : withAlpha(ACCENT, 0.35)}`,
    borderRadius: 15,
    transition: "all .18s",
  });

  const cardIconLabel = (emoji: string, text: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 10, fontSize: 16, background: withAlpha(ACCENT, 0.16) }}>
        {emoji}
      </span>
      <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase" as const, color: withAlpha(ACCENT, 0.7) }}>
        {text}
      </span>
    </div>
  );

  return (
    <div className="layout" style={{ alignItems: "flex-start", paddingTop: 40, paddingBottom: 52 }}>
      <div className="layout-content layout-content-wide" style={{ gap: 14 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
          <button
            onClick={() => navigate("/")}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#7b6fa0", padding: "4px 2px", lineHeight: 1 }}
          >
            ←
          </button>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#473a68", margin: 0, letterSpacing: -0.4 }}>
            Settings
          </h1>
        </div>

        {/* ── FAMILY ── */}
        <div style={sectionLabel}>Family</div>

        {/* Family name card */}
        <div style={card}>
          {cardIconLabel("🏡", "Family Name")}
          <input
            style={inputStyle}
            value={editFamilyName}
            onChange={(e) => setEditFamilyName(e.target.value)}
            placeholder="e.g. The Riveras"
            onFocus={(e) => {
              e.target.style.borderColor = withAlpha(ACCENT, 0.55);
              e.target.style.boxShadow = `0 0 0 4px ${withAlpha(ACCENT, 0.14)}`;
              e.target.style.background = "rgba(255,255,255,0.9)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "rgba(139,92,246,0.18)";
              e.target.style.boxShadow = "none";
              e.target.style.background = "rgba(255,255,255,0.75)";
            }}
          />
          <button
            onClick={handleSaveFamilyName}
            disabled={savingFamilyName || !editFamilyName.trim()}
            style={ghostBtn(familySaved)}
          >
            {savingFamilyName ? "Saving…" : familySaved ? "Saved ✓" : "Save name"}
          </button>       
        </div>

        {/* Members card */}
        <div style={card}>
          {cardIconLabel("👥", "Members")}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {members.length === 0 && (
              <div style={{ fontSize: 13, fontWeight: 600, color: "#9a8fb8", padding: "8px 0" }}>Loading…</div>
            )}
            {members.map((member) => {
              const isYou = member.uid === currentUid;
              const isConfirming = confirmRemoveUid === member.uid;
              const initial = (member.name ?? "?")[0].toUpperCase();
              return (
                <div key={member.uid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(255,255,255,0.55)", borderRadius: 14 }}>
                  {/* Avatar */}
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    background: `linear-gradient(135deg, ${withAlpha(ACCENT, 0.32)}, ${withAlpha("#5a8def", 0.32)})`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15, fontWeight: 900, color: "#473a68",
                  }}>
                    {initial}
                  </div>
                  {/* Name */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#473a68", display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {member.name ?? "Family member"}
                      </span>
                      {isYou && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#9a8fb8", background: "rgba(139,92,246,0.1)", borderRadius: 99, padding: "2px 8px", flexShrink: 0 }}>
                          You
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  {isAdmin && !isYou && members.length > 1 && (
                    isConfirming ? (
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => handleRemoveMember(member.uid)}
                          disabled={removingUid === member.uid}
                          style={{ padding: "6px 12px", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, cursor: "pointer", color: "#fff", background: "#ef4444", border: "none", borderRadius: 8 }}
                        >
                          {removingUid === member.uid ? "…" : "Remove"}
                        </button>
                        <button
                          onClick={() => setConfirmRemoveUid(null)}
                          style={{ padding: "6px 12px", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, cursor: "pointer", color: "#7b6fa0", background: "rgba(255,255,255,0.8)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 8 }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRemoveUid(member.uid)}
                        style={{ flexShrink: 0, padding: "6px 12px", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, cursor: "pointer", color: "#9a8fb8", background: "none", border: "1px solid rgba(139,92,246,0.18)", borderRadius: 8 }}
                      >
                        Remove
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── BABIES ── */}
        <div style={{ ...sectionLabel, marginTop: 16 }}>Babies</div>

        {babyData.map((baby, i) => (
          <div key={i}>
            {editingBabyIdx === i ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <BabyForm
                  baby={editBabies[i]}
                  index={i}
                  canRemove={false}
                  onRemove={() => {}}
                  setName={(name) => setEditBaby(i, { name })}
                  setDOB={(dob) => setEditBaby(i, { dob })}
                  setGender={(gender) => setEditBaby(i, { gender })}
                  setPicture={(picture) => setEditBaby(i, { picture })}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handleCancelBabyEdit(i)}
                    style={{ flex: 1, padding: "13px", fontFamily: "inherit", fontSize: 15, fontWeight: 800, cursor: "pointer", color: "#7b6fa0", background: "rgba(255,255,255,0.6)", border: "1.5px solid rgba(139,92,246,0.2)", borderRadius: 15 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveBaby(i)}
                    disabled={savingBabyIdx !== null}
                    style={{ flex: 1, ...primaryBtn(), opacity: savingBabyIdx !== null && savingBabyIdx !== i ? 0.55 : 1 }}
                  >
                    {savingBabyIdx === i ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ ...card, flexDirection: "row", alignItems: "center", gap: 16 }}>
                {/* Picture */}
                <div style={{
                  width: 68, height: 68, borderRadius: 20, flexShrink: 0, overflow: "hidden",
                  background: `linear-gradient(135deg, ${withAlpha(ACCENT, 0.22)}, ${withAlpha("#5a8def", 0.22)})`,
                  border: "1.5px solid rgba(255,255,255,0.7)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30,
                }}>
                  {baby.picture
                    ? <img src={baby.picture} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : "👶"
                  }
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 900, color: "#473a68", letterSpacing: -0.3 }}>
                    {baby.name || "Unnamed baby"}
                  </div>
                  {baby.dob && (
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#7b6fa0", marginTop: 3 }}>
                      Born {new Date(baby.dob + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </div>
                  )}
                </div>
                {/* Edit button */}
                <button
                  onClick={() => setEditingBabyIdx(i)}
                  style={{
                    flexShrink: 0, width: 36, height: 36, borderRadius: 11,
                    border: `1.5px solid ${withAlpha(ACCENT, 0.22)}`,
                    background: withAlpha(ACCENT, 0.08),
                    color: ACCENT, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15, fontFamily: "inherit",
                  }}
                >
                  ✏️
                </button>
              </div>
            )}
          </div>
        ))}

        {/* ── ACCOUNT ── */}
        <div style={{ ...sectionLabel, marginTop: 16 }}>Account</div>

        {/* Family code card */}
        <div style={card}>
          {cardIconLabel("🔑", "Family Code")}
          <p style={{ fontSize: 13, fontWeight: 600, color: "#9a8fb8", margin: 0, lineHeight: 1.5, textAlign: "left" }}>
            Share this code with your partner so they can join your family.
          </p>
          <div style={{
            background: "rgba(255,255,255,0.75)",
            border: "1.5px solid rgba(139,92,246,0.18)",
            borderRadius: 14, padding: "14px 16px",
            fontFamily: "monospace", fontSize: 13, fontWeight: 700,
            color: "#4a3d6b", letterSpacing: 0.5, wordBreak: "break-all", minHeight: 48,
          }}>
            {familyCode ?? "Loading…"}
          </div>
          <button onClick={handleCopy} disabled={!familyCode} style={ghostBtn(copied)}>
            {copied ? "Copied! ✓" : "Copy code"}
          </button>
        </div>

        {/* Sign out */}
        <button
          onClick={() => navigate("/logout")}
          style={{
            width: "100%", padding: "14px", fontFamily: "inherit",
            fontSize: 15, fontWeight: 800, cursor: "pointer",
            color: "#ef4444", background: "rgba(239,68,68,0.07)",
            border: "1.5px solid rgba(239,68,68,0.22)", borderRadius: 15,
            transition: "all .18s", marginTop: 8,
          }}
        >
          Sign out
        </button>

      </div>
    </div>
  );
};

export default Settings;
