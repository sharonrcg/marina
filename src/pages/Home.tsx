import { useEffect, useContext, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/home.css";
import { getBabies, getUserProfile, getLinkedFamily } from "../firebase/firestore/user";
import { AuthContext } from "../context/AuthContext";
import { DocumentData, DocumentReference, Timestamp, deleteDoc } from "firebase/firestore";
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

function timeStrToTimestamp(str: string, dayOffset = 0): Timestamp {
  const [h, m] = str.split(":").map(Number);
  const now = new Date();
  return Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, h, m));
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
        minHeight: "139px",
      }}
    >
      <div className="activity-row-header">
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
          </div>
        </div>
      </div>

      {/* Desktop-only footer buttons */}
      <div className="activity-card-footer">
        <button
          type="button"
          className="activity-log-btn"
          style={{
            background: `linear-gradient(135deg, ${color}, ${withAlpha(color, 0.82)})`,
            boxShadow: `0 8px 18px -8px ${withAlpha(color, 0.6)}`,
          }}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Log {label.toLowerCase()}
        </button>
        <button
          type="button"
          className="activity-view-btn"
          style={{ color, background: withAlpha(color, 0.12) }}
          onClick={(e) => { e.stopPropagation(); onViewAll(); }}
        >
          View all
        </button>
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
  { key: "breastmilk",  label: "Breastmilk", emoji: "🤱" },
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
  const [feedType, setFeedType] = useState<FeedType>("breastmilk");
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

  const [startH, startM] = startStr.split(":").map(Number);
  const [endH, endM] = endStr.split(":").map(Number);
  const endIsNextDay = endH * 60 + endM < startH * 60 + startM;
  const start = timeStrToTimestamp(startStr);
  const end = timeStrToTimestamp(endStr, endIsNextDay ? 1 : 0);
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
          <div className="sheet-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            End time
            {endIsNextDay && <span style={{ fontSize: 11, fontWeight: 800, color: "#8b5cf6", background: "rgba(139,92,246,0.1)", borderRadius: 6, padding: "1px 6px" }}>next day</span>}
          </div>
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

function HistoryItem({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  return (
    <div className="history-item">
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minWidth: 0 }}>
        {children}
      </div>
      <button
        onClick={onDelete}
        style={{ flexShrink: 0, background: "none", border: "none", padding: "4px 6px", cursor: "pointer", fontSize: 15, color: "#d1c4e9", lineHeight: 1 }}
      >
        ✕
      </button>
    </div>
  );
}

