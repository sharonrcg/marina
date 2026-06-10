import { useEffect, useContext, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/home.css";
import { getBabies, getUserProfile, getLinkedFamily } from "../firebase/firestore/user";
import { AuthContext } from "../context/AuthContext";
import { DocumentData, DocumentReference, Timestamp } from "firebase/firestore";
import { addFeeding, getLatestFeeding, getFeedings } from "../firebase/firestore/feedings";
import { addVitamin, getLatestVitamin, getVitamins } from "../firebase/firestore/vitamins";
import { addSleep, getLatestSleep, getSleeps } from "../firebase/firestore/sleep";
import { addDiaper, getLatestDiaper, getDiapers } from "../firebase/firestore/diapers";

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

function fmtAgo(ts: Timestamp | undefined | null): string {
  if (!ts) return "—";
  const min = Math.floor((Date.now() - ts.toDate().getTime()) / 60000);
  if (min <= 0) return "Just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}m ago` : `${h}h ago`;
}

function fmtTime(ts: Timestamp): string {
  return ts.toDate().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDateTime(ts: Timestamp): string {
  const d = ts.toDate();
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${MONTHS[d.getMonth()]} ${ordinal(d.getDate())}, ${time}`;
}

function fmtDuration(start: Timestamp, end: Timestamp): string {
  const mins = Math.round((end.toDate().getTime() - start.toDate().getTime()) / 60000);
  if (mins <= 0) return "0m";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function nowTimeStr() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function timeStrToTimestamp(str: string): Timestamp {
  const [h, m] = str.split(":").map(Number);
  const now = new Date();
  return Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m));
}

function babyEmoji(gender?: string): string {
  if (gender === "boy") return "👦";
  if (gender === "girl") return "👧";
  return "👶";
}

const ACTIVITIES = [
  { key: "feed",   label: "Feeding",  statLabel: "Last fed",    emoji: "🍼", color: "#8b5cf6" },
  { key: "pump",   label: "Vitamins", statLabel: "Last given",  emoji: "💊", color: "#5a8def" },
  { key: "sleep",  label: "Sleep",    statLabel: "Last nap",    emoji: "😴", color: "#6366f1" },
  { key: "diaper", label: "Diaper",   statLabel: "Last diaper", emoji: "🧷", color: "#ec6fae" },
] as const;

type ActivityKey = typeof ACTIVITIES[number]["key"];

// ─── Shimmer ──────────────────────────────────────────────────────────────────

function Shimmer({ width, height, radius = 12 }: { width: string | number; height: number; radius?: number }) {
  return (
    <div className="shimmer" style={{ width, height, borderRadius: radius, background: "rgba(255,255,255,0.35)", overflow: "hidden", flexShrink: 0 }}>
      <div className="shimmer-wave" />
    </div>
  );
}

// ─── ActivityRow ──────────────────────────────────────────────────────────────

function ActivityRow({
  emoji, color, label, statLabel, value, sub, pressed, onClick, onViewAll,
}: {
  emoji: string; color: string; label: string; statLabel: string;
  value: string; sub?: string; pressed: boolean;
  onClick: () => void; onViewAll: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={`activity-row${pressed ? " pressed" : ""}`}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      style={{
        boxShadow: pressed
          ? `0 4px 14px -6px ${withAlpha(color, 0.5)}, inset 0 0 0 1.5px ${withAlpha(color, 0.5)}`
          : "inset 0 1px 0 rgba(255,255,255,0.6), 0 8px 22px -14px rgba(76,52,120,0.4)",
      }}
    >
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 46, height: 46, borderRadius: 14, fontSize: 22, flexShrink: 0,
        background: withAlpha(color, 0.16),
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
      }}>
        {emoji}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#473a68" }}>{label}</span>
          <span style={{
            fontSize: 15, fontWeight: 900, letterSpacing: -0.2, flexShrink: 0, marginLeft: 8,
            color: value === "—" ? "#c2b8da" : "#473a68",
          }}>
            {value}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 3 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#9a8fb8" }}>
            {statLabel}{sub ? ` · ${sub}` : ""}
          </span>
          <button
            type="button"
            className="view-all-btn"
            onClick={(e) => { e.stopPropagation(); onViewAll(); }}
          >
            View all ›
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared sheet primitives ──────────────────────────────────────────────────

function SheetWrap({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="feeding-sheet">{children}</div>
    </>
  );
}

function WhenField({
  when, setWhen, timeStr, setTimeStr,
}: {
  when: "now" | "earlier"; setWhen: (v: "now" | "earlier") => void;
  timeStr: string; setTimeStr: (v: string) => void;
}) {
  return (
    <div className="sheet-field">
      <div className="sheet-label">When</div>
      <div className="when-toggle">
        <button type="button" className={`when-btn${when === "now" ? " active" : ""}`} onClick={() => setWhen("now")}>
          Right now
        </button>
        <button type="button" className={`when-btn${when === "earlier" ? " active" : ""}`} onClick={() => setWhen("earlier")}>
          Earlier
        </button>
      </div>
      {when === "earlier" && (
        <input className="sheet-time-input" type="time" value={timeStr} onChange={(e) => setTimeStr(e.target.value)} />
      )}
    </div>
  );
}

// ─── FeedingSheet ─────────────────────────────────────────────────────────────

const FEED_TYPES = [
  { key: "breast",  label: "Breastmilk", emoji: "🤱" },
  { key: "formula", label: "Formula", emoji: "🍼" },
  { key: "solids",  label: "Solids",  emoji: "🥄" },
] as const;
type FeedType = typeof FEED_TYPES[number]["key"];
const QUICK_AMOUNTS_ML = [60, 90, 120, 150];
const QUICK_AMOUNTS_OZ = [2, 3, 4, 5];

function FeedingSheet({ onClose, onSave }: {
  onClose: () => void;
  onSave: (d: { amount?: number; unit?: string; type: string; time: Timestamp; notes?: string }) => void;
}) {
  const [when, setWhen] = useState<"now" | "earlier">("now");
  const [feedType, setFeedType] = useState<FeedType>("breast");
  const [unit, setUnit] = useState<"ml" | "oz">("ml");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [timeStr, setTimeStr] = useState(nowTimeStr);
  const quickAmounts = unit === "ml" ? QUICK_AMOUNTS_ML : QUICK_AMOUNTS_OZ;

  const handleSave = () => {
    const time = when === "now" ? Timestamp.fromDate(new Date()) : timeStrToTimestamp(timeStr);
    if (feedType === "solids") {
      onSave({ type: feedType, time, notes });
    } else {
      onSave({ amount: parseFloat(amount) || 0, unit, type: feedType, time });
    }
    onClose();
  };

  return (
    <SheetWrap onClose={onClose}>
      <div className="sheet-handle" />
      <div className="sheet-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="sheet-icon">🍼</span>
          <span className="sheet-title">Log a feeding</span>
        </div>
        <button className="sheet-close" type="button" onClick={onClose}>✕</button>
      </div>

      <WhenField when={when} setWhen={setWhen} timeStr={timeStr} setTimeStr={setTimeStr} />

      <div className="sheet-field">
        <div className="sheet-label">Type</div>
        <div className="type-options">
          {FEED_TYPES.map((ft) => (
            <button key={ft.key} type="button" className={`type-btn${feedType === ft.key ? " active" : ""}`} onClick={() => setFeedType(ft.key)}>
              {ft.emoji} {ft.label}
            </button>
          ))}
        </div>
      </div>

      {feedType === "solids" ? (
        <div className="sheet-field">
          <div className="sheet-label">What did they eat?</div>
          <input className="sheet-amount-input" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Mashed banana, oatmeal" />
        </div>
      ) : (
        <div className="sheet-field">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div className="sheet-label" style={{ marginBottom: 0 }}>Amount</div>
            <div className="unit-toggle">
              {(["ml", "oz"] as const).map((u) => (
                <button key={u} type="button" className={`unit-btn${unit === u ? " active" : ""}`} onClick={() => { setUnit(u); setAmount(""); }}>{u}</button>
              ))}
            </div>
          </div>
          <input className="sheet-amount-input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Amount in ${unit}`} inputMode="decimal" min="0" />
          <div className="quick-amounts">
            {quickAmounts.map((q) => (
              <button key={q} type="button" className={`quick-btn${amount === String(q) ? " active" : ""}`} onClick={() => setAmount(String(q))}>{q} {unit}</button>
            ))}
          </div>
        </div>
      )}

      <button className="sheet-save-btn" type="button" onClick={handleSave}>Save feeding</button>
    </SheetWrap>
  );
}

