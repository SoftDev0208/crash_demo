/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef } from "react";

type Point = { t: number; m: number };

export default function CrashGraph(props: {
  phase: string;
  points: Point[];
  crashAt?: number | null; // crash multiplier
  width?: number;
  height?: number;
}) {
  const { phase, points, crashAt, width = 920, height = 260 } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const maxM = useMemo(() => {
    const pMax = points.reduce((acc, p) => Math.max(acc, p.m), 1);
    const c = crashAt ? Number(crashAt) : 1;
    return Math.max(pMax, c, 2);
  }, [points, crashAt]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle HiDPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.clearRect(0, 0, width, height);

    // Draw grid
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;

    const gridColor = "rgba(255,255,255,0.08)";
    ctx.strokeStyle = gridColor;
    for (let i = 0; i <= 10; i++) {
      const x = (width * i) / 10;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let i = 0; i <= 6; i++) {
      const y = (height * i) / 6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Axis labels (simple)
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillText(`max ${maxM.toFixed(2)}x`, 10, 18);

    // Convert points to screen coords
    const t0 = points.length ? points[0].t : 0;
    const t1 = points.length ? points[points.length - 1].t : 1;
    const tSpan = Math.max(1, t1 - t0);

    const pad = 14;
    const gx0 = pad;
    const gy0 = height - pad;
    const gx1 = width - pad;
    const gy1 = pad;

    const mapX = (t: number) => gx0 + ((t - t0) / tSpan) * (gx1 - gx0);
    const mapY = (m: number) => gy0 - ((m - 1) / (maxM - 1)) * (gy0 - gy1);

    // Draw line
    if (points.length >= 2) {
      ctx.strokeStyle = "rgba(124,92,255,0.95)";
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(mapX(points[0].t), mapY(points[0].m));
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(mapX(points[i].t), mapY(points[i].m));
      }
      ctx.stroke();

      // glow
      ctx.strokeStyle = "rgba(124,92,255,0.25)";
      ctx.lineWidth = 6;
      ctx.stroke();
    }

    // Crash marker line
    if (crashAt && (phase === "CRASH" || phase === "COOLDOWN")) {
      const y = mapY(Number(crashAt));
      ctx.strokeStyle = "rgba(255,77,79,0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx0, y);
      ctx.lineTo(gx1, y);
      ctx.stroke();

      ctx.fillStyle = "rgba(255,77,79,0.9)";
      ctx.fillText(`CRASH @ ${Number(crashAt).toFixed(2)}x`, 10, 36);
    }
  }, [points, crashAt, width, height, phase, maxM]);

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <b>Live Graph</b>
        <span className="badge">
          Phase: <b>{phase || "-"}</b>
        </span>
      </div>
      <div style={{ marginTop: 10 }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
