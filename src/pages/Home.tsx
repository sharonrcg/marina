import { useEffect, useContext, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/home.css";
import { getBabies, getUserProfile, getLinkedFamily } from "../firebase/firestore/user";
import { AuthContext } from "../context/AuthContext";
import {
  DocumentData,
  DocumentReference,
  Timestamp,
} from "firebase/firestore";
import { addFeeding, getLatestFeeding } from "../firebase/firestore/feedings";

const ACCENT = "#8b5cf6";

function withAlpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}


function getAge(dob: string): string {
  if (!dob) return "";
  const birth = new Date(dob + "T00:00:00");
  const now = new Date();
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  let days = now.getDate() - birth.getDate();
  if (days < 0) {
    months--;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) return `${Math.max(0, days)} days old`;
  if (months === 0) return `${days} day${days !== 1 ? "s" : ""} old`;
  if (months < 12)
    return `${months} month${months !== 1 ? "s" : ""}${days > 0 ? `, ${days} day${days !== 1 ? "s" : ""}` : ""}`;
  const yrs = Math.floor(months / 12);
  const mo = months % 12;
  return `${yrs} year${yrs !== 1 ? "s" : ""}${mo > 0 ? `, ${mo} month${mo !== 1 ? "s" : ""}` : ""}`;
}

function fmtAgo(ts: Timestamp | undefined): string {
  if (!ts) return "—";
  const min = Math.floor((Date.now() - ts.toDate().getTime()) / 60000);
  if (min <= 0) return "Just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60),
    m = min % 60;
  return m ? `${h}h ${m}m ago` : `${h}h ago`;
}

const ACTIONS = [
  { key: "feed",   label: "Feeding", emoji: "🍼", color: "#8b5cf6" },
  { key: "pump",   label: "Pumping", emoji: "🥛", color: "#5a8def" },
  { key: "sleep",  label: "Sleep",   emoji: "😴", color: "#6366f1" },
  { key: "diaper", label: "Diaper",  emoji: "🧷", color: "#ec6fae" },
] as const;

type ActionKey = typeof ACTIONS[number]["key"];

function StatCard({
  label, emoji, color, value, sub,
}: {
  label: string; emoji: string; color: string; value: string; sub?: string;
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.5)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      border: "1px solid rgba(255,255,255,0.7)",
      borderRadius: 22,
      padding: "14px 15px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      boxShadow:
        "inset 0 1px 0 rgba(255,255,255,0.55), 0 8px 22px -16px rgba(76,52,120,0.4)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 28, height: 28, borderRadius: 9, fontSize: 15, flexShrink: 0,
          background: withAlpha(color, 0.16),
        }}>
          {emoji}
        </span>
        <span style={{
          fontSize: 12.5, fontWeight: 800, letterSpacing: 0.2,
          color: "#6f6291", textTransform: "uppercase",
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontSize: 18, fontWeight: 900, letterSpacing: -0.3,
        color: value === "—" ? "#b0a8c8" : "#473a68",
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#9a8fb8" }}>{sub}</div>
      )}
    </div>
  );
}

