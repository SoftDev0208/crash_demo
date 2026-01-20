"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";

type TrendGroup = "low" | "high";
type TrendColor = "low" | "mid" | "high";
type Cell = { m: number; color: TrendColor } | null;

type Props = {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  items: number[];
  onClose: () => void;
  columns?: number;
  rows?: number;
};

function bucket(m: number): TrendColor {
  if (m >= 10) return "high";
  if (m >= 2) return "mid";
  if (m >= 1.5) return "low";
  return "low";
}

function colorVar(c: TrendColor) {
  if (c === "high") return "var(--trendHigh)";
  if (c === "mid") return "var(--trendMid)";
  if (c === "low") return "var(--trendLow)";
  return "var(--trendLow)";
}

function bucketGroup(b: TrendColor): TrendGroup {
  if (b === "mid" || b === "high") return "high";
  if (b === "low") return "low";
  return "low";
}


function buildTrendGrid(history: number[], columns: number, rows: number): Cell[][] {
  const grid: Cell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => null)
  );

  const seq = [...history].reverse();

  let col = 0;
  let row = 0;
  let prevGroup: TrendGroup | null = null;

  for (const raw of seq) {
    const m = Number(raw);
    const b = bucket(m);
    const g = bucketGroup(b);

    if (prevGroup === null) {
      col = 0;
      row = 0;
    } else if (g === prevGroup) {
       // same group => stack downward if possible, else move right
      if (row + 1 < rows && !grid[row + 1][col]) {
        row++;
      } else {
        col++;
        // keep row (BC-like), but clamp
        row = Math.min(row, rows - 1);
      }
    } else {
      col++;
      row = 0;
    }

    if (col >= columns) {
      for (let r = 0; r < rows; r++) {
        grid[r].shift();
        grid[r].push(null);
      }
      col = columns - 1;
    }

    while (col < columns && grid[row][col]) col++;
    if (col >= columns) continue;

    grid[row][col] = { m, color: b };
    prevGroup = g;
  }

  return grid;
}

export default function TrendPopover({
  open,
  onClose,
  anchorRef,
  items,
  columns = 14,
  rows = 6,
}: Props) {
  const grid = useMemo(
    () => buildTrendGrid(items ?? [], columns, rows),
    [items, columns, rows]
  );

  // ✅ position is STATE, not computed during render
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // ✅ measure DOM ONLY in effect
  useEffect(() => {
    if (!open) return;
    const el = anchorRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    setPos({
      top: r.bottom + 10,
      left: Math.max(12, r.left - 260),
    });
  }, [open, anchorRef]);

  if (!open) return null;

  return (
    <>
      {/* backdrop */}
      <div
        onMouseDown={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 9998 }}
      />

      {/* popover */}
      <div
        className="card"
        style={{
          position: "fixed",
          zIndex: 9999,
          top: pos.top,
          left: pos.left,
          width: 320,
          padding: 12,
          background: "rgba(20,24,34,0.92)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <b style={{ fontSize: 14 }}>Trend</b>
          <button
            className="badge"
            onClick={onClose}
            style={{ marginLeft: "auto" }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 6,
            padding: 8,
            borderRadius: 12,
            background: "rgba(0,0,0,0.18)",
            border: "1px solid var(--border)",
          }}
        >
          {grid.flatMap((row, r) =>
            row.map((cell, c) => (
              <div
                key={`${r}-${c}`}
                title={cell ? `${cell.m.toFixed(2)}x` : ""}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 6,
                  background: cell
                    ? colorVar(cell.color)
                    : "rgba(255,255,255,0.06)",
                }}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
