import { useRef, useState } from "react";
import { Baby } from "../pages/FamilyCreate";

const ACCENT = "#8b5cf6";

function withAlpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 16px",
  fontSize: 16,
  fontFamily: "inherit",
  fontWeight: 600,
  color: "#4a3d6b",
  background: "rgba(255, 255, 255, 0.75)",
  border: "1.5px solid rgba(139, 92, 246, 0.18)",
  borderRadius: 14,
  outline: "none",
  transition: "border-color .18s, box-shadow .18s, background .18s",
  boxSizing: "border-box",
};

const focusStyle = {
  borderColor: withAlpha(ACCENT, 0.55),
  boxShadow: `0 0 0 4px ${withAlpha(ACCENT, 0.14)}`,
  background: "rgba(255,255,255,0.92)",
};

const blurStyle = {
  borderColor: "rgba(139, 92, 246, 0.18)",
  boxShadow: "none",
  background: "rgba(255, 255, 255, 0.75)",
};

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onloadend = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX = 400;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const BabyForm = ({
  baby,
  index,
  canRemove,
  setName,
  setDOB,
  setGender,
  setPicture,
  onRemove,
}: {
  baby: Baby;
  index: number;
  canRemove: boolean;
  setName: (name: Baby["name"]) => void;
  setDOB: (dob: Baby["dob"]) => void;
  setGender: (gender: Baby["gender"]) => void;
  setPicture: (pic: Baby["picture"]) => void;
  onRemove: () => void;
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");

  return (
    <div
      className="baby-panel"
      style={{
        background: "rgba(255, 255, 255, 0.42)",
        border: "1px solid rgba(255, 255, 255, 0.65)",
        borderRadius: 22,
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: withAlpha(ACCENT, 0.85),
          }}
        >
          Baby {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#a99fc4",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 700,
              padding: "2px 4px",
            }}
          >
            Remove
          </button>
        )}
      </div>

      {/* Name */}
      <input
        style={inputStyle}
        placeholder="Your baby's name"
        value={baby.name}
        onChange={(e) => setName(e.target.value)}
        onFocus={(e) => Object.assign(e.target.style, focusStyle)}
        onBlur={(e) => Object.assign(e.target.style, blurStyle)}
      />

      {/* Date of birth */}
      <input
        type="date"
        style={{ ...inputStyle, color: baby.dob ? "#4a3d6b" : "#9a8fb8" }}
        value={baby.dob}
        onChange={(e) => setDOB(e.target.value)}
        onFocus={(e) => Object.assign(e.target.style, focusStyle)}
        onBlur={(e) => Object.assign(e.target.style, { ...blurStyle, color: e.target.value ? "#4a3d6b" : "#9a8fb8" })}
      />

      {/* Gender pills */}
      <div style={{ display: "flex", gap: 10 }}>
        {(["boy", "girl"] as const).map((val) => {
          const active = baby.gender === val;
          return (
            <button
              key={val}
              type="button"
              onClick={() => setGender(val)}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "11px 12px",
                fontFamily: "inherit",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                borderRadius: 13,
                border: active
                  ? `1.5px solid ${withAlpha(ACCENT, 0.7)}`
                  : "1.5px solid rgba(139,92,246,0.16)",
                color: active ? ACCENT : "#7c6f99",
                background: active ? withAlpha(ACCENT, 0.13) : "rgba(255,255,255,0.55)",
                boxShadow: active ? `0 4px 14px ${withAlpha(ACCENT, 0.18)}` : "none",
                transition: "all .18s",
              }}
            >
              <span style={{ fontSize: 16 }}>{val === "boy" ? "👦" : "👧"}</span>
              {val === "boy" ? "Boy" : "Girl"}
            </button>
          );
        })}
      </div>

      {/* Photo upload */}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setFileName(file.name);
              compressImage(file).then(setPicture).catch(console.error);
            }
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            fontFamily: "inherit",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            color: "#6f6291",
            background: "rgba(255,255,255,0.55)",
            border: "1.5px dashed rgba(139,92,246,0.32)",
            borderRadius: 14,
            transition: "all .18s",
            boxSizing: "border-box",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              borderRadius: 9,
              flexShrink: 0,
              background: withAlpha(ACCENT, 0.16),
              fontSize: 15,
            }}
          >
            📷
          </span>
          <span
            style={{
              color: fileName ? "#4a3d6b" : "#8a7eaa",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {fileName || (baby.picture ? "Change photo" : "Add a photo (optional)")}
          </span>
        </button>
      </div>
    </div>
  );
};

export default BabyForm;