// ─── VitaminSheet ─────────────────────────────────────────────────────────────

function VitaminSheet({ onClose, onSave }: {
  onClose: () => void;
  onSave: (d: { name: string; amount?: number; unit?: string; time: Timestamp }) => void;
}) {
  const [when, setWhen] = useState<"now" | "earlier">("now");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<"ml" | "oz">("ml");
  const [amount, setAmount] = useState("");
  const [timeStr, setTimeStr] = useState(nowTimeStr);

  const handleSave = () => {
    const time = when === "now" ? Timestamp.fromDate(new Date()) : timeStrToTimestamp(timeStr);
    onSave({ name, time, ...(amount ? { amount: parseFloat(amount), unit } : {}) });
    onClose();
  };

  return (
    <SheetWrap onClose={onClose}>
      <div className="sheet-handle" />
      <div className="sheet-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="sheet-icon">💊</span>
          <span className="sheet-title">Log vitamins</span>
        </div>
        <button className="sheet-close" type="button" onClick={onClose}>✕</button>
      </div>

      <WhenField when={when} setWhen={setWhen} timeStr={timeStr} setTimeStr={setTimeStr} />

      <div className="sheet-field">
        <div className="sheet-label">Vitamin / supplement</div>
        <input className="sheet-amount-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Vitamin D, Iron" />
      </div>

      <div className="sheet-field">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div className="sheet-label" style={{ marginBottom: 0 }}>Amount <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(optional)</span></div>
          <div className="unit-toggle">
            {(["ml", "oz"] as const).map((u) => (
              <button key={u} type="button" className={`unit-btn${unit === u ? " active" : ""}`} onClick={() => { setUnit(u); setAmount(""); }}>{u}</button>
            ))}
          </div>
        </div>
        <input className="sheet-amount-input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Amount in ${unit} (optional)`} inputMode="decimal" min="0" />
      </div>

      <button className="sheet-save-btn" type="button" onClick={handleSave}>Save vitamins</button>
    </SheetWrap>
  );
}

