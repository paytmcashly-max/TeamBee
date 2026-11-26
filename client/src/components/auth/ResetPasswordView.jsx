import React, { useState } from 'react';
import { MessageSquare, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';

export default function ResetPasswordView({ token, onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < 10) {
      setError('Password must be at least 10 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setDone(true);
    } catch (err) {
      setError(err.message || 'Reset link is invalid or expired.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-split-wrapper">
      <section className="auth-hero-section">
        <div className="auth-brand-header">
          <div className="auth-brand-logo-row">
            <div className="auth-brand-icon">
              <MessageSquare size={18} />
            </div>
            <span className="auth-brand-name">TeamBee</span>
          </div>
        </div>
        <div className="auth-hero-copy">
          <span className="auth-hero-tagline">ACCOUNT SECURITY</span>
          <h1 className="auth-hero-headline">
            <span>Set a fresh</span>
            <span>workspace password.</span>
          </h1>
          <p className="auth-hero-subtext">
            Updating your password revokes all prior active sessions so your inbox remains protected.
          </p>
        </div>
        <div className="auth-hero-footer">
          <span className="auth-footer-highlight">Built for people. Connected by official WhatsApp.</span>
        </div>
      </section>

      <section className="auth-form-section">
        <div className="auth-mobile-brand" style={{ marginBottom: '20px' }}>
          <div className="auth-mobile-brand-icon">
            <MessageSquare size={15} />
          </div>
          <span className="auth-mobile-brand-name">TeamBee</span>
        </div>

        <div className="auth-form-container">
          <span className="auth-eyebrow">PASSWORD RESET</span>
          <h2 className="auth-form-title">Choose a new password</h2>

          {done ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '14px' }}>
              <div className="tb-alert success">
                <CheckCircle2 size={17} />
                <span>Your password was updated and older sessions were signed out.</span>
              </div>
              <button type="button" onClick={onDone} className="auth-submit-btn">
                Sign in with new password →
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form" style={{ marginTop: '14px' }}>
              {error && <div className="tb-alert error">{error}</div>}

              <div className="auth-field-group">
                <label className="auth-field-label">New Password (min 10 chars)</label>
                <div className="auth-password-wrapper">
                  <input
                    type={show ? 'text' : 'password'}
                    required
                    minLength={10}
                    className="auth-input-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                  />
                  <button type="button" className="auth-show-btn" onClick={() => setShow((v) => !v)}>
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="auth-field-group">
                <label className="auth-field-label">Confirm Password</label>
                <input
                  type={show ? 'text' : 'password'}
                  required
                  minLength={10}
                  className="auth-input"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••••••"
                />
              </div>

              <button type="submit" className="auth-submit-btn" disabled={submitting}>
                {submitting ? 'Updating...' : 'Update password →'}
              </button>
              <button type="button" className="switch-action-btn" onClick={onDone} style={{ alignSelf: 'flex-start' }}>
                ← Back to sign in
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
