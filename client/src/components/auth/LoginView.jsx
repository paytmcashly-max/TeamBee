import React, { useState } from 'react';
import { MessageSquare, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ForgotPasswordView from './ForgotPasswordView';

export default function LoginView() {
  const { login, registerTenant } = useAuth();
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register' | 'forgot'

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState(
    () => localStorage.getItem('teambee_workspace_slug') || ''
  );
  const [workspaceChoices, setWorkspaceChoices] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [businessName, setBusinessName] = useState('');
  const [regSlug, setRegSlug] = useState('');
  const [adminName, setAdminName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successNotice, setSuccessNotice] = useState(null);

  const handleBusinessNameChange = (e) => {
    const val = e.target.value;
    setBusinessName(val);
    setRegSlug(
      val
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50)
    );
  };

  const handleLoginSubmit = async (e, explicitSlug = null) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    const chosenSlug = explicitSlug !== null ? explicitSlug : tenantSlug.trim();

    try {
      if (rememberMe && chosenSlug) {
        localStorage.setItem('teambee_workspace_slug', chosenSlug);
      }
      await login(email, password, chosenSlug || undefined);
    } catch (err) {
      if (err.code === 'WORKSPACE_SELECTION_REQUIRED' && Array.isArray(err.data?.workspaces)) {
        setWorkspaceChoices(err.data.workspaces);
        setError('Multiple workspaces match this account. Choose your workspace below:');
      } else {
        setError(err.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (regPassword.length < 10) {
        throw new Error('Password must be at least 10 characters long');
      }
      await registerTenant({
        businessName: businessName.trim(),
        adminName: adminName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        slug: regSlug.trim() || undefined,
      });
      setSuccessNotice('Workspace created! Signing you in...');
    } catch (err) {
      setError(err.message || 'Organization registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split-wrapper" data-node-id="2:853" data-name="Access · Workspace sign in">
      <section className="auth-hero-section" data-name="TeamBee introduction">
        <div className="auth-brand-header">
          <div className="auth-brand-logo-row">
            <div className="auth-brand-icon">
              <MessageSquare size={18} />
            </div>
            <span className="auth-brand-name">TeamBee</span>
          </div>
        </div>

        <div className="auth-hero-copy">
          <span className="auth-hero-tagline">
            CUSTOMER CONVERSATIONS, BETTER TOGETHER
          </span>
          <h1 className="auth-hero-headline">
            <span>One inbox.</span>
            <span>A whole team</span>
            <span>behind every reply.</span>
          </h1>
          <p className="auth-hero-subtext">
            Turn WhatsApp conversations into lasting customer relationships.
            Together, without the chaos.
          </p>
        </div>

        <div className="auth-collab-card" data-name="Collaboration example">
          <span className="auth-collab-card-label">
            A LITTLE TEAMWORK GOES A LONG WAY
          </span>

          <div className="auth-collab-inquiry">
            <div className="collab-inquiry-top">
              <span className="collab-customer-name">Olivia Martin</span>
              <span className="collab-timestamp">Just now</span>
            </div>
            <p className="collab-message-text">
              Can I exchange my order for a smaller size?
            </p>
          </div>

          <div className="auth-collab-step-row">
            <span className="collab-arrow-down">↓</span>
            <span className="collab-step-text">
              Claimed by Maya · Private note added
            </span>
          </div>

          <div className="auth-collab-resolved">
            <span className="collab-resolved-text">
              ✓ One happy customer. Nothing missed.
            </span>
          </div>
        </div>

        <div className="auth-hero-footer">
          <span className="auth-footer-highlight">
            Built for people. Connected by official WhatsApp.
          </span>
          <span className="auth-footer-meta">
            Powered by Meta Cloud API
          </span>
        </div>
      </section>

      <section className="auth-form-section" data-name="Workspace sign-in form">
        <div className="auth-top-support-bar">
          <a
            href="mailto:support@teambee.app"
            className="auth-support-link"
            target="_blank"
            rel="noreferrer"
          >
            <span>Need a hand? Contact support</span>
            <ArrowUpRight size={14} />
          </a>
        </div>

        <div className="auth-form-container">
          <span className="auth-eyebrow">
            {authMode === 'login' ? 'WELCOME BACK' : authMode === 'register' ? 'NEW WORKSPACE' : 'ACCOUNT RECOVERY'}
          </span>
          <h2 className="auth-form-title">
            {authMode === 'login'
              ? 'Sign in to TeamBee'
              : authMode === 'register'
                ? 'Create your workspace'
                : 'Reset your password'}
          </h2>
          <p className="auth-form-subtitle">
            {authMode === 'login'
              ? 'Enter your email and password to join your team in the inbox.'
              : authMode === 'register'
                ? 'Set up a shared WhatsApp Business workspace with a 14-day trial.'
                : 'We will email you a secure single-use password reset link.'}
          </p>

          {error && <div className="tb-alert error" style={{ marginBottom: '14px' }}>{error}</div>}
          {successNotice && <div className="tb-alert success" style={{ marginBottom: '14px' }}>{successNotice}</div>}

          {authMode === 'forgot' ? (
            <ForgotPasswordView onBack={() => { setError(null); setAuthMode('login'); }} />
          ) : authMode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="auth-form">
              <div className="auth-field-group">
                <label className="auth-field-label">Work Email</label>
                <input
                  type="email"
                  required
                  className="auth-input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setWorkspaceChoices([]);
                  }}
                />
              </div>

              <div className="auth-field-group">
                <label className="auth-field-label">Password</label>
                <div className="auth-password-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="auth-input-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="auth-show-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="auth-field-group">
                <label className="auth-field-label">Workspace Slug (optional)</label>
                <input
                  type="text"
                  className="auth-input"
                  placeholder="Auto-detected if you have one workspace"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                />
              </div>

              {workspaceChoices.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {workspaceChoices.map((ws) => (
                    <button
                      key={ws.tenantId}
                      type="button"
                      className="btn btn-secondary"
                      style={{ justifyContent: 'space-between' }}
                      onClick={() => {
                        setTenantSlug(ws.slug);
                        handleLoginSubmit(null, ws.slug);
                      }}
                    >
                      <span>{ws.name} ({ws.role})</span>
                      <span className="tb-hint">{ws.slug} →</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="auth-options-row">
                <label className="auth-remember-checkbox">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember workspace</span>
                </label>
                <button
                  type="button"
                  className="auth-forgot-link"
                  onClick={() => { setError(null); setAuthMode('forgot'); }}
                >
                  Forgot password?
                </button>
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                <span>{loading ? 'Signing in...' : 'Sign in to workspace →'}</span>
              </button>

              <div className="auth-switch-mode-row">
                <span className="switch-prompt">New to TeamBee?</span>
                <button
                  type="button"
                  className="switch-action-btn"
                  onClick={() => {
                    setError(null);
                    setAuthMode('register');
                  }}
                >
                  Create a workspace ↗
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="auth-form">
              <div className="auth-field-group">
                <label className="auth-field-label">Business or Brand Name</label>
                <input
                  type="text"
                  required
                  className="auth-input"
                  placeholder="Acme Studio"
                  value={businessName}
                  onChange={handleBusinessNameChange}
                />
              </div>

              <div className="auth-field-group">
                <label className="auth-field-label">Workspace URL</label>
                <div className="auth-slug-input-wrapper">
                  <input
                    type="text"
                    required
                    className="auth-input-slug"
                    placeholder="acme-retail"
                    value={regSlug}
                    onChange={(e) => setRegSlug(e.target.value)}
                  />
                  <span className="auth-slug-suffix">.teambee.app</span>
                </div>
              </div>

              <div className="auth-field-group">
                <label className="auth-field-label">Your Full Name</label>
                <input
                  type="text"
                  required
                  className="auth-input"
                  placeholder="Maya Shah"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                />
              </div>

              <div className="auth-field-group">
                <label className="auth-field-label">Work Email</label>
                <input
                  type="email"
                  required
                  className="auth-input"
                  placeholder="maya@company.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                />
              </div>

              <div className="auth-field-group">
                <label className="auth-field-label">Password (min 10 characters)</label>
                <div className="auth-password-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={10}
                    className="auth-input-password"
                    placeholder="••••••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="auth-show-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                <span>{loading ? 'Creating workspace...' : 'Create workspace →'}</span>
              </button>

              <div className="auth-switch-mode-row">
                <span className="switch-prompt">Already have a workspace?</span>
                <button
                  type="button"
                  className="switch-action-btn"
                  onClick={() => {
                    setError(null);
                    setAuthMode('login');
                  }}
                >
                  Sign in to workspace →
                </button>
              </div>
            </form>
          )}

          <div className="auth-form-divider" />
          <p className="auth-security-subtext">
            Your team’s conversations stay isolated inside your workspace.
          </p>
          <div className="auth-legal-row">
            <span className="legal-links">Official WhatsApp Business Platform</span>
            <span className="legal-copy">© 2026 TeamBee</span>
          </div>
        </div>
      </section>
    </div>
  );
}
