import React, { useState, useEffect } from 'react';
import { MessageSquare, ArrowRight, ArrowLeft, ChevronRight, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const inputStyle = {
  width: '100%',
  background: '#0b1120',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: '8px',
  padding: '12px 14px',
  color: '#fff',
  outline: 'none',
};

const labelStyle = {
  display: 'block',
  fontSize: '12px',
  fontWeight: '600',
  color: '#cbd5e1',
  marginBottom: '4px',
};

export default function LoginView() {
  const { login, lookupWorkspaces } = useAuth();
  const [email, setEmail] = useState(() => {
    try {
      return sessionStorage.getItem('teambee:lastEmail') || '';
    } catch (storageError) {
      return '';
    }
  });
  const [password, setPassword] = useState('');
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
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: '#070a12',
        position: 'relative',
        overflow: 'hidden',
        backgroundImage:
          'radial-gradient(circle at 50% 20%, rgba(37, 211, 102, 0.08) 0%, transparent 60%), radial-gradient(circle at 80% 80%, rgba(99, 102, 241, 0.06) 0%, transparent 50%)',
      }}
    >
      <div
        style={{
          width: '90%',
          maxWidth: '460px',
          background: 'rgba(17, 24, 39, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#062B18',
              margin: '0 auto 14px auto',
              boxShadow: '0 8px 24px rgba(37, 211, 102, 0.35)',
            }}
          >
            <MessageSquare size={28} />
          </div>
          <h1 style={{ fontSize: '22px', color: '#fff', fontWeight: '800' }}>TeamBee</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            B2B Multi-Agent WhatsApp Shared Team Inbox
          </p>
        </div>

        {notice && !error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#7dd3fc',
              fontSize: '12.5px',
              marginBottom: '16px',
            }}
          >
            {notice}
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              fontSize: '12.5px',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        {workspaces ? (
          /* ---------- Step 2: workspace picker ---------- */
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', color: '#fff', fontWeight: '700' }}>Choose your workspace</h2>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                <strong style={{ color: '#cbd5e1' }}>{email}</strong> has access to {workspaces.length} workspaces.
                Pick the one you want to open.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {workspaces.map((workspace) => (
                <button
                  key={workspace.tenantId}
                  type="button"
                  disabled={Boolean(selectingSlug)}
                  onClick={() => handlePickWorkspace(workspace)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    textAlign: 'left',
                    background: '#0b1120',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    padding: '13px 14px',
                    cursor: selectingSlug ? 'wait' : 'pointer',
                    opacity: selectingSlug && selectingSlug !== workspace.slug ? 0.55 : 1,
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(37, 211, 102, 0.55)';
                    e.currentTarget.style.background = 'rgba(37, 211, 102, 0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                    e.currentTarget.style.background = '#0b1120';
                  }}
                >
                  <span
                    style={{
                      width: '42px',
                      height: '42px',
                      minWidth: '42px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#25D366',
                    }}
                  >
                    {(workspace.name || 'W').trim().charAt(0).toUpperCase()}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '700',
                        color: '#fff',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {workspace.name}
                    </span>
                    <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {workspace.displayPhoneNumber || workspace.slug}
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      letterSpacing: '0.4px',
                      background: workspace.role === 'ADMIN' ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255,255,255,0.08)',
                      color: workspace.role === 'ADMIN' ? '#a5b4fc' : '#94a3b8',
                      padding: '3px 7px',
                      borderRadius: '4px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {workspace.role}
                  </span>
                  {selectingSlug === workspace.slug ? (
                    <span style={{ fontSize: '11.5px', color: '#25D366', whiteSpace: 'nowrap' }}>Opening…</span>
                  ) : (
                    <ChevronRight size={16} style={{ color: '#64748b', flexShrink: 0 }} />
                  )}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleBackToCredentials}
              className="btn btn-ghost"
              style={{ marginTop: '18px', padding: '6px 8px', fontSize: '12.5px', color: 'var(--text-secondary)', gap: '6px' }}
            >
              <ArrowLeft size={14} /> Use different credentials
            </button>
          </div>
        ) : (
          /* ---------- Step 1: credentials ---------- */
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle} htmlFor="login-email">Staff Email Address</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  // Discovery results belong to the previous email only.
                  setEmailWorkspaces([]);
                  setLookupEmail('');
                  setSelectedSlug(null);
                }}
                onBlur={() => {
                  if (email.trim() && lookupEmail !== email.trim()) runLookup(email);
                }}
                required
                style={inputStyle}
              />
            </div>

            {lookingUp && (
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '-6px' }}>
                Checking your workspaces…
              </p>
            )}

            {chooserWorkspaces.length >= 2 && (
              <div>
                <span style={labelStyle} id="workspace-chooser-label">Choose your workspace</span>
                <div role="radiogroup" aria-labelledby="workspace-chooser-label" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {chooserWorkspaces.map((workspace) => {
                    const selected = selectedSlug === workspace.slug;
                    return (
                      <button
                        key={workspace.tenantId}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setSelectedSlug(workspace.slug)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '11px',
                          width: '100%',
                          textAlign: 'left',
                          background: selected ? 'rgba(37, 211, 102, 0.07)' : '#0b1120',
                          border: selected
                            ? '1px solid rgba(37, 211, 102, 0.6)'
                            : '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '10px',
                          padding: '11px 13px',
                          cursor: 'pointer',
                        }}
                      >
                        <span
                          style={{
                            width: '36px',
                            height: '36px',
                            minWidth: '36px',
                            borderRadius: '9px',
                            background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            fontWeight: '700',
                            color: '#25D366',
                          }}
                        >
                          {(workspace.name || 'W').trim().charAt(0).toUpperCase()}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span
                            style={{
                              display: 'block',
                              fontSize: '13.5px',
                              fontWeight: '700',
                              color: '#fff',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {workspace.name}
                          </span>
                          <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px' }}>
                            {workspace.slug}
                          </span>
                        </span>
                        {selected && <Check size={16} style={{ color: '#25D366', flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label style={labelStyle} htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '13.5px', marginTop: '6px' }}
            >
              {loading ? 'Authenticating...' : 'Sign In to WhatsApp Inbox'}
              <ArrowRight size={15} />
            </button>

            <p style={{ fontSize: '11.5px', color: '#64748b', textAlign: 'center', lineHeight: 1.5 }}>
              Part of several workspaces? Enter your email and pick yours above — a single workspace is selected automatically.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
