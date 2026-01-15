"use client";

import { useEffect, useState } from "react";
import { apiPost, apiGet } from "@/lib/api";
import { clearToken, getToken, setToken } from "@/lib/auth";

type AuthResp = { token: string; user: { id: string; username: string; pointsBalance: string | number } };

export default function AuthPage() {
  const [username, setUsername] = useState("test1");
  const [password, setPassword] = useState("1234");
  const [ref, setRef] = useState("");
  const [me, setMe] = useState<any>(null);
  const [error, setError] = useState("");

  async function loadMe() {
    setError("");
    const token = getToken();
    if (!token) {
      setMe(null);
      return;
    }
    try {
      const data = await apiGet<{ user: any }>("/api/auth/me", token);
      setMe(data.user);
    } catch (e: any) {
      setError(String(e.message || e));
      setMe(null);
    }
  }

  useEffect(() => {
    loadMe();
  }, []);

  async function register() {
    setError("");
    try {
      const data = await apiPost<AuthResp>("/api/auth/register", { username, password, ref: ref || undefined });
      setToken(data.token);
      await loadMe();
    } catch (e: any) {
      setError(String(e.message || e));
    }
  }

  async function login() {
    setError("");
    try {
      const data = await apiPost<AuthResp>("/api/auth/login", { username, password });
      setToken(data.token);
      await loadMe();
    } catch (e: any) {
      setError(String(e.message || e));
    }
  }

  function logout() {
    clearToken();
    setMe(null);
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
      <h3>Auth</h3>

      <label>
        Username
        <input value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: "100%" }} />
      </label>

      <label>
        Password
        <input value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%" }} />
      </label>

      <label>
        Referral Code (optional)
        <input value={ref} onChange={(e) => setRef(e.target.value)} style={{ width: "100%" }} />
      </label>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={register}>Register</button>
        <button onClick={login}>Login</button>
        <button onClick={logout}>Logout</button>
        <button onClick={loadMe}>Refresh</button>
      </div>

      {error && <pre style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{error}</pre>}

      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <strong>Me</strong>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(me, null, 2)}</pre>
      </div>
    </div>
  );
}
