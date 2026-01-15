import React, { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Leaderboard() {
  const [period, setPeriod] = useState("daily");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api(`/api/leaderboard?period=${period}`).then(r => setRows(r.rows)).catch(e => alert(e.message));
  }, [period]);

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
      <h3 style={{ marginTop: 0 }}>Leaderboard</h3>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button onClick={() => setPeriod("daily")}>Daily</button>
        <button onClick={() => setPeriod("weekly")}>Weekly</button>
        <button onClick={() => setPeriod("allTime")}>All Time</button>
      </div>
      <table width="100%" cellPadding="6" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Rank</th>
            <th align="left">User</th>
            <th align="right">Profit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.rank} style={{ borderTop: "1px solid #eee" }}>
              <td>{r.rank}</td>
              <td>{r.user}</td>
              <td align="right">{r.profit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
