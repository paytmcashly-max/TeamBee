import React, { useState } from 'react';
import { MailQuestion, ArrowLeft, CheckCircle2 } from 'lucide-react';

// Self-serve "forgot password": asks the server to email a reset link.
// The server's answer is identical whether or not the email exists, and
// this screen mirrors that — it never reveals if an account was found.
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
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '22px 16px' }}>
      <div style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '18px', padding: '26px 24px' }}>
        <span style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(37,211,102,0.12)', color: 'var(--wa-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
          <MailQuestion size={19} />
        </span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '19px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>Forgot your password?</h1>
        {sent ? (
          <>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6, display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <CheckCircle2 size={17} style={{ color: 'var(--wa-primary)', flexShrink: 0, marginTop: '2px' }} />
              If an account exists for that email, a reset link is on its way. The link works for 1 hour — check your spam folder too.
            </p>
            <button onClick={onBack} className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '14px', justifyContent: 'center', marginTop: '16px' }}>
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '16px' }}>
              Enter your work email and we will send you a link to set a new password.
            </p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.com"
                required
                aria-label="Work email"
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-medium)', borderRadius: '10px', color: '#fff', padding: '11px 12px', fontSize: '14px', outline: 'none' }}
              />
              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ padding: '12px', fontSize: '14.5px', justifyContent: 'center' }}>
                {submitting ? 'Sending…' : 'Email me a reset link'}
              </button>
            </form>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginTop: '12px' }}>
              <button onClick={onBack} className="btn btn-ghost" style={{ padding: '8px 11px', fontSize: '13px', gap: '6px' }}>
                <ArrowLeft size={14} /> Back to sign in
              </button>
              {onHome && (
                <button onClick={onHome} className="btn btn-ghost" style={{ padding: '8px 11px', fontSize: '13px' }}>
                  Back to home
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
