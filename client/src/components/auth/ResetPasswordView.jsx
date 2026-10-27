import React, { useState } from 'react';
import { KeyRound, ArrowLeft, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

// Landing spot for password-reset email links (/?reset=<token>).
// Submits to POST /api/auth/reset-password; the server consumes the
// single-use token and signs out every other session.
// Styling: design system only (styles/components.css auth patterns).
export default function ResetPasswordView({ token, onDone }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Reset failed');
      setDone(true);
      toast.success('Password updated — please sign in with your new password.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ maxWidth: '400px' }}>
        <span className="card-icon"><KeyRound size={19} /></span>
        <h1 className="auth-title" style={{ marginBottom: 'var(--space-2)' }}>Set a new password</h1>
        {done ? (
          <>
            <p className="t-body" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
              <CheckCircle2 size={17} style={{ color: 'var(--wa-primary)', flexShrink: 0, marginTop: '3px' }} />
              Your password has been updated and all other sessions were signed out. Sign in with your new password to continue.
            </p>
            <button onClick={onDone} className="btn btn-primary btn-block btn-lg" style={{ marginTop: 'var(--space-4)' }}>
              Go to sign in
            </button>
          </>
        ) : (
          <>
            <p className="auth-sub">Choose a new password for your TeamBee account. This link can be used once.</p>
            <form onSubmit={handleSubmit} className="form-stack">
              <div className="field">
                <label className="label" htmlFor="rp-password">New password</label>
                <div className="input-wrap">
                  <input id="rp-password" className="input" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 10 characters" minLength={10} required />
                  <button type="button" className="input-eye" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="field">
                <label className="label" htmlFor="rp-confirm">Confirm new password</label>
                <input id="rp-confirm" className="input" type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type it again" minLength={10} required />
              </div>
              {error && <div role="alert" className="form-error">{error}</div>}
              <button type="submit" disabled={submitting} className="btn btn-primary btn-block btn-lg">
                {submitting ? 'Updating…' : 'Update password'}
              </button>
            </form>
            <button onClick={onDone} className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--space-3)' }}>
              <ArrowLeft size={14} /> Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
