/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

function colorFor(m: number) {
  // simple vibe similar to crash sites: low=red, mid=purple, high=green-ish
  if (m < 2) return "rgba(255,77,79,0.22)";
  if (m < 10) return "rgba(124,92,255,0.22)";
  return "rgba(46,204,113,0.22)";
}

export default function CrashHistory({ items }: { items: number[] }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <b>History</b>
        <span style={{ color: "var(--muted)", fontSize: 13 }}>Last {items.length}</span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        {items.map((m, idx) => (
          <span
            key={`${m}-${idx}`}
            className="mono"
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: colorFor(m),
              fontWeight: 800,
            }}
            title={`#${idx + 1}`}
          >
            {Number(m).toFixed(2)}x
          </span>
        ))}
      </div>
    </div>
  );
}
