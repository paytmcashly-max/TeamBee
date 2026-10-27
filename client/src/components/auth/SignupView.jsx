import React, { useState } from 'react';
import { MessageSquare, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PLANS, TRIAL_DAYS } from '../../data/plans';

// Public self-serve signup. Creates the workspace + first ADMIN via
// POST /api/auth/register-tenant and lands the user inside the product
// on a 14-day trial. If registration is still invite-gated on the
// server, the form says so plainly and offers an invite-code field.
// Styling: design system only (styles/components.css auth patterns).
export default function SignupView({ onBack, onShowLogin, initialPlan = 'PRO', onShowTerms, onShowPrivacy }) {
  const { signup } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({ businessName: '', adminName: '', email: '', password: '', inviteCode: '' });
  // The plan chosen here (preselected from the pricing section) is what
  // applies when the trial ends; the trial itself always runs on Pro.
  const [plan, setPlan] = useState(() => (PLANS.some((p) => p.key === initialPlan) ? initialPlan : 'PRO'));
  const selectedPlan = PLANS.find((p) => p.key === plan) || PLANS[PLANS.length - 1];
  const [showPassword, setShowPassword] = useState(false);
  const [inviteNeeded, setInviteNeeded] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signup({ ...form, plan });
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
    <div className="auth-shell">
      <div style={{ width: '100%', maxWidth: '430px' }}>
        <button onClick={onBack} className="btn btn-ghost btn-sm" style={{ marginBottom: 'var(--space-4)' }}>
          <ArrowLeft size={15} /> Back to home
        </button>
        <div className="auth-card" style={{ maxWidth: 'none' }}>
          <div className="auth-brand">
            <span className="brand-mark"><MessageSquare size={18} /></span>
            <h1 className="auth-title">Create your workspace</h1>
          </div>
          <p className="auth-sub">
            Start your {TRIAL_DAYS}-day free trial — every workspace gets full Pro features during the trial.
            Afterwards your <strong style={{ color: 'var(--text-main)' }}>{selectedPlan.name}</strong> plan
            (₹{selectedPlan.price.toLocaleString('en-IN')}/month + GST) applies unless you change it.
            No card required — connect WhatsApp when you are ready.
          </p>

          <form onSubmit={handleSubmit} className="form-stack">
            <div className="field">
              <label className="label" htmlFor="su-business">Business name</label>
              <input id="su-business" className="input" value={form.businessName} onChange={(e) => set('businessName', e.target.value)} placeholder="e.g. Apex EduCare Academy" required />
            </div>
            <div className="field">
              <label className="label" htmlFor="su-name">Your name</label>
              <input id="su-name" className="input" value={form.adminName} onChange={(e) => set('adminName', e.target.value)} placeholder="e.g. Rahul Verma" required />
            </div>
            <div className="field">
              <label className="label" htmlFor="su-email">Work email</label>
              <input id="su-email" type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@business.com" required />
            </div>
            <div className="field">
              <label className="label" htmlFor="su-password">Password</label>
              <div className="input-wrap">
                <input
                  id="su-password"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="At least 10 characters"
                  minLength={10}
                  required
                />
                <button type="button" className="input-eye" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="field">
              <span className="label" id="su-plan-label">Your plan after the trial</span>
              <div role="radiogroup" aria-labelledby="su-plan-label" className="plan-pick">
                {PLANS.map((p) => {
                  const selected = plan === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setPlan(p.key)}
                      className={`plan-option${selected ? ' selected' : ''}`}
                    >
                      <span className="po-main">
                        <span className="po-name">
                          {p.name}
                          {p.popular && <span className="badge badge-green" style={{ marginLeft: 'var(--space-2)', verticalAlign: '2px' }}>MOST POPULAR</span>}
                        </span>
                        <span className="po-meta">{p.features[0]} included</span>
                      </span>
                      <span className="po-price">₹{p.price.toLocaleString('en-IN')}<span>/mo</span></span>
                    </button>
                  );
                })}
              </div>
            </div>
            {inviteNeeded && (
              <div className="field">
                <label className="label" htmlFor="su-invite">Invite code</label>
                <input id="su-invite" className="input" value={form.inviteCode} onChange={(e) => set('inviteCode', e.target.value)} placeholder="Enter your invite code" />
              </div>
            )}
            {error && <div role="alert" className="form-error">{error}</div>}
            <button type="submit" disabled={submitting} className="btn btn-primary btn-block btn-lg">
              {submitting ? 'Creating your workspace…' : `Start free ${TRIAL_DAYS}-day trial`}
            </button>
          </form>

          {(onShowTerms || onShowPrivacy) && (
            <p className="auth-foot">
              By creating your workspace you agree to our{' '}
              <button type="button" className="link-quiet" onClick={onShowTerms}>Terms of Service</button>{' '}
              and{' '}
              <button type="button" className="link-quiet" onClick={onShowPrivacy}>Privacy Policy</button>.
            </p>
          )}

          <p className="auth-links">
            Already use TeamBee?{' '}
            <button onClick={onShowLogin} className="link-btn">Log in</button>
          </p>
        </div>
      </div>
    </div>
  );
}
