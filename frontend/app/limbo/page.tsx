/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiPost, apiGet } from "@/lib/api";
import { getToken } from "@/lib/auth";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function LimboPage() {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState("Not connected");
  const [pointsBalance, setPointsBalance] = useState("0");
  const [error, setError] = useState("");

  // inputs
  const [amount, setAmount] = useState("100");
  const [payout, setPayout] = useState("1.96");

  // result
  const [last, setLast] = useState<any>(null);

  // match backend
  const houseEdge = 0.01;

  useEffect(() => {
    queueMicrotask(() => setToken(getToken()));
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus("No token");
      return;
    }
    setStatus("Ready");

    (async () => {
      try {
        const me = await apiGet<{ user: any }>("/api/auth/me", token);
        setPointsBalance(String(me.user?.pointsBalance ?? "0"));
      } catch {}
    })();
  }, [token]);

  const chance = useMemo(() => {
    const p = Number(payout);
    if (!Number.isFinite(p) || p <= 0) return 0;
    return clamp(((1 - houseEdge) / p) * 100, 0.01, 99.99);
  }, [payout]);

  const winChanceLabel = `${chance.toFixed(2)}%`;

  async function bet() {
    setError("");
    if (!token) return setError("No token. Go to /auth first.");

    try {
      const resp = await apiPost<any>(
        "/api/limbo/bet",
        { amount: Number(amount), payout: Number(payout) },
        token
      );

      if (!resp?.ok) throw new Error(resp?.error || "FAILED");

      setLast(resp.bet);
      setPointsBalance(String(resp.pointsBalance ?? pointsBalance));
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }

  // tiny “rocket” animation via CSS class
  const rocketState =
    last?.win === true ? "win" : last?.win === false ? "lose" : "idle";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="row">
        <h2 style={{ margin: 0 }}>Limbo</h2>
        <div style={{ display: "flex", gap: 12 }}>
          <Link href="/">Crash</Link>
          <Link href="/auth">Auth</Link>
        </div>
      </div>

      {!token && (
        <div className="card">
          No token. Go to <Link href="/auth">/auth</Link> and login.
        </div>
      )}

      {error && <div className="card error">{error}</div>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "360px 1fr",
          gap: 14,
          alignItems: "stretch",
        }}
      >
        {/* LEFT panel */}
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <b style={{ opacity: 0.9 }}>Manual</b>
            <span style={{ opacity: 0.6 }}>Auto</span>
            <span style={{ opacity: 0.6 }}>Advanced</span>
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
            <div style={{ color: "var(--muted)", fontWeight: 800 }}>Amount</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 10 }}>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => setAmount(String(Math.max(1, Math.floor(Number(amount) / 2))))}>
                  1/2
                </button>
                <button type="button" onClick={() => setAmount(String(Math.max(1, Math.floor(Number(amount) * 2))))}>
                  2×
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, opacity: 0.75 }}>
              <button type="button" onClick={() => setAmount("1")}>1</button>
              <button type="button" onClick={() => setAmount("10")}>10</button>
              <button type="button" onClick={() => setAmount("100")}>100</button>
              <button type="button" onClick={() => setAmount("1000")}>1.0k</button>
            </div>

            <button
              className="btn-primary"
              onClick={bet}
              disabled={!token || Number(amount) <= 0 || Number(payout) < 1.01}
              style={{ height: 46, fontWeight: 900 }}
            >
              Bet
            </button>

            <div style={{ marginTop: 12, color: "var(--muted)" }}>
              Status: <b style={{ color: "inherit" }}>{status}</b>
              <br />
              Points: <b className="mono">{pointsBalance}</b>
            </div>
          </div>
        </div>

        {/* CENTER scene */}
        <div className="card" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
          {/* top hint */}
          <div style={{ padding: 10, textAlign: "center", color: "var(--muted)", fontWeight: 800 }}>
            Game result will be displayed
          </div>

          {/* scene */}
          <div
            style={{
              position: "relative",
              height: 430,
              background:
                "radial-gradient(900px 500px at 40% 30%, rgba(255,255,255,0.06), transparent 60%), rgba(0,0,0,0.12)",
              borderTop: "1px solid var(--border)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            {/* multiplier */}
            <div
              style={{
                position: "absolute",
                top: 60,
                left: 0,
                right: 0,
                textAlign: "center",
                fontSize: 64,
                fontWeight: 950,
                letterSpacing: -1,
                color: last?.win === true ? "var(--ok)" : last?.win === false ? "var(--danger)" : "var(--ok)",
              }}
            >
              {last ? `${Number(last.payout).toFixed(2)}x` : "1.00x"}
            </div>

            {/* rocket placeholder */}
            <div
              className={`limboRocket limboRocket-${rocketState}`}
              style={{
                position: "absolute",
                left: "50%",
                top: "55%",
                transform: "translate(-50%, -50%)",
                width: 90,
                height: 150,
                borderRadius: 30,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.08)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: 18,
                  transform: "translateX(-50%)",
                  width: 34,
                  height: 34,
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,0.22)",
                  background: "rgba(0,0,0,0.22)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: -18,
                  transform: "translateX(-50%)",
                  width: 30,
                  height: 40,
                  borderRadius: 20,
                  background: "linear-gradient(to bottom, rgba(255,120,0,0.0), rgba(255,120,0,0.55))",
                  filter: "blur(0.2px)",
                }}
              />
            </div>

            {/* last result */}
            {last && (
              <div
                style={{
                  position: "absolute",
                  left: 18,
                  bottom: 18,
                  color: "var(--muted)",
                  fontWeight: 800,
                }}
              >
                Roll: <span className="mono">{Number(last.roll).toFixed(2)}%</span> | Chance:{" "}
                <span className="mono">{Number(last.chance).toFixed(2)}%</span> |{" "}
                {last.win ? (
                  <span style={{ color: "var(--ok)" }}>WIN</span>
                ) : (
                  <span style={{ color: "var(--danger)" }}>LOSE</span>
                )}
                {"  "}Profit: <span className="mono">{String(last.profit)}</span>
              </div>
            )}
          </div>

          {/* bottom controls */}
          <div style={{ padding: 14, display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ color: "var(--muted)", fontWeight: 800, marginBottom: 6 }}>Payout</div>
                <input value={payout} onChange={(e) => setPayout(e.target.value)} />
              </div>

              <div>
                <div style={{ color: "var(--muted)", fontWeight: 800, marginBottom: 6 }}>
                  Win Chance
                </div>
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: "rgba(0,0,0,0.18)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <b className="mono">{winChanceLabel}</b>
                  <span style={{ color: "var(--muted)" }}>%</span>
                </div>
              </div>
            </div>

            <div style={{ color: "var(--muted)", fontSize: 12 }}>
              Formula: chance = (1-edge)/payout × 100. Edge = {(houseEdge * 100).toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* simple rocket animation CSS */}
      <style jsx global>{`
        .limboRocket-win {
          animation: limboUp 900ms ease-out 1;
        }
        .limboRocket-lose {
          animation: limboDown 700ms ease-in 1;
          opacity: 0.9;
        }
        @keyframes limboUp {
          0% { transform: translate(-50%, -50%) translateY(0); }
          100% { transform: translate(-50%, -50%) translateY(-70px); }
        }
        @keyframes limboDown {
          0% { transform: translate(-50%, -50%) translateY(0); }
          100% { transform: translate(-50%, -50%) translateY(60px); }
        }
      `}</style>
    </div>
  );
}
