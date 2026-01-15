import React, { useState } from "react";
import Crash from "./pages/Crash.jsx";
import Leaderboard from "./pages/Leaderboard.jsx";
import Bonuses from "./pages/Bonuses.jsx";
import Referrals from "./pages/Referrals.jsx";
import { api } from "./api.js";

export default function App() {
  const [page, setPage] = useState("crash");
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [me, setMe] = useState(null);

  async function login(username, password) {
    const r = await api("/api/auth/login", { method: "POST", body: { username, password } });
    localStorage.setItem("token", r.token);
    setToken(r.token);
    setMe(r.user);
  }

  async function register(username, password, ref) {
    const r = await api("/api/auth/register", { method: "POST", body: { username, password, ref } });
    localStorage.setItem("token", r.token);
    setToken(r.token);
    setMe(r.user);
  }

  async function refreshMe() {
    if (!token) return;
    const r = await api("/api/auth/me", { token });
    setMe(r);
  }

  return (
    <div style={{ fontFamily: "system-ui", padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <h2>Crash Demo (Points)</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setPage("crash")}>Crash</button>
        <button onClick={() => setPage("leaderboard")}>Leaderboard</button>
        <button onClick={() => setPage("bonuses")}>Bonuses</button>
        <button onClick={() => setPage("referrals")}>Referrals</button>
        <div style={{ marginLeft: "auto" }}>
          {token ? (
            <>
              <button onClick={refreshMe}>Refresh</button>{" "}
              <button onClick={() => { localStorage.removeItem("token"); setToken(""); setMe(null); }}>
                Logout
              </button>
            </>
          ) : null}
        </div>
      </div>

      {!token ? (
        <AuthPanel onLogin={login} onRegister={register} />
      ) : (
        <div style={{ marginBottom: 12 }}>
          Logged in as <b>{me?.username || "..."}</b> | Balance: <b>{me?.pointsBalance ?? "..."}</b>
        </div>
      )}

      {page === "crash" && <Crash token={token} onBalance={(b) => setMe(m => m ? ({...m, pointsBalance: b}) : m)} />}
      {page === "leaderboard" && <Leaderboard />}
      {page === "bonuses" && <Bonuses token={token} onBalance={(b) => setMe(m => m ? ({...m, pointsBalance: b}) : m)} />}
      {page === "referrals" && <Referrals token={token} />}
    </div>
  );
}

function AuthPanel({ onLogin, onRegister }) {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [ref, setRef] = useState("");
  const [err, setErr] = useState("");

  return (
    <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8, marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input placeholder="username" value={username} onChange={e=>setU(e.target.value)} />
        <input placeholder="password" type="password" value={password} onChange={e=>setP(e.target.value)} />
        <input placeholder="ref code (optional)" value={ref} onChange={e=>setRef(e.target.value)} />
        <button onClick={async ()=>{ setErr(""); try { await onLogin(username, password); } catch(e){ setErr(e.message); }}}>
          Login
        </button>
        <button onClick={async ()=>{ setErr(""); try { await onRegister(username, password, ref || undefined); } catch(e){ setErr(e.message); }}}>
          Register
        </button>
      </div>
      {err ? <div style={{ color: "crimson", marginTop: 8 }}>{err}</div> : null}
    </div>
  );
}
