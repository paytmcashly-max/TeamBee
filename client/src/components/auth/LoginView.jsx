import React, { useState, useEffect } from 'react';
import { MessageSquare, ArrowRight, ArrowLeft, ChevronRight, Check, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function LoginView({ onShowSignup, onBack, onForgot } = {}) {
  const { login, lookupWorkspaces } = useAuth();
  const [email, setEmail] = useState(() => {
    try {
      return sessionStorage.getItem('teambee:lastEmail') || '';
    } catch (storageError) {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(() => {
    try {
      const switching = sessionStorage.getItem('teambee:switchWorkspace');
      if (switching) sessionStorage.removeItem('teambee:switchWorkspace');
      return switching ? 'Enter your password again to switch workspace.' : null;
    } catch (storageError) {
      return null;
    }
  });

  // Post-password picker (fallback): when sign-in was attempted without a
  // chosen workspace and the account lives in several (same password), the
  // server answers with a picker payload instead of a session.
  const [workspaces, setWorkspaces] = useState(null);
  const [selectingSlug, setSelectingSlug] = useState(null);

  // Login-page workspace discovery: when an email is entered, its active
  // workspaces are fetched from the database. Exactly one -> the chooser
  // stays hidden and the login scopes to it silently. Two or more -> a
  // chooser renders right here on the login page. A failed lookup never
  // blocks sign-in; the post-password picker above remains the fallback.
  const [emailWorkspaces, setEmailWorkspaces] = useState([]);
  const [lookupEmail, setLookupEmail] = useState('');
  const [selectedSlug, setSelectedSlug] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);

  const runLookup = async (rawEmail) => {
    const target = (rawEmail || '').trim();
    if (!target || !target.includes('@')) {
      setEmailWorkspaces([]);
      setLookupEmail(target);
      return [];
    }
    setLookingUp(true);
    try {
      const found = await lookupWorkspaces(target);
      setEmailWorkspaces(found);
      setLookupEmail(target);
      setSelectedSlug((current) =>
        current && found.some((ws) => ws.slug === current) ? current : null
      );
      return found;
    } catch (lookupError) {
      setEmailWorkspaces([]);
      setLookupEmail(target);
      return [];
    } finally {
      setLookingUp(false);
    }
  };

  // Arriving with a prefilled email (e.g. Switch workspace from the inbox):
  // discover its workspaces immediately so the chooser is already there.
  useEffect(() => {
    if (email) runLookup(email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lookupCurrent = lookupEmail === email.trim();
  const chooserWorkspaces = lookupCurrent ? emailWorkspaces : [];
  const singleWorkspaceSlug =
    chooserWorkspaces.length === 1 ? chooserWorkspaces[0].slug : null;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      // Make sure discovery ran for the email exactly as submitted.
      let available = chooserWorkspaces;
      if (!lookupCurrent) {
        available = await runLookup(email);
      }
      let chosenSlug = selectedSlug || singleWorkspaceSlug || undefined;
      if (!chosenSlug && available.length >= 2) {
        // Several workspaces and none picked yet: if they all share this
        // password the post-password picker could sort it out, but the
        // explicit on-page choice is clearer — ask for it.
        setError('Please choose your workspace above before signing in.');
        return;
      }
      const result = await login(email, password, chosenSlug);
      if (result && result.code === 'WORKSPACE_SELECTION_REQUIRED') {
        setWorkspaces(result.workspaces || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePickWorkspace = async (workspace) => {
    setSelectingSlug(workspace.slug);
    setError(null);
    try {
      await login(email, password, workspace.slug);
      // A successful login sets the session in AuthContext and App swaps
      // this view for the inbox automatically.
    } catch (err) {
      setError(err.message);
      setSelectingSlug(null);
    }
  };

  const handleBackToCredentials = () => {
    setWorkspaces(null);
    setSelectingSlug(null);
    setError(null);
    setPassword('');
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-center">
          <div className="auth-logo"><MessageSquare size={24} /></div>
          <h1>TeamBee</h1>
          <p>WhatsApp Shared Team Inbox</p>
        </div>

        {notice && !error && <div className="notice-info">{notice}</div>}
        {error && <div className="form-error" role="alert" style={{ marginBottom: 'var(--space-4)' }}>{error}</div>}

        {workspaces ? (
          <div>
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <h2 className="t-h3">Choose your workspace</h2>
              <p className="t-small" style={{ marginTop: 'var(--space-1)' }}>
                <strong style={{ color: 'var(--text-main)' }}>{email}</strong> has access to {workspaces.length} workspaces.
                Pick the one you want to open.
              </p>
            </div>

            <div className="form-stack">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.tenantId}
                  type="button"
                  className="ws-option"
                  disabled={Boolean(selectingSlug)}
                  onClick={() => handlePickWorkspace(workspace)}
                  style={selectingSlug && selectingSlug !== workspace.slug ? { opacity: 0.55 } : undefined}
                >
                  <span className="ws-avatar">{(workspace.name || 'W').trim().charAt(0).toUpperCase()}</span>
                  <span className="ws-main">
                    <span className="ws-name">{workspace.name}</span>
                    <span className="ws-meta">{workspace.displayPhoneNumber || workspace.slug}</span>
                  </span>
                  <span className={`ws-role${workspace.role === 'ADMIN' ? ' admin' : ''}`}>{workspace.role}</span>
                  {selectingSlug === workspace.slug ? (
                    <span className="t-caption" style={{ color: 'var(--wa-primary)', whiteSpace: 'nowrap' }}>Opening…</span>
                  ) : (
                    <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  )}
                </button>
              ))}
            </div>

            <button type="button" onClick={handleBackToCredentials} className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--space-4)' }}>
              <ArrowLeft size={14} /> Use different credentials
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="form-stack">
            <div className="field">
              <label className="label" htmlFor="login-email">Work email</label>
              <input
                id="login-email"
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailWorkspaces([]);
                  setLookupEmail('');
                  setSelectedSlug(null);
                }}
                onBlur={() => {
                  if (email.trim() && lookupEmail !== email.trim()) runLookup(email);
                }}
                required
                placeholder="you@business.com"
              />
            </div>

            {lookingUp && <p className="t-caption">Checking your workspaces…</p>}

            {chooserWorkspaces.length >= 2 && (
              <div className="field">
                <span className="label" id="workspace-chooser-label">Choose your workspace</span>
                <div role="radiogroup" aria-labelledby="workspace-chooser-label" className="form-stack" style={{ gap: 'var(--space-2)' }}>
                  {chooserWorkspaces.map((workspace) => {
                    const selected = selectedSlug === workspace.slug;
                    return (
                      <button
                        key={workspace.tenantId}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setSelectedSlug(workspace.slug)}
                        className={`ws-option${selected ? ' selected' : ''}`}
                      >
                        <span className="ws-avatar" style={{ width: '34px', height: '34px', minWidth: '34px', fontSize: '13px' }}>{(workspace.name || 'W').trim().charAt(0).toUpperCase()}</span>
                        <span className="ws-main">
                          <span className="ws-name">{workspace.name}</span>
                          <span className="ws-meta">{workspace.slug}</span>
                        </span>
                        {selected && <Check size={16} style={{ color: 'var(--wa-primary)', flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="field">
              <label className="label" htmlFor="login-password">Password</label>
              <div className="input-wrap">
                <input
                  id="login-password"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Your password"
                />
                <button type="button" className="input-eye" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-block btn-lg">
              {loading ? 'Signing in…' : 'Sign in'}
              <ArrowRight size={15} />
            </button>
          </form>
        )}
        {(onShowSignup || onBack) && (
          <p className="auth-links">
            New to TeamBee?{' '}
            <button type="button" className="link-btn" onClick={onShowSignup}>Start your free trial</button>
            {onBack && (
              <>
                {'  ·  '}
                <button type="button" className="link-quiet" onClick={onBack}>Back to home</button>
              </>
            )}
            {onForgot && (
              <>
                {'  ·  '}
                <button type="button" className="link-quiet" onClick={onForgot}>Forgot password?</button>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
