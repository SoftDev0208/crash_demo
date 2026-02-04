/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation"; // ✅ correct import
import { apiPost, apiGet } from "@/lib/api";
import { clearToken, getToken, setToken } from "@/lib/auth";

type AuthResp = {
  token: string;
  user: { id: string; username: string; pointsBalance: string | number; referralCode?: string };
};

type MeResp = { user: AuthResp["user"] };

export default function AuthPage() {
  const router = useRouter();

  const [username, setUsername] = useState("test1");
  const [password, setPassword] = useState("1234");
  const [ref, setRef] = useState("");

  const [me, setMe] = useState<AuthResp["user"] | null>(null);
  const [error, setError] = useState("");

  async function loadMe() {
    setError("");
    const token = getToken();

    if (!token) {
      setMe(null);
      return;
    }

    try {
      const data = await apiGet<MeResp>("/api/auth/me", token);
      setMe(data.user);
    } catch (e: any) {
      // ✅ if token is invalid/expired, clear it so UI doesn't keep failing
      clearToken();
      setMe(null);
      setError(String(e?.message || e));
    }
  }

  useEffect(() => {
    void loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function register() {
    setError("");
    try {
      const data = await apiPost<
        AuthResp,
        { username: string; password: string; ref?: string }
      >("/api/auth/register", {
        username,
        password,
        ref: ref || undefined,
      });

      setToken(data.token);
      setMe(data.user);

      router.push("/"); // ✅ go to crash page after success
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }

  async function login() {
    setError("");
    try {
      const data = await apiPost<
        AuthResp,
        { username: string; password: string }
      >("/api/auth/login", { username, password });

      setToken(data.token);
      setMe(data.user);

      router.push("/"); // ✅ go to crash page after success
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }

  function logout() {
    clearToken();
    setMe(null);
    setError("");
  }

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
      <h3>Auth</h3>

      <div className="card" style={{ display: "grid", gap: 10 }}>
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>

        <label>
          Password
          <input value={password} type="password" onChange={(e) => setPassword(e.target.value)} />
        </label>

        <label>
          Referral Code (optional)
          <input value={ref} onChange={(e) => setRef(e.target.value)} />
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-primary" onClick={register}>Register</button>
          <button onClick={login}>Login</button>
          <button className="btn-danger" onClick={logout}>Logout</button>
          <button onClick={loadMe}>Refresh</button>
        </div>
      </div>

      {error && <div className="card error">{error}</div>}

      {me?.referralCode && (
        <div className="card">
          <div style={{ opacity: 0.8, marginBottom: 6 }}>Your referral code</div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 800 }}>
            {me.referralCode}
          </div>
          <div style={{ marginTop: 8, opacity: 0.85 }}>
            Points: <b>{String(me.pointsBalance ?? "-")}</b>
          </div>
        </div>
      )}

      <div className="card">
        <strong>Me</strong>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(me, null, 2)}</pre>
      </div>
    </div>
  );
}
