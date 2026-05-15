import { useState, useEffect } from "react";

const STORAGE_KEY = "rc_auth";
const USERNAME_KEY = "rc_username";
const PASSWORD_HASH = import.meta.env.VITE_APP_PASSWORD_HASH || "6ca13d52ca70c883e0f0bb101e425a89e8624de51db2d2392593af6a84118090";
const ALLOWED_USERS = ["tony", "ingrid"];

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export default function PasswordGate({ children }) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [storedUsername, setStoredUsername] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const name = localStorage.getItem(USERNAME_KEY);
    if (stored === PASSWORD_HASH && name && ALLOWED_USERS.includes(name)) {
      setAuthed(true);
      setStoredUsername(name);
    }
    setChecking(false);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = username.trim().toLowerCase();
    if (!name) return;
    if (!ALLOWED_USERS.includes(name)) {
      setError("Username not recognized.");
      return;
    }
    const hash = await sha256(password);
    if (hash === PASSWORD_HASH) {
      localStorage.setItem(STORAGE_KEY, hash);
      localStorage.setItem(USERNAME_KEY, name);
      setStoredUsername(name);
      setAuthed(true);
      setError("");
    } else {
      setError("Wrong password.");
      setPassword("");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USERNAME_KEY);
    setAuthed(false);
    setStoredUsername("");
    setUsername("");
    setPassword("");
    setError("");
  };

  if (checking) return null;
  if (authed) return children(handleLogout, storedUsername);

  const P = {
    bg: "#F6F3EE", surface: "#FFFFFF", border: "#E5DDD2",
    text: "#1A1714", textSec: "#7A6F60", textTer: "#AEA393",
    accent: "#6B4D30", accentSoft: "#EDE0D1",
  };

  const inputStyle = {
    width: "100%", padding: "12px 16px", borderRadius: 12,
    border: `1.5px solid ${P.border}`,
    fontSize: 15, outline: "none", boxSizing: "border-box",
    fontFamily: "'DM Sans', sans-serif", marginBottom: 12,
    transition: "border-color 0.2s",
  };

  return (
    <div style={{
      minHeight: "100vh", background: P.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap');`}</style>
      <div style={{
        background: P.surface, borderRadius: 20, padding: 36, width: 340,
        maxWidth: "90vw", textAlign: "center",
        boxShadow: "0 8px 32px rgba(26, 23, 20, 0.06)",
        border: `1px solid ${P.border}`,
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>{"📖"}</div>
        <h1 style={{
          fontFamily: "'Source Serif 4', serif", fontSize: 22, fontWeight: 700,
          margin: "0 0 6px", color: P.text,
        }}>
          Reading Companion
        </h1>
        <p style={{ fontSize: 14, color: P.textSec, marginBottom: 24 }}>
          Sign in to continue
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={username}
            onChange={e => { setUsername(e.target.value); setError(""); }}
            placeholder="Username"
            autoFocus
            autoComplete="username"
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = P.accent}
            onBlur={e => e.target.style.borderColor = P.border}
          />
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(""); }}
            placeholder="Password"
            autoComplete="current-password"
            style={{
              ...inputStyle,
              borderColor: error ? "#c44" : P.border,
            }}
            onFocus={e => { if (!error) e.target.style.borderColor = P.accent; }}
            onBlur={e => { if (!error) e.target.style.borderColor = P.border; }}
          />
          {error && (
            <div style={{ fontSize: 13, color: "#c44", marginBottom: 10 }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={!password || !username.trim()} style={{
            width: "100%", padding: "12px", borderRadius: 12, border: "none",
            background: password && username.trim() ? P.accent : P.border, color: "#FFF",
            fontSize: 15, fontWeight: 600,
            cursor: password && username.trim() ? "pointer" : "default",
            fontFamily: "'DM Sans', sans-serif", transition: "background 0.2s",
          }}>
            Log in
          </button>
        </form>
      </div>
    </div>
  );
}
