import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';

export default function ForgotPasswordView({ onBack }) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
    } catch {
      // Never disclose account existence on reset failure.
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {sent ? (
        <>
          <div className="tb-alert success" style={{ alignItems: 'flex-start' }}>
            <CheckCircle2 size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              If an active workspace account matches that email, a single-use reset link has been sent (valid for 1 hour).
            </span>
          </div>
          <button type="button" onClick={onBack} className="auth-submit-btn">
            Back to sign in →
          </button>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field-group">
            <label className="auth-field-label">Work Email</label>
            <input
              type="email"
              required
              className="auth-input"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <button type="submit" className="auth-submit-btn" disabled={submitting}>
            {submitting ? 'Sending link...' : 'Email reset link →'}
          </button>

          <button
            type="button"
            className="auth-forgot-link"
            onClick={onBack}
            style={{ alignSelf: 'flex-start', marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <ArrowLeft size={13} />
            <span>Back to sign in</span>
          </button>
        </form>
      )}
    </div>
  );
}
