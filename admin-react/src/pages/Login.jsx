import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";
import "./Login.css";

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(
        err.status === 401
          ? "Invalid email or password"
          : err.status === 403
            ? err.message
            : err.status === 0
              ? "Cannot connect to server"
              : "Login failed",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-bg">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
        <div className="grid-pattern" />
      </div>

      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 16V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10"
                stroke="#6366f1"
                strokeWidth="2"
              />
              <path
                d="M4 16h16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2z"
                fill="#6366f1"
              />
              <circle cx="7.5" cy="16.5" r="1.5" fill="white" />
              <circle cx="16.5" cy="16.5" r="1.5" fill="white" />
            </svg>
          </div>
          <h1>BusTrack Admin</h1>
          <p>Sign in to manage your fleet</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label>Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@bustrack.com"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" fullWidth loading={loading}>
            Sign In
          </Button>
        </form>

        <div className="login-footer">
          <p>© 2026 BusTrack. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
