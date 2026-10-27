import React, { useState } from 'react';
import { MailQuestion, ArrowLeft, CheckCircle2 } from 'lucide-react';

// Self-serve "forgot password": asks the server to email a reset link.
// The server's answer is identical whether or not the email exists, and
// this screen mirrors that — it never reveals if an account was found.
// Styling: design system only (styles/components.css auth patterns).
export default function ForgotPasswordView({ onBack, onHome }) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Even on a network failure we show the same screen — the flow is
      // retried by the user, and the UI must never leak account state.
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ maxWidth: '400px' }}>
        <span className="card-icon"><MailQuestion size={19} /></span>
        <h1 className="auth-title" style={{ marginBottom: 'var(--space-2)' }}>Forgot your password?</h1>
        {sent ? (
          <>
            <p className="t-body" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
              <CheckCircle2 size={17} style={{ color: 'var(--wa-primary)', flexShrink: 0, marginTop: '3px' }} />
              If an account exists for that email, a reset link is on its way. The link works for 1 hour — check your spam folder too.
            </p>
            <button onClick={onBack} className="btn btn-primary btn-block btn-lg" style={{ marginTop: 'var(--space-4)' }}>
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <p className="auth-sub">Enter your work email and we will send you a link to set a new password.</p>
            <form onSubmit={handleSubmit} className="form-stack">
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.com"
                required
                aria-label="Work email"
              />
              <button type="submit" disabled={submitting} className="btn btn-primary btn-block btn-lg">
                {submitting ? 'Sending…' : 'Email me a reset link'}
              </button>
            </form>
            <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center', marginTop: 'var(--space-3)' }}>
              <button onClick={onBack} className="btn btn-ghost btn-sm">
                <ArrowLeft size={14} /> Back to sign in
              </button>
              {onHome && (
                <button onClick={onHome} className="btn btn-ghost btn-sm">Back to home</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