function HistorySheet({ activityKey, items, loading, onClose, onDelete }: {
  activityKey: ActivityKey;
  items: { data: DocumentData; ref: DocumentReference }[];
  loading: boolean;
  onClose: () => void;
  onDelete: (ref: DocumentReference, idx: number) => void;
}) {
  const activity = ACTIVITIES.find((a) => a.key === activityKey)!;

  const renderItem = (item: { data: DocumentData; ref: DocumentReference }, i: number) => {
    const { data } = item;
    if (activityKey === "feed") {
      const ts = data.time as Timestamp;
      const detail = data.type === "solids"
        ? (data.notes || "Solids")
        : `${data.amount ?? ""}${data.unit ?? ""} · ${data.type}`;
      return (
        <HistoryItem key={i} onDelete={() => onDelete(item.ref, i)}>
          <span className="history-time">{fmtDateTime(ts)}</span>
          <span className="history-detail">{detail}</span>
        </HistoryItem>
      );
    }
    if (activityKey === "pump") {
      const ts = data.time as Timestamp;
      const detail = data.amount ? `${data.name} · ${data.amount}${data.unit}` : data.name;
      return (
        <HistoryItem key={i} onDelete={() => onDelete(item.ref, i)}>
          <span className="history-time">{fmtDateTime(ts)}</span>
          <span className="history-detail">{detail}</span>
        </HistoryItem>
      );
    }
    if (activityKey === "sleep") {
      const start = data.start as Timestamp;
      const end = data.end as Timestamp;
      return (
        <HistoryItem key={i} onDelete={() => onDelete(item.ref, i)}>
          <span className="history-time">{fmtDateTime(end)}</span>
          <span className="history-detail">{fmtTime(start)} – {fmtTime(end)} · {fmtDuration(start, end)}</span>
        </HistoryItem>
      );
    }
    if (activityKey === "diaper") {
      const ts = data.time as Timestamp;
      return (
        <HistoryItem key={i} onDelete={() => onDelete(item.ref, i)}>
          <span className="history-time">{fmtDateTime(ts)}</span>
          <span className="history-detail" style={{ textTransform: "capitalize" }}>{data.type}</span>
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

// ─── AllHistorySheet ──────────────────────────────────────────────────────────

type AllHistoryEntry = { activityKey: ActivityKey; data: DocumentData; ref: DocumentReference };

function AllHistorySheet({ babyName, items, loading, onClose, onDelete }: {
  babyName: string; items: AllHistoryEntry[]; loading: boolean; onClose: () => void;
  onDelete: (ref: DocumentReference, idx: number) => void;
}) {
  const renderItem = (entry: AllHistoryEntry, i: number) => {
    const activity = ACTIVITIES.find((a) => a.key === entry.activityKey)!;
    const { data } = entry;
    let detail = "";
    let ts: Timestamp;

    if (entry.activityKey === "feed") {
      ts = data.time as Timestamp;
      detail = data.type === "solids" ? (data.notes || "Solids") : `${data.amount ?? ""}${data.unit ?? ""} · ${data.type}`;
    } else if (entry.activityKey === "pump") {
      ts = data.time as Timestamp;
      detail = data.amount ? `${data.name} · ${data.amount}${data.unit}` : data.name;
    } else if (entry.activityKey === "sleep") {
      ts = data.end as Timestamp;
      detail = `${fmtDuration(data.start as Timestamp, data.end as Timestamp)}`;
    } else {
      ts = data.time as Timestamp;
      detail = (data.type as string).charAt(0).toUpperCase() + (data.type as string).slice(1);
    }

    return (
      <div key={i} className="recent-activity-item">
        <span className="recent-activity-item-icon" style={{ background: withAlpha(activity.color, 0.16) }}>
          {activity.emoji}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#473a68" }}>{activity.label}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#9a8fb8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail}</div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#7b6fa0", flexShrink: 0, textAlign: "right" }}>{fmtDateTime(ts)}</div>
        <button
          onClick={() => onDelete(entry.ref, i)}
          style={{ flexShrink: 0, background: "none", border: "none", padding: "4px 6px", cursor: "pointer", fontSize: 15, color: "#d1c4e9", lineHeight: 1 }}
        >
          ✕
        </button>
      </div>
    );
  };

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="feeding-sheet history-sheet all-history-modal">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="sheet-icon">📋</span>
            <span className="sheet-title">{babyName}'s history</span>
          </div>
          <button className="sheet-close" type="button" onClick={onClose}>✕</button>
        </div>
        <div className="history-list">
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1, 2, 3, 4, 5].map((i) => <Shimmer key={i} width="100%" height={64} radius={14} />)}
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

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  const [feedingOpen,  setFeedingOpen]  = useState(false);
  const [vitaminOpen,  setVitaminOpen]  = useState(false);
  const [sleepOpen,    setSleepOpen]    = useState(false);
  const [diaperOpen,   setDiaperOpen]   = useState(false);
  const [historyKey,   setHistoryKey]   = useState<ActivityKey | null>(null);
  const [historyItems, setHistoryItems] = useState<{ data: DocumentData; ref: DocumentReference }[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [allHistoryOpen,    setAllHistoryOpen]    = useState(false);
  const [allHistoryItems,   setAllHistoryItems]   = useState<AllHistoryEntry[]>([]);
  const [loadingAllHistory, setLoadingAllHistory] = useState(false);

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
    const fetchers: Record<ActivityKey, () => Promise<{ docs: { data: () => DocumentData; ref: DocumentReference }[] }>> = {
      feed:   () => getFeedings(babyRef),
      pump:   () => getVitamins(babyRef),
      sleep:  () => getSleeps(babyRef),
      diaper: () => getDiapers(babyRef),
    };
    fetchers[historyKey]()
      .then((r) => setHistoryItems(r.docs.map((d) => ({ data: d.data(), ref: d.ref }))))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [historyKey, babyRef?.path]);

  // Load all history across all activity types when the full-history modal opens
  useEffect(() => {
    if (!allHistoryOpen || !babyRef) return;
    setLoadingAllHistory(true);
    setAllHistoryItems([]);
    Promise.all([
      getFeedings(babyRef).then((r) => r.docs.map((d): AllHistoryEntry => ({ activityKey: "feed",   data: d.data(), ref: d.ref }))),
      getVitamins(babyRef).then((r) => r.docs.map((d): AllHistoryEntry => ({ activityKey: "pump",   data: d.data(), ref: d.ref }))),
      getSleeps(babyRef).then((r)   => r.docs.map((d): AllHistoryEntry => ({ activityKey: "sleep",  data: d.data(), ref: d.ref }))),
      getDiapers(babyRef).then((r)  => r.docs.map((d): AllHistoryEntry => ({ activityKey: "diaper", data: d.data(), ref: d.ref }))),
    ])
      .then(([feeds, vitamins, sleeps, diapers]) => {
        const all = [...feeds, ...vitamins, ...sleeps, ...diapers];
        all.sort((a, b) => {
          const tsA = (a.activityKey === "sleep" ? (a.data.end as Timestamp) : (a.data.time as Timestamp)).toDate().getTime();
          const tsB = (b.activityKey === "sleep" ? (b.data.end as Timestamp) : (b.data.time as Timestamp)).toDate().getTime();
          return tsB - tsA;
        });
        setAllHistoryItems(all);
      })
      .catch(() => {})
      .finally(() => setLoadingAllHistory(false));
  }, [allHistoryOpen, babyRef?.path]);

  useEffect(() => {
    if (!switcherOpen) return;
    const handler = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [switcherOpen]);

  const updateLastMap = (key: ActivityKey, babyPath: string, newData: DocumentData | null) => {
    if (key === "feed")   setLastFedMap((p)    => ({ ...p, [babyPath]: newData }));
    if (key === "pump")   setLastVitMap((p)    => ({ ...p, [babyPath]: newData }));
    if (key === "sleep")  setLastSleepMap((p)  => ({ ...p, [babyPath]: newData }));
    if (key === "diaper") setLastDiaperMap((p) => ({ ...p, [babyPath]: newData }));
  };

  const handleDeleteHistoryItem = async (ref: DocumentReference, idx: number) => {
    if (!babyRef || !historyKey) return;
    try {
      await deleteDoc(ref);
      const next = historyItems.filter((_, i) => i !== idx);
      setHistoryItems(next);
      // If we deleted the most recent entry, update the activity card
      if (idx === 0) updateLastMap(historyKey, babyRef.path, next[0]?.data ?? null);
    } catch {}
  };

  const handleDeleteAllHistoryItem = async (ref: DocumentReference, idx: number) => {
    if (!babyRef) return;
    try {
      await deleteDoc(ref);
      const deletedKey = allHistoryItems[idx].activityKey;
      const next = allHistoryItems.filter((_, i) => i !== idx);
      setAllHistoryItems(next);
      // If we deleted the most recent entry for this activity type, update the activity card
      const wasLatest = allHistoryItems.findIndex((e) => e.activityKey === deletedKey) === idx;
      if (wasLatest) {
        const nextOfType = next.find((e) => e.activityKey === deletedKey);
        updateLastMap(deletedKey, babyRef.path, nextOfType?.data ?? null);
      }
    } catch {}
  };

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

  // Derive recent entries from the already-loaded "latest" items, sorted newest-first
  const recentEntries: Array<{ activityKey: ActivityKey; ts: Timestamp; detail: string }> = [];
  if (lastFed?.time) {
    const detail = lastFed.type === "solids" ? (lastFed.notes || "Solids") : `${lastFed.amount ?? ""}${lastFed.unit ?? ""} · ${lastFed.type}`;
    recentEntries.push({ activityKey: "feed", ts: lastFed.time as Timestamp, detail });
  }
  if (lastVit?.time) {
    const detail = lastVit.amount ? `${lastVit.name} · ${lastVit.amount}${lastVit.unit}` : lastVit.name;
    recentEntries.push({ activityKey: "pump", ts: lastVit.time as Timestamp, detail });
  }
  if (lastSleep?.end) {
    const detail = `Nap · ${fmtDuration(lastSleep.start as Timestamp, lastSleep.end as Timestamp)}`;
    recentEntries.push({ activityKey: "sleep", ts: lastSleep.end as Timestamp, detail });
  }
  if (lastDiaper?.time) {
    const detail = (lastDiaper.type as string).charAt(0).toUpperCase() + (lastDiaper.type as string).slice(1);
    recentEntries.push({ activityKey: "diaper", ts: lastDiaper.time as Timestamp, detail });
  }
  recentEntries.sort((a, b) => b.ts.toDate().getTime() - a.ts.toDate().getTime());
  const top3 = recentEntries.slice(0, 3);

  const heroChip: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "6px 14px", borderRadius: 999,
    background: "rgba(255,255,255,0.65)",
    border: "1px solid rgba(255,255,255,0.85)",
    backdropFilter: "blur(8px)",
    fontSize: 13, fontWeight: 700, color: "#473a68",
  };

  return (
    <div id="home">
      <div id="home-scroll">

        {/* Top bar */}
        <div className="home-top-bar" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
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

        <div className="home-body">

          {/* Left panel: baby tabs + hero */}
          <div className="home-left-panel">

            {/* Hero */}
            <div className="home-hero">
              <div style={{
                padding: 6, borderRadius: 36,
                background: `linear-gradient(135deg, ${withAlpha(ACCENT, 0.9)}, ${withAlpha("#5a8def", 0.9)})`,
                boxShadow: `0 14px 30px -10px ${withAlpha(ACCENT, 0.6)}`,
              }}>
                {loadingBabies ? (
                  <div style={{ width: 130, height: 130, borderRadius: 30, border: "3px solid rgba(255,255,255,0.9)", overflow: "hidden" }}>
                    <div className="shimmer" style={{ width: "100%", height: "100%" }}><div className="shimmer-wave" /></div>
                  </div>
                ) : baby?.picture ? (
                  <img src={baby.picture} style={{ width: 130, height: 130, borderRadius: 30, border: "3px solid rgba(255,255,255,0.9)", objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ width: 130, height: 130, borderRadius: 30, border: "3px solid rgba(255,255,255,0.9)", background: withAlpha(ACCENT, 0.15), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 62 }}>
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
                    {babies.length > 1 ? (
                      <div style={{ position: "relative", display: "inline-block" }} ref={switcherRef}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                          <div style={{ fontSize: 26, fontWeight: 900, color: "#473a68", letterSpacing: -0.5 }}>{baby.name}</div>
                          <button
                            type="button"
                            onClick={() => setSwitcherOpen((o) => !o)}
                            style={{
                              width: 28, height: 28, borderRadius: "50%", border: "none", cursor: "pointer",
                              background: withAlpha(ACCENT, 0.12),
                              display: "flex", alignItems: "center", justifyContent: "center",
                              flexShrink: 0, transition: "background 0.15s",
                              fontSize: 13, color: ACCENT,
                              transform: switcherOpen ? "rotate(180deg)" : "none",
                            }}
                          >
                            ▾
                          </button>
                        </div>
                        {switcherOpen && (
                          <div style={{
                            position: "absolute", top: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)",
                            background: "#fff", borderRadius: 18, zIndex: 20, minWidth: 220,
                            boxShadow: "0 8px 32px -8px rgba(76,52,120,0.28), 0 2px 8px rgba(76,52,120,0.1)",
                            padding: 8, display: "flex", flexDirection: "column", gap: 4,
                          }}>
                            {babies.map((b, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => { setActiveIndex(i); setSwitcherOpen(false); }}
                                style={{
                                  display: "flex", alignItems: "center", gap: 12,
                                  padding: "10px 12px", borderRadius: 12, border: "none", cursor: "pointer",
                                  fontFamily: "inherit", textAlign: "left", width: "100%",
                                  background: i === activeIndex ? withAlpha(ACCENT, 0.08) : "transparent",
                                }}
                              >
                                <div style={{
                                  width: 44, height: 44, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
                                  background: `linear-gradient(135deg, ${withAlpha(ACCENT, 0.9)}, ${withAlpha("#5a8def", 0.9)})`,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                  {b.picture
                                    ? <img src={b.picture} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    : <span style={{ fontSize: 22 }}>{babyEmoji(b.gender)}</span>
                                  }
                                </div>
                                <div>
                                  <div style={{ fontSize: 15, fontWeight: 800, color: "#473a68" }}>{b.name}</div>
                                  {b.dob && <div style={{ fontSize: 12, fontWeight: 700, color: "#9a8fb8", marginTop: 1 }}>{getAge(b.dob)}</div>}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 26, fontWeight: 900, color: "#473a68", letterSpacing: -0.5 }}>{baby.name}</div>
                    )}
                    {/* Age text — desktop only */}
                    {baby.dob && (
                      <div className="hero-age-text" style={{ marginTop: 4, fontSize: 14, fontWeight: 700, color: "#6f6291" }}>
                        {getAge(baby.dob)}
                      </div>
                    )}

                    {/* Desktop chips: birthday + gender with emojis */}
                    {(baby.dob || baby.gender) && (
                      <div className="hero-chips-desktop" style={{ gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
                        {baby.dob && <div style={heroChip}>🎂 {new Date(baby.dob + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>}
                        {baby.gender && <div style={heroChip}>{baby.gender === "boy" ? "👦" : "👧"} {(baby.gender as string).charAt(0).toUpperCase() + (baby.gender as string).slice(1)}</div>}
                      </div>
                    )}

                    {/* Mobile chips: gender, date, age — no emojis */}
                    {(baby.dob || baby.gender) && (
                      <div className="hero-chips-mobile" style={{ gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 12 }}>
                        {baby.gender && <div style={heroChip}>{(baby.gender as string).charAt(0).toUpperCase() + (baby.gender as string).slice(1)}</div>}
                        {baby.dob && <div style={heroChip}>{new Date(baby.dob + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>}
                        {baby.dob && <div style={heroChip}>{getAge(baby.dob)}</div>}
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>

          </div>

          {/* Right panel: activity grid */}
          <div className="home-right-panel">
            <div className="activity-grid">
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

        </div>

        {/* Recent Activity — desktop only */}
        <div className="home-recent-activity">
          <div className="home-section-header">
            <span className="home-section-title">Recent Activity</span>
            <button className="view-all-history-btn" type="button" onClick={() => setAllHistoryOpen(true)}>
              View all history ›
            </button>
          </div>
          <div className="recent-activity-card">
            {top3.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", fontSize: 13, fontWeight: 700, color: "#9a8fb8" }}>
                Nothing logged yet
              </div>
            ) : top3.map((entry, i) => {
              const activity = ACTIVITIES.find((a) => a.key === entry.activityKey)!;
              return (
                <div key={i} className="recent-activity-item">
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 44, height: 44, borderRadius: 14, fontSize: 22, flexShrink: 0,
                    background: withAlpha(activity.color, 0.16),
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
                  }}>
                    {activity.emoji}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#473a68" }}>{activity.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#9a8fb8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.detail}</div>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: "#7b6fa0", flexShrink: 0 }}>{fmtAgo(entry.ts)}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity — mobile only */}
        <div className="home-recent-activity-mobile">          
          <div className="recent-activity-card">
            <button 
              className="mobile-view-all-history-row" 
              type="button" 
              onClick={() => setAllHistoryOpen(true)}
            >
              View all history ›
            </button>
          </div>
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
          onDelete={handleDeleteHistoryItem}
        />
      )}
      {allHistoryOpen && (
        <AllHistorySheet
          babyName={baby?.name ?? ""}
          items={allHistoryItems}
          loading={loadingAllHistory}
          onClose={() => { setAllHistoryOpen(false); setAllHistoryItems([]); }}
          onDelete={handleDeleteAllHistoryItem}
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