// ─── SleepSheet ───────────────────────────────────────────────────────────────

function SleepSheet({ onClose, onSave }: {
  onClose: () => void;
  onSave: (d: { start: Timestamp; end: Timestamp }) => void;
}) {
  const [startStr, setStartStr] = useState(() => {
    const d = new Date(Date.now() - 60 * 60 * 1000);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [endStr, setEndStr] = useState(nowTimeStr);

  const start = timeStrToTimestamp(startStr);
  const end = timeStrToTimestamp(endStr);
  const durMs = end.toDate().getTime() - start.toDate().getTime();
  const durationPreview = durMs > 0 ? fmtDuration(start, end) : null;

  const handleSave = () => {
    onSave({ start, end });
    onClose();
  };

  return (
    <SheetWrap onClose={onClose}>
      <div className="sheet-handle" />
      <div className="sheet-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="sheet-icon">😴</span>
          <span className="sheet-title">Log a nap</span>
        </div>
        <button className="sheet-close" type="button" onClick={onClose}>✕</button>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div className="sheet-field" style={{ flex: 1, marginBottom: 0 }}>
          <div className="sheet-label">Start time</div>
          <input className="sheet-time-input" style={{ marginTop: 0 }} type="time" value={startStr} onChange={(e) => setStartStr(e.target.value)} />
        </div>
        <div className="sheet-field" style={{ flex: 1, marginBottom: 0 }}>
          <div className="sheet-label">End time</div>
          <input className="sheet-time-input" style={{ marginTop: 0 }} type="time" value={endStr} onChange={(e) => setEndStr(e.target.value)} />
        </div>
      </div>

      {durationPreview && (
        <div style={{ textAlign: "center", marginTop: 16, marginBottom: 4, fontSize: 13, fontWeight: 800, color: "#6f6291" }}>
          Duration: {durationPreview}
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <button className="sheet-save-btn" type="button" onClick={handleSave}>Save nap</button>
      </div>
    </SheetWrap>
  );
}

// ─── DiaperSheet ──────────────────────────────────────────────────────────────

const DIAPER_TYPES = [
  { key: "wet",   label: "Wet",   emoji: "💧" },
  { key: "dirty", label: "Dirty", emoji: "💩" },
  { key: "both",  label: "Both",  emoji: "🔄" },
] as const;
type DiaperType = typeof DIAPER_TYPES[number]["key"];

function DiaperSheet({ onClose, onSave }: {
  onClose: () => void;
  onSave: (d: { type: string; time: Timestamp }) => void;
}) {
  const [when, setWhen] = useState<"now" | "earlier">("now");
  const [diaperType, setDiaperType] = useState<DiaperType>("wet");
  const [timeStr, setTimeStr] = useState(nowTimeStr);

  const handleSave = () => {
    const time = when === "now" ? Timestamp.fromDate(new Date()) : timeStrToTimestamp(timeStr);
    onSave({ type: diaperType, time });
    onClose();
  };

  return (
    <SheetWrap onClose={onClose}>
      <div className="sheet-handle" />
      <div className="sheet-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="sheet-icon">🧷</span>
          <span className="sheet-title">Log a diaper</span>
        </div>
        <button className="sheet-close" type="button" onClick={onClose}>✕</button>
      </div>

      <WhenField when={when} setWhen={setWhen} timeStr={timeStr} setTimeStr={setTimeStr} />

      <div className="sheet-field">
        <div className="sheet-label">Type</div>
        <div className="type-options">
          {DIAPER_TYPES.map((dt) => (
            <button key={dt.key} type="button" className={`type-btn${diaperType === dt.key ? " active" : ""}`} onClick={() => setDiaperType(dt.key)}>
              {dt.emoji} {dt.label}
            </button>
          ))}
        </div>
      </div>

      <button className="sheet-save-btn" type="button" onClick={handleSave}>Save diaper</button>
    </SheetWrap>
  );
}

// ─── HistorySheet ─────────────────────────────────────────────────────────────

function HistoryItem({ children }: { children: React.ReactNode }) {
  return <div className="history-item">{children}</div>;
}

function HistorySheet({ activityKey, items, loading, onClose }: {
  activityKey: ActivityKey; items: DocumentData[]; loading: boolean; onClose: () => void;
}) {
  const activity = ACTIVITIES.find((a) => a.key === activityKey)!;

  const renderItem = (item: DocumentData, i: number) => {
    if (activityKey === "feed") {
      const ts = item.time as Timestamp;
      const detail = item.type === "solids"
        ? (item.notes || "Solids")
        : `${item.amount ?? ""}${item.unit ?? ""} · ${item.type}`;
      return (
        <HistoryItem key={i}>
          <span className="history-time">{fmtDateTime(ts)}</span>
          <span className="history-detail">{detail}</span>
        </HistoryItem>
      );
    }
    if (activityKey === "pump") {
      const ts = item.time as Timestamp;
      const detail = item.amount ? `${item.name} · ${item.amount}${item.unit}` : item.name;
      return (
        <HistoryItem key={i}>
          <span className="history-time">{fmtDateTime(ts)}</span>
          <span className="history-detail">{detail}</span>
        </HistoryItem>
      );
    }
    if (activityKey === "sleep") {
      const start = item.start as Timestamp;
      const end = item.end as Timestamp;
      return (
        <HistoryItem key={i}>
          <span className="history-time">{fmtDateTime(end)}</span>
          <span className="history-detail">{fmtTime(start)} – {fmtTime(end)} · {fmtDuration(start, end)}</span>
        </HistoryItem>
      );
    }
    if (activityKey === "diaper") {
      const ts = item.time as Timestamp;
      return (
        <HistoryItem key={i}>
          <span className="history-time">{fmtDateTime(ts)}</span>
          <span className="history-detail" style={{ textTransform: "capitalize" }}>{item.type}</span>
        </HistoryItem>
      );
    }
    return null;
  };

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="feeding-sheet history-sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="sheet-icon">{activity.emoji}</span>
            <span className="sheet-title">{activity.label} history</span>
          </div>
          <button className="sheet-close" type="button" onClick={onClose}>✕</button>
        </div>
        <div className="history-list">
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3].map((i) => <Shimmer key={i} width="100%" height={56} radius={14} />)}
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", fontSize: 14, fontWeight: 700, color: "#9a8fb8" }}>
              Nothing logged yet
            </div>
          ) : (
            items.map(renderItem)
          )}
        </div>
      </div>
    </>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────

type ActivityMap = Record<string, DocumentData | null>;

const Home = () => {
  const [babies, setBabies] = useState<DocumentData[]>([]);
  const [babyRefs, setBabyRefs] = useState<DocumentReference[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadingBabies, setLoadingBabies] = useState(true);

  const [lastFedMap,    setLastFedMap]    = useState<ActivityMap>({});
  const [lastVitMap,    setLastVitMap]    = useState<ActivityMap>({});
  const [lastSleepMap,  setLastSleepMap]  = useState<ActivityMap>({});
  const [lastDiaperMap, setLastDiaperMap] = useState<ActivityMap>({});

  const [userName, setUserName] = useState<string>();
  const [familyName, setFamilyName] = useState<string>();
  const [toast, setToast] = useState<{ label: string; emoji: string } | null>(null);

  const [feedingOpen,  setFeedingOpen]  = useState(false);
  const [vitaminOpen,  setVitaminOpen]  = useState(false);
  const [sleepOpen,    setSleepOpen]    = useState(false);
  const [diaperOpen,   setDiaperOpen]   = useState(false);
  const [historyKey,   setHistoryKey]   = useState<ActivityKey | null>(null);
  const [historyItems, setHistoryItems] = useState<DocumentData[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const auth = useContext(AuthContext);
  const navigate = useNavigate();

  const baby    = babies[activeIndex];
  const babyRef = babyRefs[activeIndex];
  const lastFed    = babyRef ? lastFedMap[babyRef.path]    : undefined;
  const lastVit    = babyRef ? lastVitMap[babyRef.path]    : undefined;
  const lastSleep  = babyRef ? lastSleepMap[babyRef.path]  : undefined;
  const lastDiaper = babyRef ? lastDiaperMap[babyRef.path] : undefined;

  // Load babies + profile
  useEffect(() => {
    const userId = auth?.user?.uid;
    if (!userId) return;
    setLoadingBabies(true);
    getBabies(userId)
      .then((docs) => { setBabies(docs.map((d) => d.data())); setBabyRefs(docs.map((d) => d.ref)); })
      .catch((err) => console.error("getBabies failed:", err))
      .finally(() => setLoadingBabies(false));
    getUserProfile(userId).then(({ name }) => { if (name) setUserName(name); }).catch(() => {});
    getLinkedFamily(userId).then(({ name }) => { if (name) setFamilyName(name); }).catch(() => {});
  }, [auth?.user?.uid]);

  // Load latest activity for active baby
  useEffect(() => {
    if (!babyRef) return;
    const key = babyRef.path;

    if (lastFedMap[key] === undefined) {
      getLatestFeeding(babyRef).then((r) => {
        setLastFedMap((p) => ({ ...p, [key]: r.docs[0]?.data() ?? null }));
      });
    }
    if (lastVitMap[key] === undefined) {
      getLatestVitamin(babyRef).then((r) => {
        setLastVitMap((p) => ({ ...p, [key]: r.docs[0]?.data() ?? null }));
      });
    }
    if (lastSleepMap[key] === undefined) {
      getLatestSleep(babyRef).then((r) => {
        setLastSleepMap((p) => ({ ...p, [key]: r.docs[0]?.data() ?? null }));
      });
    }
    if (lastDiaperMap[key] === undefined) {
      getLatestDiaper(babyRef).then((r) => {
        setLastDiaperMap((p) => ({ ...p, [key]: r.docs[0]?.data() ?? null }));
      });
    }
  }, [babyRef?.path]);

  // Load history when view-all opens
  useEffect(() => {
    if (!historyKey || !babyRef) return;
    setLoadingHistory(true);
    setHistoryItems([]);
    const fetchers: Record<ActivityKey, () => Promise<{ docs: { data: () => DocumentData }[] }>> = {
      feed:   () => getFeedings(babyRef),
      pump:   () => getVitamins(babyRef),
      sleep:  () => getSleeps(babyRef),
      diaper: () => getDiapers(babyRef),
    };
    fetchers[historyKey]()
      .then((r) => setHistoryItems(r.docs.map((d) => d.data())))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [historyKey, babyRef?.path]);

  const showToast = (label: string, emoji: string) => {
    setToast({ label, emoji });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1900);
  };

  const handleAction = (a: typeof ACTIVITIES[number]) => {
    if (a.key === "feed")   { setFeedingOpen(true); return; }
    if (a.key === "pump")   { setVitaminOpen(true); return; }
    if (a.key === "sleep")  { setSleepOpen(true);   return; }
    if (a.key === "diaper") { setDiaperOpen(true);  return; }
  };

  const handleFeedSave = (data: { amount?: number; unit?: string; type: string; time: Timestamp; notes?: string }) => {
    if (!babyRef) return;
    addFeeding(babyRef, data);
    setLastFedMap((p) => ({ ...p, [babyRef.path]: data }));
    showToast("Feeding", "🍼");
  };

  const handleVitSave = (data: { name: string; amount?: number; unit?: string; time: Timestamp }) => {
    if (!babyRef) return;
    addVitamin(babyRef, data);
    setLastVitMap((p) => ({ ...p, [babyRef.path]: data }));
    showToast("Vitamins", "💊");
  };

  const handleSleepSave = (data: { start: Timestamp; end: Timestamp }) => {
    if (!babyRef) return;
    addSleep(babyRef, data);
    setLastSleepMap((p) => ({ ...p, [babyRef.path]: data }));
    showToast("Sleep", "😴");
  };

  const handleDiaperSave = (data: { type: string; time: Timestamp }) => {
    if (!babyRef) return;
    addDiaper(babyRef, data);
    setLastDiaperMap((p) => ({ ...p, [babyRef.path]: data }));
    showToast("Diaper", "🧷");
  };

  const feedSub = lastFed
    ? lastFed.type === "solids"
      ? (lastFed.notes || "Solids")
      : `${lastFed.amount ?? ""}${lastFed.unit ?? ""} · ${lastFed.type}`
    : undefined;

  const vitSub = lastVit
    ? lastVit.amount ? `${lastVit.name} · ${lastVit.amount}${lastVit.unit}` : lastVit.name
    : undefined;

  const sleepSub = lastSleep
    ? fmtDuration(lastSleep.start as Timestamp, lastSleep.end as Timestamp)
    : undefined;

  const diaperSub = lastDiaper
    ? (lastDiaper.type as string).charAt(0).toUpperCase() + (lastDiaper.type as string).slice(1)
    : undefined;

  const rows = [
    { ...ACTIVITIES[0], value: fmtAgo(lastFed?.time as Timestamp | undefined),    sub: feedSub },
    { ...ACTIVITIES[1], value: fmtAgo(lastVit?.time as Timestamp | undefined),    sub: vitSub },
    { ...ACTIVITIES[2], value: fmtAgo(lastSleep?.end as Timestamp | undefined),   sub: sleepSub },
    { ...ACTIVITIES[3], value: fmtAgo(lastDiaper?.time as Timestamp | undefined), sub: diaperSub },
  ];

  return (
    <div id="home">
      <div id="home-scroll">

        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#473a68", letterSpacing: -0.3, lineHeight: 1.2, textAlign: "left" }}>
              Hello, {userName || "there"}
            </div>
            {familyName && (
              <div style={{ fontSize: 13, fontWeight: 700, color: "#7b6fa0", textAlign: "left" }}>{familyName}</div>
            )}
          </div>
          <button className="hamburger-btn" onClick={() => navigate("/settings")}>
            <span /><span /><span />
          </button>
        </div>

        {/* Baby tabs */}
        {!loadingBabies && (
          <div className="baby-tabs">
            {babies.map((b, i) => (
              <button key={i} className={`baby-tab${i === activeIndex ? " active" : ""}`} onClick={() => setActiveIndex(i)}>
                {b.name}
              </button>
            ))}
            <button className="baby-tab baby-tab-add" type="button" onClick={() => {}}>+</button>
          </div>
        )}

        {/* Hero */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 26 }}>
          <div style={{
            padding: 5, borderRadius: "50%",
            background: `linear-gradient(135deg, ${withAlpha(ACCENT, 0.9)}, ${withAlpha("#5a8def", 0.9)})`,
            boxShadow: `0 14px 30px -10px ${withAlpha(ACCENT, 0.6)}`,
          }}>
            {loadingBabies ? (
              <div style={{ width: 104, height: 104, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.9)", overflow: "hidden" }}>
                <div className="shimmer" style={{ width: "100%", height: "100%" }}><div className="shimmer-wave" /></div>
              </div>
            ) : baby?.picture ? (
              <img src={baby.picture} style={{ width: 104, height: 104, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.9)", objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{ width: 104, height: 104, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.9)", background: withAlpha(ACCENT, 0.15), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52 }}>
                {babyEmoji(baby?.gender)}
              </div>
            )}
          </div>

          <div style={{ textAlign: "center", minHeight: 52 }}>
            {loadingBabies ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, paddingTop: 4 }}>
                <Shimmer width={120} height={26} radius={8} />
                <Shimmer width={80} height={16} radius={6} />
              </div>
            ) : baby ? (
              <>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#473a68", letterSpacing: -0.5 }}>{baby.name}</div>
                {baby.dob && <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: "#6f6291" }}>{getAge(baby.dob)}</div>}
              </>
            ) : null}
          </div>
        </div>

        {/* Activity rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r) => (
            <ActivityRow
              key={r.key}
              emoji={r.emoji} color={r.color} label={r.label} statLabel={r.statLabel}
              value={r.value} sub={r.sub}
              pressed={false}
              onClick={() => handleAction(r)}
              onViewAll={() => setHistoryKey(r.key)}
            />
          ))}
        </div>

      </div>

      {feedingOpen  && <FeedingSheet onClose={() => setFeedingOpen(false)}  onSave={handleFeedSave} />}
      {vitaminOpen  && <VitaminSheet onClose={() => setVitaminOpen(false)}  onSave={handleVitSave} />}
      {sleepOpen    && <SleepSheet   onClose={() => setSleepOpen(false)}    onSave={handleSleepSave} />}
      {diaperOpen   && <DiaperSheet  onClose={() => setDiaperOpen(false)}   onSave={handleDiaperSave} />}
      {historyKey   && (
        <HistorySheet
          activityKey={historyKey}
          items={historyItems}
          loading={loadingHistory}
          onClose={() => { setHistoryKey(null); setHistoryItems([]); }}
        />
      )}

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
