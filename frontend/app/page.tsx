"use client";

import { useEffect, useMemo, useState } from "react";
import { connectCrashSocket, disconnectCrashSocket } from "@/lib/socket";
import { getToken } from "@/lib/auth";

type RoundState = {
  roundId: string;
  phase: "BETTING" | "FLIGHT" | "CRASH" | "COOLDOWN";
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  bettingEndsAt: number;
  startsAt: number;
};

type Tick = { roundId: string; multiplier: number; elapsedMs: number };

type Bet = {
  id: string;
  roundId: string;
  userId: string;
  slotIndex: number;
  amount: string | number;
  autoCashout: number | null;
  status: "PLACED" | "ACTIVE" | "CASHED_OUT" | "LOST" | "CANCELED";
  cashoutMultiplier: number | null;
  payout: string | number;
};

export default function HomePage() {
  const [token, setTokenState] = useState<string | null>(null);

  const [round, setRound] = useState<RoundState | null>(null);
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [bets, setBets] = useState<Bet[]>([]);
  const [status, setStatus] = useState<string>("Not connected");
  const [error, setError] = useState<string>("");

  // Slot inputs
  const [amountA, setAmountA] = useState("100");
  const [autoA, setAutoA] = useState<string>("");

  const [amountB, setAmountB] = useState("100");
  const [autoB, setAutoB] = useState<string>("");

  useEffect(() => {
    setTokenState(getToken());
  }, []);

  useEffect(() => {
    if (!token) return;

    const s = connectCrashSocket(token);

    s.on("connect", () => setStatus("Connected"));
    s.on("connect_error", (err: any) => setStatus(`Connect error: ${err?.message || err}`));
    s.on("disconnect", () => setStatus("Disconnected"));

    s.on("round:state", (data: any) => {
      setRound(data);
      // reset multiplier at round changes
      if (data?.phase === "BETTING" || data?.phase === "COOLDOWN") setMultiplier(1.0);
    });

    s.on("flight:tick", (t: Tick) => {
      setMultiplier(t.multiplier);
    });

    s.on("round:crash", (c: any) => {
      // keep multiplier at crash point on UI
      setMultiplier(c.crashMultiplier);
    });

    s.on("bets:update", (payload: any) => {
      setBets(payload.bets || []);
    });

    return () => {
      // don’t disconnect globally to allow fast navigation; but safe for MVP:
      disconnectCrashSocket();
    };
  }, [token]);

  const canBet = round?.phase === "BETTING";
  const canCashout = round?.phase === "FLIGHT";

  function betForSlot(slotIndex: number) {
    return bets.find((b) => b.slotIndex === slotIndex) || null;
  }

  async function emitWithAck(event: string, payload: any) {
    setError("");
    const s = connectCrashSocket(token!);
    return new Promise<any>((resolve) => {
      s.emit(event, payload, (resp: any) => resolve(resp));
    });
  }

  async function place(slotIndex: 0 | 1) {
    if (!round) return;
    const amount = slotIndex === 0 ? amountA : amountB;
    const auto = slotIndex === 0 ? autoA : autoB;

    const resp = await emitWithAck("bet:place", {
      roundId: round.roundId,
      slotIndex,
      amount: Number(amount),
      autoCashout: auto ? Number(auto) : null,
    });

    if (!resp.ok) setError(resp.error || "Failed");
  }

  async function cancel(slotIndex: 0 | 1) {
    if (!round) return;
    const resp = await emitWithAck("bet:cancel", { roundId: round.roundId, slotIndex });
    if (!resp.ok) setError(resp.error || "Failed");
  }

  async function cashout(slotIndex: 0 | 1) {
    if (!round) return;
    const resp = await emitWithAck("bet:cashout", { roundId: round.roundId, slotIndex });
    if (!resp.ok) setError(resp.error || "Failed");
  }

  const slotA = betForSlot(0);
  const slotB = betForSlot(1);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Crash</h3>
          <div style={{ opacity: 0.8 }}>{status}</div>
          {!token && (
            <div style={{ color: "crimson" }}>
              No token found. Go to <a href="/auth">/auth</a> and login/register first.
            </div>
          )}
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 32, fontWeight: 800 }}>{multiplier.toFixed(2)}x</div>
          <div style={{ opacity: 0.8 }}>
            Phase: <b>{round?.phase || "-"}</b>
          </div>
        </div>
      </div>

      {error && <pre style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{error}</pre>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <BetPanel
          title="Bet A (slot 0)"
          slotIndex={0}
          canBet={!!canBet}
          canCashout={!!canCashout}
          bet={slotA}
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
          slotIndex={1}
          canBet={!!canBet}
          canCashout={!!canCashout}
          bet={slotB}
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

      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <b>Round</b>: {round?.roundId || "-"}
            <div style={{ opacity: 0.8 }}>
              Nonce: {round?.nonce ?? "-"} | Commit: {round?.serverSeedHash?.slice(0, 12) || "-"}…
            </div>
          </div>
          <div style={{ textAlign: "right", opacity: 0.8 }}>
            Betting ends: {round?.bettingEndsAt ? new Date(round.bettingEndsAt).toLocaleTimeString() : "-"}
          </div>
        </div>
      </div>

      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <b>Your Bets (this round)</b>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(bets, null, 2)}</pre>
      </div>
    </div>
  );
}

function BetPanel(props: {
  title: string;
  slotIndex: number;
  canBet: boolean;
  canCashout: boolean;
  bet: any | null;
  amount: string;
  setAmount: (v: string) => void;
  autoCashout: string;
  setAutoCashout: (v: string) => void;
  onPlace: () => void;
  onCancel: () => void;
  onCashout: () => void;
  liveMultiplier: number;
}) {
  const { title, canBet, canCashout, bet, amount, setAmount, autoCashout, setAutoCashout, onPlace, onCancel, onCashout, liveMultiplier } = props;

  const potential = useMemo(() => {
    if (!bet) return null;
    const a = Number(bet.amount || 0);
    return Math.floor(a * liveMultiplier);
  }, [bet, liveMultiplier]);

  const statusLine = bet
    ? `Status: ${bet.status} | Amount: ${bet.amount} | Auto: ${bet.autoCashout ?? "-"} | Payout: ${bet.payout ?? 0}`
    : "No bet placed in this slot";

  return (
    <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <b>{title}</b>
        {potential !== null && <span style={{ opacity: 0.85 }}>Potential: {potential}</span>}
      </div>

      <div style={{ marginTop: 8, opacity: 0.85 }}>{statusLine}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        <label>
          Amount
          <input value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: "100%" }} />
        </label>

        <label>
          Auto Cashout (optional)
          <input value={autoCashout} onChange={(e) => setAutoCashout(e.target.value)} style={{ width: "100%" }} />
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button disabled={!canBet} onClick={onPlace}>
          Place
        </button>

        <button disabled={!canBet || !bet || bet.status !== "PLACED"} onClick={onCancel}>
          Cancel
        </button>

        <button disabled={!canCashout || !bet || bet.status !== "ACTIVE"} onClick={onCashout}>
          Cashout
        </button>
      </div>
    </div>
  );
}
