import React, { useState } from 'react';
import { KeyRound, ArrowLeft, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

// Landing spot for password-reset email links (/?reset=<token>).
// Submits to POST /api/auth/reset-password; the server consumes the
// single-use token and signs out every other session.
export default function ResetPasswordView({ token, onDone }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const inputStyle = {
    width: '100%',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-medium)',
    borderRadius: '10px',
    color: '#fff',
    padding: '11px 12px',
    fontSize: '14px',
    outline: 'none',
  };
  const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px' };

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
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '22px 16px' }}>
      <div style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '18px', padding: '26px 24px' }}>
        <span style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(37,211,102,0.12)', color: 'var(--wa-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
          <KeyRound size={19} />
        </span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '19px', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>Set a new password</h1>
        {done ? (
          <>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6, display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <CheckCircle2 size={17} style={{ color: 'var(--wa-primary)', flexShrink: 0, marginTop: '2px' }} />
              Your password has been updated and all other sessions were signed out. Sign in with your new password to continue.
            </p>
            <button onClick={onDone} className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '14px', justifyContent: 'center', marginTop: '16px' }}>
              Go to sign in
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '16px' }}>
              Choose a new password for your TeamBee account. This link can be used once.
            </p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
              <div>
                <label style={labelStyle} htmlFor="rp-password">New password</label>
                <div style={{ position: 'relative' }}>
                  <input id="rp-password" type={show ? 'text' : 'password'} style={{ ...inputStyle, paddingRight: '42px' }} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 10 characters" minLength={10} required />
                  <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '5px', display: 'flex' }}>
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label style={labelStyle} htmlFor="rp-confirm">Confirm new password</label>
                <input id="rp-confirm" type={show ? 'text' : 'password'} style={inputStyle} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type it again" minLength={10} required />
              </div>
              {error && (
                <div role="alert" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', lineHeight: 1.5 }}>
                  {error}
                </div>
              )}
              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ padding: '12px', fontSize: '14.5px', justifyContent: 'center' }}>
                {submitting ? 'Updating…' : 'Update password'}
              </button>
            </form>
            <button onClick={onDone} className="btn btn-ghost" style={{ padding: '8px 11px', fontSize: '13px', gap: '6px', marginTop: '12px' }}>
              <ArrowLeft size={14} /> Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
