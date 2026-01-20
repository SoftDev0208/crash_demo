/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styles from "./CrashPage.module.css";
import { connectCrashSocket, disconnectCrashSocket } from "@/lib/socket";
import { getToken } from "@/lib/auth";
import CrashGraph from "@/components/CrashGraph";
import CrashHistory from "@/components/CrashHistory";
import TrendPopover from "@/components/TrendPopover";
import { apiGet } from "@/lib/api";

export default function HomePage() {
  const [token, setToken] = useState<string | null>(null);

  const [round, setRound] = useState<any>(null);
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [bets, setBets] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("Not connected");
  const [error, setError] = useState<string>("");

  // ONE bet inputs
  const [amount, setAmount] = useState("100");
  const [autoCashout, setAutoCashout] = useState("");

  const [pointsBalance, setPointsBalance] = useState<string>("0");

  const connectedRef = useRef(false);

  const [history, setHistory] = useState<number[]>([]);
  const [points, setPoints] = useState<{ t: number; m: number }[]>([]);
  const [crashAt, setCrashAt] = useState<number | null>(null);

  const [mode, setMode] = useState<"manual" | "auto">("manual");

  // next-round queue
  const [queuedNext, setQueuedNext] = useState(false);
  const queuedNextRef = useRef(false);

  // track current bet in ref (prevents stale closures)
  const betRef = useRef<any>(null);

  // trend popover
  const trendBtnRef = useRef<HTMLSpanElement | null>(null);
  const [trendOpen, setTrendOpen] = useState(false);

  const lastRoundIdRef = useRef<string | null>(null);
  const lastPhaseRef = useRef<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => setToken(getToken()));
  }, []);

  // ONE bet only (slotIndex 0) — robust even if slotIndex is string
  const bet = useMemo(() => {
    return bets.find((b) => Number(b?.slotIndex) === 0) || null;
  }, [bets]);

  useEffect(() => {
    betRef.current = bet;
  }, [bet]);

  useEffect(() => {
    queuedNextRef.current = queuedNext;
  }, [queuedNext]);

  // if a bet appears, clear queued mode automatically
  useEffect(() => {
    if (bet && queuedNext) setQueuedNext(false);
  }, [bet, queuedNext]);

  async function emitWithAck(event: string, payload: any) {
    setError("");
    if (!token) {
      setError("No token. Go to /auth and login/register first.");
      return { ok: false, error: "NO_TOKEN" };
    }
    const s = connectCrashSocket(token);
    return new Promise<any>((resolve) => s.emit(event, payload, (resp: any) => resolve(resp)));
  }

  async function placeBet() {
    if (!round?.roundId) return setError("No round yet.");

    const resp = await emitWithAck("bet:place", {
      roundId: round.roundId,
      slotIndex: 0,
      amount: Number(amount),
      autoCashout: autoCashout ? Number(autoCashout) : null,
    });

    if (!resp?.ok) setError(resp?.error || "Failed");
  }

  async function cancelBet() {
    if (!round?.roundId) return setError("No round yet.");
    const resp = await emitWithAck("bet:cancel", { roundId: round.roundId, slotIndex: 0 });
    if (!resp?.ok) setError(resp?.error || "Failed");
  }

  async function cashoutBet() {
    if (!round?.roundId) return setError("No round yet.");
    const resp = await emitWithAck("bet:cashout", { roundId: round.roundId, slotIndex: 0 });
    if (!resp?.ok) setError(resp?.error || "Failed");
  }

  useEffect(() => {
    if (!token) return;
    if (connectedRef.current) return;
    connectedRef.current = true;

    const s = connectCrashSocket(token);

    // initial balance fetch
    (async () => {
      try {
        const data = await apiGet<{ user: any }>("/api/auth/me", token);
        setPointsBalance(String(data.user?.pointsBalance ?? "0"));
      } catch {}
    })();

    const onConnect = () => setStatus("Connected");
    const onConnectError = (err: any) => setStatus(`Connect error: ${err?.message || String(err)}`);
    const onDisconnect = () => setStatus("Disconnected");

    const requestBetsRefresh = (roundId: string) => {
      // If your backend has no handler, it will just do nothing (safe)
      try {
        s.emit("bets:refresh", { roundId });
      } catch {}
    };

    const onRoundState = (data: any) => {
      setRound(data);

      const roundId = String(data?.roundId || "");
      const phase = String(data?.phase || "");

      // reset graph + bets only when NEW round id comes
      const lastRound = lastRoundIdRef.current;
      if (roundId && roundId !== lastRound) {
        lastRoundIdRef.current = roundId;
        setCrashAt(null);
        setPoints([]);
        setMultiplier(1.0);
        setBets([]); // IMPORTANT: clear old bet so new round can bet again
      }

      // request refresh when phase changes (fix button stuck issues)
      const lastPhase = lastPhaseRef.current;
      if (phase && phase !== lastPhase) {
        lastPhaseRef.current = phase;
        if (roundId) requestBetsRefresh(roundId);
      }

      // reset multiplier in BETTING
      if (phase === "BETTING") setMultiplier(1.0);

      // queued bet: auto-place when BETTING opens
      if (phase === "BETTING") {
        if (queuedNextRef.current && !betRef.current) {
          queuedNextRef.current = false;
          setQueuedNext(false);
          queueMicrotask(() => placeBet());
        }
      }
    };

    const onTick = (t: any) => {
      const m = Number(t.multiplier || 1);
      setMultiplier(m);

      setPoints((prev) => {
        const lastT = prev.length ? prev[prev.length - 1].t : 0;
        const nextT = Number(t.elapsedMs ?? lastT + 50);
        const next = [...prev, { t: nextT, m }];
        return next.length > 1200 ? next.slice(next.length - 1200) : next;
      });
    };

    const onCrash = (c: any) => {
      const cm = Number(c.crashMultiplier || 1);
      setCrashAt(cm);
      setMultiplier(cm);
    };

    const onBetsUpdate = (payload: any) => setBets(payload?.bets || []);
    const onHistoryUpdate = (h: any) =>
      setHistory(Array.isArray(h?.items) ? h.items.map((x: any) => Number(x)) : []);
    const onBalanceUpdate = (b: any) => setPointsBalance(String(b?.pointsBalance ?? "0"));

    const onBalanceRefresh = async () => {
      try {
        const data = await apiGet<{ user: any }>("/api/auth/me", token);
        setPointsBalance(String(data.user?.pointsBalance ?? "0"));
      } catch {}
    };

    s.on("connect", onConnect);
    s.on("connect_error", onConnectError);
    s.on("disconnect", onDisconnect);

    s.on("round:state", onRoundState);
    s.on("flight:tick", onTick);
    s.on("round:crash", onCrash);
    s.on("bets:update", onBetsUpdate);
    s.on("history:update", onHistoryUpdate);
    s.on("balance:update", onBalanceUpdate);
    s.on("balance:refresh", onBalanceRefresh);

    return () => {
      connectedRef.current = false;
      try {
        s.off("connect", onConnect);
        s.off("connect_error", onConnectError);
        s.off("disconnect", onDisconnect);

        s.off("round:state", onRoundState);
        s.off("flight:tick", onTick);
        s.off("round:crash", onCrash);
        s.off("bets:update", onBetsUpdate);
        s.off("history:update", onHistoryUpdate);
        s.off("balance:update", onBalanceUpdate);
        s.off("balance:refresh", onBalanceRefresh);
      } catch {}
      disconnectCrashSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Big button behavior (with queue support)
  const bigAction = useMemo(() => {
    const phase = String(round?.phase || "");

    if (!token || !round?.roundId) {
      return { label: "Login first", disabled: true, onClick: async () => {} };
    }

    if (phase === "BETTING") {
      if (!bet) return { label: "Bet", disabled: false, onClick: placeBet };
      if (bet.status === "PLACED") return { label: "Cancel", disabled: false, onClick: cancelBet };
      return { label: "Waiting…", disabled: true, onClick: async () => {} };
    }

    if (phase === "FLIGHT") {
      if (bet?.status === "ACTIVE") {
        return { label: `Cashout @ ${multiplier.toFixed(2)}x`, disabled: false, onClick: cashoutBet };
      }
      return { label: "In Flight", disabled: true, onClick: async () => {} };
    }

    // CRASH / COOLDOWN: allow queue toggle if no bet exists for this round
    if (!bet) {
      if (!queuedNext) return { label: "Bet (Next Round)", disabled: false, onClick: async () => setQueuedNext(true) };
      return { label: "Cancel (Next Round)", disabled: false, onClick: async () => setQueuedNext(false) };
    }

    return { label: "Waiting…", disabled: true, onClick: async () => {} };
  }, [token, round?.roundId, round?.phase, bet, multiplier, queuedNext, amount, autoCashout]);

  return (
    <div className={styles.root}>
      {/* LEFT */}
      <div className={styles.left}>
        <div className="card" style={{ marginTop: 10, padding: 12 }}>
          <b>Crash</b>
          <div style={{ display: "grid", gap: 6, marginTop: 10, color: "var(--muted)" }}>
            <div>
              Status: <b style={{ color: "inherit" }}>{status}</b>
            </div>
            <div>
              Points:{" "}
              <b className="mono" style={{ color: "inherit" }}>
                {pointsBalance}
              </b>
            </div>
            <div>
              Phase: <b style={{ color: "inherit" }}>{round?.phase || "-"}</b>
            </div>
          </div>
        </div>
      </div>

      {/* CENTER */}
      <div className={styles.center}>
        {/* ✅ Use CrashHistory component */}
        <CrashHistory
          items={history}
          max={19}
          rightSlot={
            <span
              ref={trendBtnRef}
              className="badge"
              style={{ cursor: "pointer", userSelect: "none" }}
              onClick={() => setTrendOpen((v) => !v)}
              title="Trend"
            >
              ▦
            </span>
          }
        />

        {/* ✅ Render TrendPopover (it was imported but not used before) */}
        <TrendPopover
          open={trendOpen}
          anchorRef={trendBtnRef}
          items={history}
          onClose={() => setTrendOpen(false)}
        />

        {/* graph */}
        <div className={styles.graphWrap}>
          <CrashGraph
            phase={round?.phase || "-"}
            points={points}
            crashAt={crashAt}
            displayMultiplier={multiplier}
            height={340}
          />
        </div>

        {error && <div className="card error">{error}</div>}

        {/* BET AREA */}
        <div className={`card ${styles.betArea}`}>
          <div className={styles.tabBar}>
            <button
              className={`${styles.tabBtn} ${mode === "manual" ? styles.tabBtnActive : ""}`}
              onClick={() => setMode("manual")}
            >
              Manual
            </button>
            <button
              className={`${styles.tabBtn} ${mode === "auto" ? styles.tabBtnActive : ""}`}
              onClick={() => setMode("auto")}
            >
              Auto
            </button>
          </div>

          <div className={styles.betBody} style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label>
                Amount
                <input value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>
              <label>
                Auto Cashout
                <input value={autoCashout} onChange={(e) => setAutoCashout(e.target.value)} />
              </label>
            </div>

            <div className={styles.betButtonRow}>
              <button
                className={`btn-primary ${styles.bigBetBtn}`}
                disabled={bigAction.disabled}
                onClick={bigAction.onClick}
              >
                {bigAction.label}
              </button>

              <div style={{ marginTop: 8, textAlign: "center", color: "var(--muted)" }}>
                Bet Status: <span className="mono">{bet?.status || "NONE"}</span>
                {queuedNext && !bet ? (
                  <span style={{ marginLeft: 10 }} className="badge">
                    queued
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", color: "var(--muted)" }}>
          <span className="mono">Network Status • {status}</span>
        </div>

        {!token && (
          <div style={{ color: "var(--muted)" }}>
            No token. Go to <Link href="/auth">/auth</Link>
          </div>
        )}
      </div>

      {/* RIGHT */}
      <div className={styles.right}>
        <div className={styles.sideTabs}>
          <div className={`${styles.sideTab} ${styles.sideTabActive}`}>Classic</div>
          <div className={styles.sideTab}>Trenball</div>
          <div className={styles.sideTab}>Betting Strategy</div>
        </div>

        <div className="card" style={{ padding: 12 }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <b>Live Bets</b>
            <span className="badge" style={{ marginLeft: "auto" }}>
              {bets.length} bets
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 80px 120px",
              gap: 8,
              padding: "8px 10px",
              borderBottom: "1px solid var(--border)",
              color: "var(--muted)",
              fontWeight: 800,
            }}
          >
            <div>Player</div>
            <div style={{ textAlign: "right" }}>Cashout</div>
            <div style={{ textAlign: "right" }}>Amount</div>
          </div>

          <div style={{ display: "grid" }}>
            {bets.length === 0 ? (
              <div style={{ padding: 12, color: "var(--muted)" }}>No bets this round.</div>
            ) : (
              bets.map((b: any) => (
                <div
                  key={b.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 80px 120px",
                    gap: 8,
                    padding: "10px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontWeight: 800 }}>Hidden</div>
                  <div style={{ textAlign: "right" }} className="mono">
                    {b.cashoutMultiplier ? `${Number(b.cashoutMultiplier).toFixed(2)}x` : "-"}
                  </div>
                  <div style={{ textAlign: "right" }} className="mono">
                    {String(b.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
