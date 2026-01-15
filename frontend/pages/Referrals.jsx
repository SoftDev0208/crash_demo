import React, { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Referrals({ token }) {
  const [data, setData] = useState(null);

  async function load() {
    if (!token) return;
    const r = await api("/api/referrals/me", { token });
    setData(r);
  }

  useEffect(() => { load(); }, [token]);

  async function checkAndPay() {
    const r = await api("/api/referrals/check-and-pay", { method: "POST", token });
    alert(`Paid now: ${r.paidNow}`);
    await load();
  }

  if (!token) return <div>Please login to use referrals.</div>;

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
      <h3 style={{ marginTop: 0 }}>Referrals</h3>
      <div>Your code: <b>{data?.referralCode}</b></div>
      <div>Referred users: <b>{data?.referredCount}</b></div>
      <div>Paid rewards: <b>{data?.paidRewards}</b></div>
      <div style={{ marginTop: 10 }}>
        <button onClick={checkAndPay}>Check & Pay Rewards</button>
      </div>
      <div style={{ marginTop: 10, fontSize: 13, opacity: 0.75 }}>
        MVP rule: when a referred user has 5 cashouts, you get +2000 points (once per referred user).
      </div>
    </div>
  );
}
