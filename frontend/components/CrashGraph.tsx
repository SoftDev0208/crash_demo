"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Point = { t: number; m: number };

export default function CrashGraph(props: {
  phase: string;
  points: Point[];
  crashAt?: number | null;
  displayMultiplier?: number;
  height?: number;
}) {
  const { phase, points, crashAt, displayMultiplier, height = 320 } = props;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const update = () => setW(el.clientWidth || 0);

    const ro = new ResizeObserver(() => {
      // ResizeObserver callback is already external -> OK
      update();
    });

    ro.observe(el);

    // ✅ Avoid "sync setState in effect" warning
    queueMicrotask(update);
    // (or: requestAnimationFrame(update))

    return () => ro.disconnect();
  }, []);


  const maxM = useMemo(() => {
    const pMax = points.reduce((acc, p) => Math.max(acc, p.m), 1);
    const c = crashAt ? Number(crashAt) : 1;
    return Math.max(pMax, c, 2);
  }, [points, crashAt]);

  useEffect(() => {
    const width = w;
    if (!width || width < 10) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, width, height);

    // grid
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
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

    const pad = 14;
    const gx0 = pad;
    const gy0 = height - pad;
    const gx1 = width - pad;
    const gy1 = pad;

    const t0 = 0;
    const t1 = points.length ? points[points.length - 1].t : 1;
    const tSpan = Math.max(1, t1 - t0);
    const mapX = (t: number) => gx0 + ((t - t0) / tSpan) * (gx1 - gx0);

    // start from left-bottom: 1.00x = bottom
    const minM = 1;
    const mapY = (m: number) => gy0 - ((m - minM) / (maxM - minM)) * (gy0 - gy1);

    if (points.length >= 1) {
      ctx.strokeStyle = "rgba(124,92,255,0.95)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(gx0, gy0);
      for (let i = 0; i < points.length; i++) ctx.lineTo(mapX(points[i].t), mapY(points[i].m));
      ctx.stroke();

      ctx.strokeStyle = "rgba(124,92,255,0.20)";
      ctx.lineWidth = 6;
      ctx.stroke();
    }

  }, [w, height, points, crashAt, phase, maxM]);

  const centerText =  phase !== "BETTING" ? `${Number(displayMultiplier).toFixed(2)}x` : "";

  return (
    <div className="card" style={{ padding: 12 }}>
      <div ref={wrapRef} style={{ position: "relative" }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          <div style={{ fontSize: 84, fontWeight: 900, textShadow: "0 8px 30px rgba(0,0,0,0.35)" }}>
            {centerText}
          </div>
        </div>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
