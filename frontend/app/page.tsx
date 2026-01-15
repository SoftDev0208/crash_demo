/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { connectCrashSocket, disconnectCrashSocket } from "@/lib/socket";
import { getToken } from "@/lib/auth";
import CrashGraph from "@/components/CrashGraph";
import CrashHistory from "@/components/CrashHistory";

export default function HomePage() {
  const [token, setToken] = useState<string | null>(null);

  const [round, setRound] = useState<any>(null);
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [bets, setBets] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("Not connected");
  const [error, setError] = useState<string>("");

  // Slot inputs
  const [amountA, setAmountA] = useState("100");
  const [autoA, setAutoA] = useState("");
  const [amountB, setAmountB] = useState("100");
  const [autoB, setAutoB] = useState("");

  // Prevent double-connect in dev StrictMode
  const connectedRef = useRef(false);

  // Graph + history state
  const [history, setHistory] = useState<number[]>([]);
  const [points, setPoints] = useState<{ t: number; m: number }[]>([]);
  const [crashAt, setCrashAt] = useState<number | null>(null);

  // Read token once (microtask avoids strict lint warning)
  useEffect(() => {
    queueMicrotask(() => setToken(getToken()));
  }, []);

  // Connect socket
  useEffect(() => {
    if (!token) return;
    if (connectedRef.current) return;
    connectedRef.current = true;

    const s = connectCrashSocket(token);

    const onConnect = () => setStatus("Connected");
    const onConnectError = (err: any) => setStatus(`Connect error: ${err?.message || String(err)}`);
    const onDisconnect = () => setStatus("Disconnected");

    const onRoundState = (data: any) => {
      setRound(data);
      setCrashAt(null);

      // New round => reset graph
      setPoints([]);
      if (data?.phase === "BETTING" || data?.phase === "COOLDOWN") setMultiplier(1.0);
    };

    const onTick = (t: any) => {
      const m = Number(t.multiplier || 1); // ✅ FIX: define m
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

    const onHistoryUpdate = (h: any) => {
      setHistory(Array.isArray(h?.items) ? h.items.map((x: any) => Number(x)) : []);
    };

    s.on("connect", onConnect);
    s.on("connect_error", onConnectError);
    s.on("disconnect", onDisconnect);

    s.on("round:state", onRoundState);
    s.on("flight:tick", onTick);
    s.on("round:crash", onCrash);
    s.on("bets:update", onBetsUpdate);
    s.on("history:update", onHistoryUpdate);

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
      } catch {}
      disconnectCrashSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const canBet = round?.phase === "BETTING";
  const canCashout = round?.phase === "FLIGHT";

  function betForSlot(slotIndex: number) {
    return bets.find((b) => b.slotIndex === slotIndex) || null;
  }

  async function emitWithAck(event: string, payload: any) {
    setError("");
    if (!token) {
      setError("No token. Go to /auth and login/register first.");
      return { ok: false, error: "NO_TOKEN" };
    }
    const s = connectCrashSocket(token);
    return new Promise<any>((resolve) => {
      s.emit(event, payload, (resp: any) => resolve(resp));
    });
  }

  async function place(slotIndex: 0 | 1) {
    if (!round?.roundId) return setError("No round yet.");
    const amount = slotIndex === 0 ? amountA : amountB;
    const auto = slotIndex === 0 ? autoA : autoB;

    const resp = await emitWithAck("bet:place", {
      roundId: round.roundId,
      slotIndex,
      amount: Number(amount),
      autoCashout: auto ? Number(auto) : null,
    });

    if (!resp?.ok) setError(resp?.error || "Failed");
  }

  async function cancel(slotIndex: 0 | 1) {
    if (!round?.roundId) return setError("No round yet.");
    const resp = await emitWithAck("bet:cancel", { roundId: round.roundId, slotIndex });
    if (!resp?.ok) setError(resp?.error || "Failed");
  }

  async function cashout(slotIndex: 0 | 1) {
    if (!round?.roundId) return setError("No round yet.");
    const resp = await emitWithAck("bet:cashout", { roundId: round.roundId, slotIndex });
    if (!resp?.ok) setError(resp?.error || "Failed");
  }

  const slotA = betForSlot(0);
  const slotB = betForSlot(1);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card">
        <div className="row">
          <div>
            <h3 style={{ margin: 0 }}>Crash</h3>
            <div className="badge">
              <span>Status:</span> <b>{status}</b>
            </div>
            <div style={{ marginTop: 8, color: "var(--muted)" }}>
              {!token ? (
                <>
                  No token found. Go to <Link href="/auth">/auth</Link> and login/register first.
                </>
              ) : (
                <>
                  Phase: <b>{round?.phase || "-"}</b>
                </>
              )}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 42, fontWeight: 900 }}>{Number(multiplier).toFixed(2)}x</div>
            <div style={{ color: "var(--muted)" }} className="mono">
              Round: {round?.roundId ? String(round.roundId).slice(0, 8) : "-"}…
            </div>
          </div>
        </div>
      </div>

      {error && <div className="card error">{error}</div>}

      {/* ✅ History + Graph */}
      <CrashHistory items={history} />
      <CrashGraph phase={round?.phase || "-"} points={points} crashAt={crashAt} />

      <div className="grid2">
        <BetPanel
          title="Bet A (slot 0)"
          bet={slotA}
          canBet={!!canBet}
          canCashout={!!canCashout}
          amount={amountA}
          setAmount={setAmountA}
          autoCashout={autoA}
          setAutoCashout={setAutoA}
          onPlace={() => place(0)}
          onCancel={() => cancel(0)}
          onCashout={() => cashout(0)}
          liveMultiplier={multiplier}
        />

        <BetPanel
          title="Bet B (slot 1)"
          bet={slotB}
          canBet={!!canBet}
          canCashout={!!canCashout}
          amount={amountB}
          setAmount={setAmountB}
          autoCashout={autoB}
          setAutoCashout={setAutoB}
          onPlace={() => place(1)}
          onCancel={() => cancel(1)}
          onCashout={() => cashout(1)}
          liveMultiplier={multiplier}
        />
      </div>

      <div className="card">
        <div className="row">
          <div>
            <b>Round Info</b>
            <div style={{ color: "var(--muted)", marginTop: 6 }}>
              Nonce: <span className="mono">{round?.nonce ?? "-"}</span>
              {"  |  "}
              Commit:{" "}
              <span className="mono">
                {round?.serverSeedHash ? String(round.serverSeedHash).slice(0, 14) : "-"}…
              </span>
            </div>
          </div>

          <div style={{ textAlign: "right", color: "var(--muted)" }}>
            Betting ends:{" "}
            <span className="mono">
              {round?.bettingEndsAt ? new Date(round.bettingEndsAt).toLocaleTimeString() : "-"}
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <b>Your Bets (this round)</b>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(bets, null, 2)}</pre>
      </div>
    </div>
  );
}

