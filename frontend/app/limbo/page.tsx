/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { getToken } from "@/lib/auth";
import CrashHistory from "@/components/CrashHistory";
import styles from "./LimboPage.module.css";
import TrendPopover from "@/components/TrendPopover";

type MeResp = {
  user: { id: string; username: string; pointsBalance: string | number };
};

type LimboHistoryResp = {
  items: Array<string | number>;
};

type LimboBetResp = {
  ok: boolean;
  bet?: {
    id: string;
    amount: string | number;
    targetMultiplier: string | number;
    rolledMultiplier: string | number;
    win: boolean;
    profit: string | number;
    createdAt: string;
  };
  pointsBalance?: string | number;
  error?: string;
};

type LimboBetBody = {
  amount: number;
  targetMultiplier: number;
};

const HOUSE_EDGE = 0.01; // 1%

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function LimboPage() {
  const [token, setToken] = useState<string | null>(null);

  // balance + result
  const [pointsBalance, setPointsBalance] = useState<string>("0");
  const [rollMultiplier, setRollMultiplier] = useState<number>(1.0);
  const [lastWin, setLastWin] = useState<boolean | null>(null);
  const [lastProfit, setLastProfit] = useState<string>("0");

  // inputs
  const [amount, setAmount] = useState<string>("100");
  const [payout, setPayout] = useState<string>("1.96");
  const [chance, setChance] = useState<string>("50");

  const [mode, setMode] = useState<"manual" | "auto" | "advanced">("manual");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // trend
  const [history, setHistory] = useState<number[]>([]);
  const [trendOpen, setTrendOpen] = useState(false);
  const trendBtnRef = useRef<HTMLButtonElement | null>(null);

  // read token once
  useEffect(() => {
    queueMicrotask(() => setToken(getToken()));
  }, []);

  async function refreshMe(t?: string | null) {
    const tk = t ?? token;
    if (!tk) return;
    const data = await apiGet<MeResp>("/api/auth/me", tk);
    setPointsBalance(String(data.user?.pointsBalance ?? "0"));
  }

  async function refreshHistory(t?: string | null) {
    const tk = t ?? token;
    if (!tk) return;
    try {
      // You need a backend route that returns: { items: number[] } (or strings)
      const data = await apiGet<LimboHistoryResp>("/api/limbo/history", tk);
      const items = Array.isArray(data?.items) ? data.items : [];
      setHistory(items.map((x) => Number(x)).filter((n) => Number.isFinite(n)));
    } catch {
      // ok if not implemented yet
      setHistory([]);
    }
  }

  useEffect(() => {
    if (!token) return;
    refreshMe(token);
    refreshHistory(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // payout <-> chance linkage
  const computedChanceFromPayout = useMemo(() => {
    const p = Number(payout);
    if (!Number.isFinite(p) || p <= 0) return "";
    const c = ((1 - HOUSE_EDGE) / p) * 100;
    return clamp(c, 0.01, 99.99).toFixed(2);
  }, [payout]);

  const computedPayoutFromChance = useMemo(() => {
    const c = Number(chance);
    if (!Number.isFinite(c) || c <= 0) return "";
    const p = (1 - HOUSE_EDGE) / (c / 100);
    return clamp(p, 1.01, 100000).toFixed(2);
  }, [chance]);

  const [lastEdited, setLastEdited] = useState<"payout" | "chance">("payout");

  useEffect(() => {
    if (lastEdited === "payout") {
      if (computedChanceFromPayout) setChance(computedChanceFromPayout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedChanceFromPayout]);

  useEffect(() => {
    if (lastEdited === "chance") {
      if (computedPayoutFromChance) setPayout(computedPayoutFromChance);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedPayoutFromChance]);

  async function onBet() {
    setError("");

    if (!token) {
      setError("No token. Please login first at /auth.");
      return;
    }

    const amt = Math.floor(Number(amount));
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Invalid amount.");
      return;
    }

    const target = Number(payout);
    if (!Number.isFinite(target)) {
      setError("Invalid payout / target multiplier.");
      return;
    }

    setLoading(true);
    try {
      const resp = await apiPost<LimboBetResp, LimboBetBody>(
        "/api/limbo/bet",
        { amount: amt, targetMultiplier: target },
        token
      );

      if (!resp?.ok) {
        setError(resp?.error || "Bet failed");
        return;
      }

      const rolled = Number(resp.bet?.rolledMultiplier ?? 1);
      setRollMultiplier(rolled);

      const win = Boolean(resp.bet?.win);
      setLastWin(win);
      setLastProfit(String(resp.bet?.profit ?? "0"));

      if (resp.pointsBalance != null) setPointsBalance(String(resp.pointsBalance));
      else await refreshMe(token);

      // update history list after each bet
      await refreshHistory(token);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  const resultClass =
    lastWin === null ? "" : lastWin ? styles.winText : styles.loseText;

  return (
    <div className={styles.root}>
      {/* LEFT CONTROL PANEL */}
      <aside className={styles.left}>
        <div className={styles.leftTabs}>
          <button
            className={`${styles.leftTab} ${mode === "manual" ? styles.leftTabActive : ""}`}
            onClick={() => setMode("manual")}
          >
            Manual
          </button>
          <button
            className={`${styles.leftTab} ${mode === "auto" ? styles.leftTabActive : ""}`}
            onClick={() => setMode("auto")}
          >
            Auto
          </button>
          <button
            className={`${styles.leftTab} ${mode === "advanced" ? styles.leftTabActive : ""}`}
            onClick={() => setMode("advanced")}
          >
            Advanced
          </button>
        </div>

        <div className={styles.leftBody}>
          <div className={styles.balanceRow}>
            <span className="badge">Points</span>
            <span className="mono" style={{ fontWeight: 800 }}>
              {pointsBalance}
            </span>
          </div>

          <label>
            Amount
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
            />
          </label>

          <div className={styles.quickRow}>
            <button
              type="button"
              onClick={() => setAmount(String(Math.floor(Number(amount) / 2 || 0)))}
            >
              1/2
            </button>
            <button
              type="button"
              onClick={() => setAmount(String(Math.floor(Number(amount) * 2 || 0)))}
            >
              2×
            </button>
          </div>

          <button
            className={`${styles.betBtn} btn-primary`}
            onClick={onBet}
            disabled={loading || !token}
          >
            {loading ? "Betting..." : "Bet"}
          </button>

          {error ? <div className="card error">{error}</div> : null}
        </div>
      </aside>

      {/* CENTER STAGE */}
      <main className={styles.stage}>
        {/* top right controls (trend button) */}
        <CrashHistory
          items={history}
          max={19}
          rightSlot={
            <button
              ref={trendBtnRef}
              type="button"
              className="badge"
              style={{ cursor: "pointer", userSelect: "none" }}
              onClick={() => setTrendOpen((v) => !v)}
              title="Trend"
            >
              ▦
            </button>
          }
        />

        {/* Trend popover */}
        <TrendPopover
          open={trendOpen}
          anchorRef={trendBtnRef}
          items={history}
          onClose={() => setTrendOpen(false)}
        />

        {/* BIG CENTER MULTIPLIER */}
        <div className={styles.centerValue}>
          <div className={`${styles.centerMultiplier} ${resultClass}`}>
            {rollMultiplier.toFixed(2)}x
          </div>

          {lastWin !== null && (
            <div className={styles.centerSub}>
              {lastWin ? "WIN" : "LOSE"} • Profit:{" "}
              <span className="mono" style={{ fontWeight: 900 }}>
                {lastProfit}
              </span>
            </div>
          )}
        </div>

        {/* Rocket/background block */}
        <div className={styles.rocketArea} aria-hidden />

        {/* Bottom controls row */}
        <div className={styles.bottomBar}>
          <div className={styles.bottomCard}>
            <div className={styles.bottomLabel}>Payout</div>
            <input
              value={payout}
              onChange={(e) => {
                setLastEdited("payout");
                setPayout(e.target.value);
              }}
              inputMode="decimal"
            />
          </div>

          <div className={styles.bottomMid}>
            <button
              type="button"
              className={styles.arrowBtn}
              onClick={() => setPayout((p) => String((Number(p) - 0.01).toFixed(2)))}
            >
              ‹
            </button>
            <button
              type="button"
              className={styles.arrowBtn}
              onClick={() => setPayout((p) => String((Number(p) + 0.01).toFixed(2)))}
            >
              ›
            </button>
          </div>

          <div className={styles.bottomCard}>
            <div className={styles.bottomLabel}>Win Chance</div>
            <div className={styles.chanceRow}>
              <input
                value={chance}
                onChange={(e) => {
                  setLastEdited("chance");
                  setChance(e.target.value);
                }}
                inputMode="decimal"
              />
              <div className={styles.percent}>%</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