const Home = () => {
  const [baby, setBaby] = useState<DocumentData>();
  const [babyRef, setBabyRef] = useState<DocumentReference>();
  const [lastFed, setLastFed] = useState<DocumentData>();
  const [userName, setUserName] = useState<string>();
  const [familyName, setFamilyName] = useState<string>();
  const [toast, setToast] = useState<{ label: string; emoji: string } | null>(null);
  const [pressed, setPressed] = useState<ActionKey | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const auth = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    const userId = auth?.user?.uid;
    if (!userId) return;
    getBabies(userId)
      .then((docs) => {
        const snap = docs[0];
        if (snap) {
          setBaby(snap.data());
          setBabyRef(snap.ref);
        }
      })
      .catch((err) => console.error("getBabies failed:", err));
    getUserProfile(userId)
      .then(({ name }) => { if (name) setUserName(name); })
      .catch(() => {});
    getLinkedFamily(userId)
      .then(({ name }) => { if (name) setFamilyName(name); })
      .catch(() => {});
  }, [auth?.user?.uid]);

  useEffect(() => {
    if (!babyRef) return;
    getLatestFeeding(babyRef).then((res) => {
      const data = res.docs[0]?.data();
      if (data) setLastFed(data);
    });
  }, [babyRef]);

  const handleAction = (a: typeof ACTIONS[number]) => {
    if (a.key === "feed" && babyRef) {
      const now = Timestamp.fromDate(new Date());
      addFeeding(babyRef, { amount: 3.5, unit: "oz", type: "expressed", time: now });
      setLastFed({ amount: 3.5, unit: "oz", type: "expressed", time: now });
    }
    setPressed(a.key);
    setTimeout(() => setPressed(null), 260);
    setToast({ label: a.label, emoji: a.emoji });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1900);
  };

  const stats = [
    {
      key: "feed", label: "Last fed", emoji: "🍼", color: "#8b5cf6",
      value: fmtAgo(lastFed?.time as Timestamp | undefined),
      sub: lastFed ? `${lastFed.amount}${lastFed.unit} · ${lastFed.type}` : undefined,
    },
    { key: "pump",   label: "Last pumped", emoji: "🥛", color: "#5a8def", value: "—" },
    { key: "sleep",  label: "Last nap",    emoji: "😴", color: "#6366f1", value: "—" },
    { key: "diaper", label: "Last diaper", emoji: "🧷", color: "#ec6fae", value: "—" },
  ];

  return (
    <div id="home">
      <div id="home-scroll">

        {/* Top bar */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between", marginBottom: 18,
        }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#473a68", letterSpacing: -0.3, lineHeight: 1.2 }}>
              Hello, {userName || "there"}
            </div>
            {familyName && (
              <div style={{ fontSize: 13, fontWeight: 700, color: "#7b6fa0", marginTop: 2 }}>
                {familyName}
              </div>
            )}
          </div>
          <button className="home-icon-btn" onClick={() => navigate("/settings")}>⚙️</button>
        </div>

        {/* Hero — baby photo + name + age */}
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 10, marginBottom: 26,
        }}>
          <div style={{
            padding: 5, borderRadius: "50%",
            background: `linear-gradient(135deg, ${withAlpha(ACCENT, 0.9)}, ${withAlpha("#5a8def", 0.9)})`,
            boxShadow: `0 14px 30px -10px ${withAlpha(ACCENT, 0.6)}`,
          }}>
            {baby?.picture ? (
              <img
                src={baby.picture}
                style={{
                  width: 104, height: 104, borderRadius: "50%",
                  border: "3px solid rgba(255,255,255,0.9)",
                  objectFit: "cover", display: "block",
                }}
              />
            ) : (
              <div style={{
                width: 104, height: 104, borderRadius: "50%",
                border: "3px solid rgba(255,255,255,0.9)",
                background: withAlpha(ACCENT, 0.15),
                display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 42,
              }}>
                👶
              </div>
            )}
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontSize: 26, fontWeight: 900,
              color: "#473a68", letterSpacing: -0.5,
            }}>
              {baby?.name ?? "Marina"}
            </div>
            {baby?.dob && (
              <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: "#6f6291" }}>
                {getAge(baby.dob)}
              </div>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 12, marginBottom: 28,
        }}>
          {stats.map((s) => (
            <StatCard
              key={s.key} label={s.label} emoji={s.emoji}
              color={s.color} value={s.value} sub={s.sub}
            />
          ))}
        </div>

        {/* Log section header */}
        <div style={{ marginBottom: 12, paddingLeft: 4 }}>
          <div style={{
            fontSize: 13, fontWeight: 800, color: "#5f5285",
            letterSpacing: 0.4, textTransform: "uppercase",
          }}>
            Log an activity
          </div>
        </div>

        {/* Action grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {ACTIONS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => handleAction(a)}
              className={`home-action-btn${pressed === a.key ? " pressed" : ""}`}
              style={{
                boxShadow:
                  pressed === a.key
                    ? `0 4px 14px -6px ${withAlpha(a.color, 0.5)}, inset 0 0 0 1.5px ${withAlpha(a.color, 0.6)}`
                    : "inset 0 1px 0 rgba(255,255,255,0.6), 0 10px 24px -16px rgba(76,52,120,0.45)",
              }}
            >
              <span style={{
                display: "inline-flex", alignItems: "center",
                justifyContent: "center",
                width: 48, height: 48, borderRadius: 15, fontSize: 24,
                background: withAlpha(a.color, 0.16),
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
              }}>
                {a.emoji}
              </span>
              <span style={{ fontSize: 16.5, fontWeight: 800, color: "#473a68" }}>
                {a.label}
              </span>
            </button>
          ))}
        </div>

        <p style={{
          textAlign: "center", fontSize: 12.5, fontWeight: 700,
          color: "#8a7eaa", marginTop: 22,
        }}>
          Tap any card to log it now
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="home-toast">
          <span style={{ fontSize: 16 }}>{toast.emoji}</span>
          {toast.label} logged
          <span style={{ color: "#8fe3b0" }}>✓</span>
        </div>
      )}
    </div>
  );
};

export default Home;