function BetPanel(props: {
  title: string;
  bet: any | null;
  canBet: boolean;
  canCashout: boolean;
  amount: string;
  setAmount: (v: string) => void;
  autoCashout: string;
  setAutoCashout: (v: string) => void;
  onPlace: () => void;
  onCancel: () => void;
  onCashout: () => void;
  liveMultiplier: number;
}) {
  const { title, bet, canBet, canCashout, amount, setAmount, autoCashout, setAutoCashout, onPlace, onCancel, onCashout, liveMultiplier } = props;

  const potential = useMemo(() => {
    if (!bet) return null;
    const a = Number(bet.amount || 0);
    return Math.floor(a * Number(liveMultiplier || 1));
  }, [bet, liveMultiplier]);

  const statusLine = bet
    ? `Status: ${bet.status} | Amount: ${bet.amount} | Auto: ${bet.autoCashout ?? "-"} | Payout: ${bet.payout ?? 0}`
    : "No bet placed in this slot";

  return (
    <div className="card">
      <div className="row">
        <b>{title}</b>
        {potential !== null && <span className="badge">Potential: <b>{potential}</b></span>}
      </div>

      <div style={{ marginTop: 10, color: "var(--muted)" }}>{statusLine}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
        <label>
          Amount
          <input value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>

        <label>
          Auto Cashout (optional)
          <input value={autoCashout} onChange={(e) => setAutoCashout(e.target.value)} />
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button className="btn-primary" disabled={!canBet} onClick={onPlace}>
          Place
        </button>

        <button className="btn-danger" disabled={!canBet || !bet || bet.status !== "PLACED"} onClick={onCancel}>
          Cancel
        </button>

        <button disabled={!canCashout || !bet || bet.status !== "ACTIVE"} onClick={onCashout}>
          Cashout
        </button>
      </div>
    </div>
  );
}
