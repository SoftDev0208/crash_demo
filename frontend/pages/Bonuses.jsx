import React, { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Bonuses({ token, onBalance }) {
  const [status, setStatus] = useState(null);

  async function load() {
    if (!token) return;
    const r = await api("/api/bonuses/status", { token });
    setStatus(r);
  }

  useEffect(() => { load(); }, [token]);

  async function claimDaily() {
    const r = await api("/api/bonuses/claim", { method: "POST", token, body: { type: "daily" } });
    onBalance?.(r.pointsBalance);
    await load();
  }

  if (!token) return <div>Please login to claim bonuses.</div>;

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
      <h3 style={{ marginTop: 0 }}>Bonuses</h3>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>Daily bonus: <b>{status?.daily?.amount ?? 1000}</b> points</div>
        <button disabled={!status?.daily?.available} onClick={claimDaily}>
          {status?.daily?.available ? "Claim" : "Claimed"}
        </button>
      </div>
    </div>
  );
}
