import { useEffect, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { getBabies, getUserProfile, getLinkedFamilyFull, saveUserProfile } from "../firebase/firestore/user";
import { EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, updatePassword } from "firebase/auth";
import { updateFamilyName, removeFamilyMember, updateBaby, createBabies } from "../firebase/firestore/family";
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
  const [editingFamilyName, setEditingFamilyName] = useState(false);

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
  const [addingBaby, setAddingBaby] = useState(false);
  const [newBaby, setNewBaby] = useState<Baby>({ name: "", dob: "", gender: "girl" });
  const [savingNewBaby, setSavingNewBaby] = useState(false);

  // Family code
  const [familyCode, setFamilyCode] = useState<string>();
  const [copied, setCopied] = useState(false);

  // Profile editing
  const [profileName, setProfileName] = useState("");
  const [editingProfile, setEditingProfile] = useState<"name" | "email" | "password" | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

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

    getUserProfile(currentUid).then(({ name }) => setProfileName(name ?? "")).catch(console.error);

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
      setEditingFamilyName(false);
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

  const handleSaveNewBaby = async () => {
    if (!familyId || savingNewBaby || !newBaby.name.trim()) return;
    setSavingNewBaby(true);
    try {
      const [ref] = await createBabies(familyId, [newBaby]);
      setBabyData((prev) => [...prev, { ...newBaby }]);
      setBabyRefs((prev) => [...prev, ref]);
      setEditBabies((prev) => [...prev, { ...newBaby }]);
      setNewBaby({ name: "", dob: "", gender: "girl" });
      setAddingBaby(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingNewBaby(false);
    }
  };

  const resetProfileForm = () => {
    setEditingProfile(null);
    setProfileError("");
    setProfileSuccess("");
    setCurrentPassword("");
    setNewEmail("");
    setNewPassword("");
    setConfirmNewPassword("");
  };

  const handleSaveProfileName = async () => {
    if (!currentUid || savingProfile || !profileName.trim()) return;
    setSavingProfile(true);
    setProfileError("");
    try {
      await saveUserProfile(currentUid, { name: profileName.trim() });
      setEditingProfile(null);
    } catch {
      setProfileError("Failed to save name.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!auth?.user || savingProfile || !newEmail.trim() || !currentPassword) return;
    setSavingProfile(true);
    setProfileError("");
    try {
      const credential = EmailAuthProvider.credential(auth.user.email!, currentPassword);
      await reauthenticateWithCredential(auth.user, credential);
      await verifyBeforeUpdateEmail(auth.user, newEmail.trim());
      resetProfileForm();
      setProfileSuccess("Verification email sent — check your inbox to confirm the new address.");
    } catch (e: any) {
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") setProfileError("Incorrect current password.");
      else if (e.code === "auth/email-already-in-use") setProfileError("That email is already in use.");
      else if (e.code === "auth/invalid-email") setProfileError("Invalid email address.");
      else setProfileError("Failed to update email.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async () => {
    if (!auth?.user || savingProfile || !newPassword || !currentPassword) return;
    if (newPassword !== confirmNewPassword) { setProfileError("Passwords don't match."); return; }
    if (newPassword.length < 6) { setProfileError("Password must be at least 6 characters."); return; }
    setSavingProfile(true);
    setProfileError("");
    try {
      const credential = EmailAuthProvider.credential(auth.user.email!, currentPassword);
      await reauthenticateWithCredential(auth.user, credential);
      await updatePassword(auth.user, newPassword);
      resetProfileForm();
    } catch (e: any) {
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") setProfileError("Incorrect current password.");
      else setProfileError("Failed to update password.");
    } finally {
      setSavingProfile(false);
    }
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
    <div className="layout" style={{ alignItems: "flex-start" }}>
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
          {editingFamilyName ? (
            <>
              <input
                style={inputStyle}
                value={editFamilyName}
                onChange={(e) => setEditFamilyName(e.target.value)}
                placeholder="e.g. The Riveras"
                autoFocus
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setEditingFamilyName(false)} style={{ flex: 1, padding: "11px", fontFamily: "inherit", fontSize: 14, fontWeight: 800, cursor: "pointer", color: "#7b6fa0", background: "rgba(255,255,255,0.6)", border: "1.5px solid rgba(139,92,246,0.2)", borderRadius: 12 }}>Cancel</button>
                <button onClick={handleSaveFamilyName} disabled={savingFamilyName || !editFamilyName.trim()} style={{ flex: 1, ...primaryBtn(), opacity: savingFamilyName || !editFamilyName.trim() ? 0.55 : 1 }}>{savingFamilyName ? "Saving…" : "Save"}</button>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}>
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9a8fb8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Name</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#4a3d6b" }}>{editFamilyName || "—"}</div>
              </div>
              <button onClick={() => setEditingFamilyName(true)} style={{ flexShrink: 0, background: withAlpha(ACCENT, 0.09), border: "none", borderRadius: 10, padding: "7px 14px", fontSize: 13, fontWeight: 800, color: ACCENT, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
            </div>
          )}
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
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <div style={{ fontSize: 17, fontWeight: 900, color: "#473a68", letterSpacing: -0.3 }}>
                    {baby.name || "Unnamed baby"}
                  </div>
                  {(baby.dob || baby.gender) && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7 }}>
                      {baby.dob && (
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "4px 10px", borderRadius: 999,
                          background: withAlpha(ACCENT, 0.08),
                          border: `1px solid ${withAlpha(ACCENT, 0.16)}`,
                          fontSize: 12, fontWeight: 700, color: "#5f5285",
                        }}>
                          🎂 {new Date(baby.dob + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </div>
                      )}
                      {baby.gender && (
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "4px 10px", borderRadius: 999,
                          background: withAlpha(ACCENT, 0.08),
                          border: `1px solid ${withAlpha(ACCENT, 0.16)}`,
                          fontSize: 12, fontWeight: 700, color: "#5f5285",
                        }}>
                          {baby.gender === "boy" ? "👦" : "👧"} {(baby.gender as string).charAt(0).toUpperCase() + (baby.gender as string).slice(1)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {/* Edit button */}
                <button
                  onClick={() => setEditingBabyIdx(i)}
                  style={{ flexShrink: 0, background: withAlpha(ACCENT, 0.09), border: "none", borderRadius: 10, padding: "7px 14px", fontSize: 13, fontWeight: 800, color: ACCENT, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Add baby */}
        {addingBaby ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <BabyForm
              baby={newBaby}
              index={babyData.length}
              canRemove={false}
              onRemove={() => {}}
              setName={(name) => setNewBaby((p) => ({ ...p, name }))}
              setDOB={(dob) => setNewBaby((p) => ({ ...p, dob }))}
              setGender={(gender) => setNewBaby((p) => ({ ...p, gender }))}
              setPicture={(picture) => setNewBaby((p) => ({ ...p, picture }))}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { setAddingBaby(false); setNewBaby({ name: "", dob: "", gender: "girl" }); }}
                style={{ flex: 1, padding: "13px", fontFamily: "inherit", fontSize: 15, fontWeight: 800, cursor: "pointer", color: "#7b6fa0", background: "rgba(255,255,255,0.6)", border: "1.5px solid rgba(139,92,246,0.2)", borderRadius: 15 }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNewBaby}
                disabled={savingNewBaby || !newBaby.name.trim()}
                style={{ flex: 1, ...primaryBtn(), opacity: savingNewBaby || !newBaby.name.trim() ? 0.55 : 1 }}
              >
                {savingNewBaby ? "Saving…" : "Add baby"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingBaby(true)}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              padding: "18px 20px", cursor: "pointer", fontFamily: "inherit",
              background: withAlpha(ACCENT, 0.06),
              border: `1.5px dashed ${withAlpha(ACCENT, 0.35)}`,
              borderRadius: 22, transition: "all .18s",
            }}
          >
            <span style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: withAlpha(ACCENT, 0.12), fontSize: 18, color: ACCENT,
            }}>+</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: ACCENT }}>Add a baby</span>
          </button>
        )}

        {/* ── ACCOUNT ── */}
        <div style={{ ...sectionLabel, marginTop: 16 }}>Account</div>

        {/* Profile card */}
        <div style={card}>
          {cardIconLabel("👤", "Profile")}

          {/* Name row */}
          {editingProfile === "name" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input value={profileName} onChange={(e) => setProfileName(e.target.value)} style={inputStyle} placeholder="Your name" autoFocus />
              {profileError && <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>{profileError}</span>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={resetProfileForm} style={{ flex: 1, padding: "11px", fontFamily: "inherit", fontSize: 14, fontWeight: 800, cursor: "pointer", color: "#7b6fa0", background: "rgba(255,255,255,0.6)", border: "1.5px solid rgba(139,92,246,0.2)", borderRadius: 12 }}>Cancel</button>
                <button onClick={handleSaveProfileName} disabled={savingProfile || !profileName.trim()} style={{ flex: 1, ...primaryBtn(), opacity: savingProfile || !profileName.trim() ? 0.55 : 1 }}>{savingProfile ? "Saving…" : "Save"}</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}>
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9a8fb8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Name</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#4a3d6b" }}>{profileName || "—"}</div>
              </div>
              <button onClick={() => { setProfileError(""); setEditingProfile("name"); }} style={{ flexShrink: 0, background: withAlpha(ACCENT, 0.09), border: "none", borderRadius: 10, padding: "7px 14px", fontSize: 13, fontWeight: 800, color: ACCENT, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
            </div>
          )}

          <div style={{ height: 1, background: withAlpha(ACCENT, 0.1), margin: "6px 0" }} />

          {/* Email row */}
          {editingProfile === "email" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={inputStyle} placeholder="New email" type="email" autoFocus />
              <input value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={inputStyle} placeholder="Current password" type="password" />
              {profileError && <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>{profileError}</span>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={resetProfileForm} style={{ flex: 1, padding: "11px", fontFamily: "inherit", fontSize: 14, fontWeight: 800, cursor: "pointer", color: "#7b6fa0", background: "rgba(255,255,255,0.6)", border: "1.5px solid rgba(139,92,246,0.2)", borderRadius: 12 }}>Cancel</button>
                <button onClick={handleSaveEmail} disabled={savingProfile || !newEmail.trim() || !currentPassword} style={{ flex: 1, ...primaryBtn(), opacity: savingProfile || !newEmail.trim() || !currentPassword ? 0.55 : 1 }}>{savingProfile ? "Saving…" : "Save"}</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}>
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9a8fb8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Email</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#4a3d6b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{auth?.user?.email || "—"}</div>
                {profileSuccess && <div style={{ fontSize: 12, fontWeight: 600, color: "#22c55e", marginTop: 4 }}>{profileSuccess}</div>}
              </div>
              <button onClick={() => { setNewEmail(auth?.user?.email ?? ""); setProfileError(""); setProfileSuccess(""); setEditingProfile("email"); }} style={{ flexShrink: 0, background: withAlpha(ACCENT, 0.09), border: "none", borderRadius: 10, padding: "7px 14px", fontSize: 13, fontWeight: 800, color: ACCENT, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
            </div>
          )}

          <div style={{ height: 1, background: withAlpha(ACCENT, 0.1), margin: "6px 0" }} />

          {/* Password row */}
          {editingProfile === "password" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={inputStyle} placeholder="New password" type="password" autoFocus />
              <input value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} style={inputStyle} placeholder="Confirm new password" type="password" />
              <input value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={inputStyle} placeholder="Current password" type="password" />
              {profileError && <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>{profileError}</span>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={resetProfileForm} style={{ flex: 1, padding: "11px", fontFamily: "inherit", fontSize: 14, fontWeight: 800, cursor: "pointer", color: "#7b6fa0", background: "rgba(255,255,255,0.6)", border: "1.5px solid rgba(139,92,246,0.2)", borderRadius: 12 }}>Cancel</button>
                <button onClick={handleSavePassword} disabled={savingProfile || !newPassword || !confirmNewPassword || !currentPassword} style={{ flex: 1, ...primaryBtn(), opacity: savingProfile || !newPassword || !confirmNewPassword || !currentPassword ? 0.55 : 1 }}>{savingProfile ? "Saving…" : "Save"}</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left" }}>
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9a8fb8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Password</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#4a3d6b" }}>••••••••</div>
              </div>
              <button onClick={() => { setProfileError(""); setEditingProfile("password"); }} style={{ flexShrink: 0, background: withAlpha(ACCENT, 0.09), border: "none", borderRadius: 10, padding: "7px 14px", fontSize: 13, fontWeight: 800, color: ACCENT, cursor: "pointer", fontFamily: "inherit" }}>Edit</button>
            </div>
          )}
        </div>

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
