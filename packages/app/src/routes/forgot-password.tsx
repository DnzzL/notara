import { createRoute, Link } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root.js";
import { useState } from "react";
import { authClient } from "../auth-client.js";
import { toaster } from "../toaster.js";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forgot-password",
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await authClient.forgetPassword({ email, redirectTo: "/reset-password" });
      if (result.error) {
        toaster.create({ title: "Request failed", description: result.error.message ?? "Something went wrong.", type: "error" });
        return;
      }
      setSent(true);
    } catch (err: any) {
      toaster.create({ title: "Request failed", description: err.message ?? "Something went wrong.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="7" height="7" rx="2" fill="currentColor" opacity="0.9"/>
              <rect x="11" y="2" width="7" height="7" rx="2" fill="currentColor" opacity="0.5"/>
              <rect x="2" y="11" width="7" height="7" rx="2" fill="currentColor" opacity="0.5"/>
              <rect x="11" y="11" width="7" height="7" rx="2" fill="currentColor" opacity="0.25"/>
            </svg>
          </div>
          <span className="auth-brand-name">Notara</span>
        </div>

        <div className="auth-heading">
          <h1>Reset your password</h1>
          <p className="auth-subheading">
            {sent
              ? "Check your inbox for a reset link."
              : "Enter your email and we'll send a reset link."}
          </p>
        </div>

        {!sent ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="reset-email">Email</label>
              <input
                id="reset-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? <span className="auth-spinner" /> : "Send reset link"}
            </button>
          </form>
        ) : (
          <div className="auth-success-box">
            Reset email sent. Check your spam folder if you don't see it.
          </div>
        )}

        <p className="auth-footer">
          <Link to="/login" className="auth-toggle">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
