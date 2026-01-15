import React, { useEffect, useMemo, useState } from "react";
import { getBase } from "../api.js";
import { makeCrashSocket } from "../socket.js";

export default function Crash({ token }) {
  const baseUrl = getBase();
  const [phase, setPhase] = useState("...");
  const [round, setRound] = useState(null);
  const [multiplier, setMultiplier] = useState(1.0);
  const [history, setHistory] = useState([]);

  const [slotA, setSlotA] = useState({ amount: 100, auto: 2.0 });
  const [slotB, setSlotB] = useState({ amount: 50, auto: null });

  const socket = useMemo(() => makeCrashSocket({ baseUrl, token: token || null }), [baseUrl, token]);

  useEffect(() => {
    socket.on("round:state", (s) => {
      setRound(s);
      setPhase(s.phase);
      if (s.phase !== "FLIGHT") setMultiplier(1.0);
    });

    socket.on("flight:tick", (t) => {
      setMultiplier(t.multiplier);
    });

    socket.on("round:crash", (c) => {
      setHistory(h => [c.crashMultiplier, ...h].slice(0, 20));
      setPhase("CRASH");
    });

    return () => socket.disconnect();
  }, [socket]);

  function place(slotIndex, amount, autoCashout) {
    socket.emit("bet:place", { roundId: round?.roundId, slotIndex, amount, autoCashout }, (r) => {
      if (!r?.ok) alert(r?.error || "Failed");
    });
  }

  function cancel(slotIndex) {
    socket.emit("bet:cancel", { roundId: round?.roundId, slotIndex }, (r) => {
      if (!r?.ok) alert(r?.error || "Failed");
    });
  }

  function cashout(slotIndex) {
    socket.emit("bet:cashout", { roundId: round?.roundId, slotIndex }, (r) => {
      if (!r?.ok) alert(r?.error || "Failed");
    });
  }

  const bettingLeftMs = round?.bettingEndsAt ? Math.max(0, round.bettingEndsAt - Date.now()) : 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
      <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>Phase: <b>{phase}</b></div>
          {phase === "BETTING" ? <div>Betting ends in: <b>{Math.ceil(bettingLeftMs/1000)}s</b></div> : null}
        </div>

        <div style={{ marginTop: 16, padding: 16, border: "1px dashed #bbb", borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 48, fontWeight: 700 }}>{multiplier.toFixed(2)}x</div>
          <div style={{ opacity: 0.7 }}>
            Round: {round?.roundId?.slice(0, 8)} | Nonce: {round?.nonce} | Seed Hash: {round?.serverSeedHash?.slice(0, 10)}…
          </div>
        </div>

        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <BetSlot
            title="Bet A"
            disabled={!token}
            phase={phase}
            state={slotA}
            onChange={setSlotA}
            onPlace={() => place(0, Number(slotA.amount), slotA.auto != null ? Number(slotA.auto) : null)}
            onCancel={() => cancel(0)}
            onCashout={() => cashout(0)}
          />
          <BetSlot
            title="Bet B"
            disabled={!token}
            phase={phase}
            state={slotB}
            onChange={setSlotB}
            onPlace={() => place(1, Number(slotB.amount), slotB.auto != null ? Number(slotB.auto) : null)}
            onCancel={() => cancel(1)}
            onCashout={() => cashout(1)}
          />
        </div>
      </div>

      <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>History</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {history.map((h, i) => (
            <span key={i} style={{ border: "1px solid #ccc", borderRadius: 999, padding: "4px 8px" }}>
              {Number(h).toFixed(2)}x
            </span>
          ))}
        </div>

        <div style={{ marginTop: 16, fontSize: 13, opacity: 0.8 }}>
          You can add a “Verify” page later using serverSeed reveal from <code>round:crash</code>.
        </div>
      </div>
    </div>
  );
}

function BetSlot({ title, disabled, phase, state, onChange, onPlace, onCancel, onCashout }) {
  const canBet = phase === "BETTING";
  const canCashout = phase === "FLIGHT";

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <b>{title}</b>
        <span style={{ opacity: 0.7 }}>{phase}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        <input
          disabled={disabled}
          type="number"
          value={state.amount}
          onChange={e => onChange(s => ({ ...s, amount: e.target.value }))}
          placeholder="amount"
        />
        <input
          disabled={disabled}
          type="number"
          value={state.auto ?? ""}
          onChange={e => onChange(s => ({ ...s, auto: e.target.value === "" ? null : e.target.value }))}
          placeholder="auto cashout (optional)"
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button disabled={disabled || !canBet} onClick={onPlace}>Place</button>
        <button disabled={disabled || !canBet} onClick={onCancel}>Cancel</button>
        <button disabled={disabled || !canCashout} onClick={onCashout}>Cashout</button>
      </div>
    </div>
  );
}
