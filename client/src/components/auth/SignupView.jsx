import React, { useState } from 'react';
import { MessageSquare, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { TRIAL_DAYS } from '../../data/plans';

// Public self-serve signup. Creates the workspace + first ADMIN via
// POST /api/auth/register-tenant and lands the user inside the product
// on a 14-day trial. If registration is still invite-gated on the
// server, the form says so plainly and offers an invite-code field.
export default function SignupView({ onBack, onShowLogin }) {
  const { signup } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({ businessName: '', adminName: '', email: '', password: '', inviteCode: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [inviteNeeded, setInviteNeeded] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

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
    setSubmitting(true);
    try {
      await signup(form);
      toast.success(`Welcome to TeamBee — your ${TRIAL_DAYS}-day free trial has started.`);
      // App re-renders into the product because the session is now set.
    } catch (err) {
      if (/invite-only/i.test(err.message)) {
        setInviteNeeded(true);
        setError('Public signup is not open yet for this workspace server. If you have an invite code, enter it below and try again.');
      } else {
        setError(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '22px 16px', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: '430px' }}>
        <button onClick={onBack} className="btn btn-ghost" style={{ padding: '7px 11px', fontSize: '13px', gap: '6px', marginBottom: '16px' }}>
          <ArrowLeft size={15} /> Back to home
        </button>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '18px', padding: '26px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #25D366, #128C7E)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <MessageSquare size={19} />
            </span>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 800, color: '#fff' }}>Create your workspace</h1>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '18px' }}>
            Start your {TRIAL_DAYS}-day free trial of TeamBee Pro. No card required — connect WhatsApp when you are ready.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
            <div>
              <label style={labelStyle} htmlFor="su-business">Business name</label>
              <input id="su-business" style={inputStyle} value={form.businessName} onChange={(e) => set('businessName', e.target.value)} placeholder="e.g. Apex EduCare Academy" required />
            </div>
            <div>
              <label style={labelStyle} htmlFor="su-name">Your name</label>
              <input id="su-name" style={inputStyle} value={form.adminName} onChange={(e) => set('adminName', e.target.value)} placeholder="e.g. Rahul Verma" required />
            </div>
            <div>
              <label style={labelStyle} htmlFor="su-email">Work email</label>
              <input id="su-email" type="email" style={inputStyle} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@business.com" required />
            </div>
            <div>
              <label style={labelStyle} htmlFor="su-password">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="su-password"
                  type={showPassword ? 'text' : 'password'}
                  style={{ ...inputStyle, paddingRight: '42px' }}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="At least 10 characters"
                  minLength={10}
                  required
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '5px', display: 'flex' }}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {inviteNeeded && (
              <div>
                <label style={labelStyle} htmlFor="su-invite">Invite code</label>
                <input id="su-invite" style={inputStyle} value={form.inviteCode} onChange={(e) => set('inviteCode', e.target.value)} placeholder="Enter your invite code" />
              </div>
            )}
            {error && (
              <div role="alert" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#fca5a5', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', lineHeight: 1.5 }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ padding: '12px', fontSize: '14.5px', justifyContent: 'center', marginTop: '2px' }}>
              {submitting ? 'Creating your workspace…' : `Start free ${TRIAL_DAYS}-day trial`}
            </button>
          </form>

          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '16px' }}>
            Already use TeamBee?{' '}
            <button onClick={onShowLogin} style={{ background: 'none', border: 'none', color: 'var(--wa-primary)', cursor: 'pointer', fontSize: '12.5px', fontWeight: 600 }}>
              Log in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
