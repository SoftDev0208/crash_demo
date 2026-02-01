/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./LimboPage.module.css";
import { getToken } from "@/lib/auth";
import { apiPost, apiGet } from "@/lib/api";

type LimboResp = {
  bet: {
    id: string;
    amount: string | number;
    targetMultiplier: string | number;
    rolledMultiplier: string | number;
    win: boolean;
    profit: string | number;
    createdAt: string;
  };
  pointsBalance: string | number;
};

export default function LimboPage() {
  const [token, setToken] = useState<string | null>(null);

  // user
  const [pointsBalance, setPointsBalance] = useState<string>("0");
  const [status, setStatus] = useState<string>("Not connected");
  const [error, setError] = useState<string>("");

  // inputs (BC-like)
  const [amount, setAmount] = useState<string>("100");
  const [targetMultiplier, setTargetMultiplier] = useState<string>("2.00"); // user chooses multiplier
  const [mode, setMode] = useState<"manual" | "auto">("manual");

  // result
  const [rolling, setRolling] = useState(false);
  const [last, setLast] = useState<LimboResp["bet"] | null>(null);

  // simple local history (latest first)
  const [history, setHistory] = useState<LimboResp["bet"][]>([]);

  // read token once (avoids effect warning)
  useEffect(() => {
    queueMicrotask(() => setToken(getToken()));
  }, []);

  // initial fetch user balance
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
      } catch (e: any) {
        setError(String(e?.message || e));
      }
    })();
  }, [token]);

  const tMul = useMemo(() => {
    const n = Number(targetMultiplier);
    if (!Number.isFinite(n)) return 2;
    return Math.max(1.01, Math.min(100000, n));
  }, [targetMultiplier]);

  // In limbo, chance decreases as multiplier increases (approx; server is authority)
  const approxChance = useMemo(() => {
    // using 1% edge estimate just for UI display (your backend decides real math)
    const edge = 0.01;
    const c = ((1 - edge) / tMul) * 100;
    return Math.max(0.01, Math.min(99.99, c));
  }, [tMul]);

  async function roll() {
    setError("");
    if (!token) {
      setError("No token. Go to /auth and login first.");
      return;
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Invalid amount");
      return;
    }

    setRolling(true);
    try {
      const resp = await apiPost<LimboResp>(
        "/api/limbo/bet",
        {
          amount: Math.floor(amt),
          targetMultiplier: Number(tMul.toFixed(2)),
        },
        token
      );

      setPointsBalance(String(resp.pointsBalance ?? "0"));
      setLast(resp.bet);

      // add to local history (latest first)
      setHistory((prev) => {
        const next = [resp.bet, ...prev];
        return next.slice(0, 30);
      });
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setRolling(false);
    }
  }

  const resultMultiplier = Number(last?.rolledMultiplier ?? 0);
  const win = !!last?.win;

  return (
    <div className={styles.root}>
      {/* LEFT: bet controls */}
      <div className={styles.left}>
        <div className="card" style={{ padding: 12 }}>
          <div className={styles.titleRow}>
            <b>Limbo</b>
            <span className="badge">Points: <b className="mono">{pointsBalance}</b></span>
          </div>

          <div style={{ marginTop: 10, color: "var(--muted)" }}>
            Status: <b style={{ color: "inherit" }}>{status}</b>
          </div>

          <div className={styles.tabBar} style={{ marginTop: 12 }}>
            <button
              className={`${styles.tabBtn} ${mode === "manual" ? styles.tabBtnActive : ""}`}
              onClick={() => setMode("manual")}
              type="button"
            >
              Manual
            </button>
            <button
              className={`${styles.tabBtn} ${mode === "auto" ? styles.tabBtnActive : ""}`}
              onClick={() => setMode("auto")}
              type="button"
            >
              Auto
            </button>
          </div>

          <div className={styles.formGrid}>
            <label>
              Bet Amount
              <input value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>

            <label>
              Target Multiplier
              <input value={targetMultiplier} onChange={(e) => setTargetMultiplier(e.target.value)} />
            </label>
          </div>

          <div className={styles.miniStats}>
            <div>
              Chance (approx)
              <div className={`mono ${styles.statValue}`}>{approxChance.toFixed(2)}%</div>
            </div>
            <div>
              Payout
              <div className={`mono ${styles.statValue}`}>{tMul.toFixed(2)}x</div>
            </div>
          </div>

          <button
            className={`btn-primary ${styles.rollBtn}`}
            disabled={!token || rolling}
            onClick={roll}
            type="button"
          >
            {rolling ? "Rolling..." : "Bet"}
          </button>

          {!token ? (
            <div style={{ marginTop: 10, color: "var(--muted)" }}>
              Go to <Link href="/auth">/auth</Link> to login.
            </div>
          ) : null}

          {error ? <div className="card error" style={{ marginTop: 12 }}>{error}</div> : null}
        </div>
      </div>

      {/* CENTER: big result */}
      <div className={styles.center}>
        <div className="card" style={{ padding: 14 }}>
          <div className={styles.centerTop}>
            <div style={{ color: "var(--muted)" }}>
              Target: <b className="mono">{tMul.toFixed(2)}x</b>
            </div>
            <div style={{ color: "var(--muted)" }}>
              Win if roll ≥ target
            </div>
          </div>

          <div className={styles.bigBox}>
            <div
              className={`${styles.bigMultiplier} ${last ? (win ? styles.win : styles.lose) : ""}`}
            >
              {last ? `${resultMultiplier.toFixed(2)}x` : "—"}
            </div>

            <div className={styles.subLine}>
              {last ? (
                <>
                  Result:{" "}
                  <b className="mono">
                    {win ? "WIN" : "LOSE"}
                  </b>
                  {"  |  "}
                  Profit:{" "}
                  <b className="mono">
                    {String(last.profit)}
                  </b>
                </>
              ) : (
                <span style={{ color: "var(--muted)" }}>Place a bet to roll.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: history */}
      <div className={styles.right}>
        <div className="card" style={{ padding: 12 }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <b>History</b>
            <span className="badge">{history.length}</span>
          </div>

          {history.length === 0 ? (
            <div style={{ color: "var(--muted)" }}>No rolls yet.</div>
          ) : (
            <div className={styles.historyList}>
              {history.map((h) => {
                const hm = Number(h.rolledMultiplier ?? 0);
                return (
                  <div key={h.id} className={styles.historyItem}>
                    <div className={`${styles.histDot} ${h.win ? styles.dotWin : styles.dotLose}`} />
                    <div className="mono" style={{ fontWeight: 900 }}>
                      {hm.toFixed(2)}x
                    </div>
                    <div className="mono" style={{ marginLeft: "auto", color: "var(--muted)" }}>
                      {String(h.profit)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
