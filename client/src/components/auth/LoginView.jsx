import React, { useState } from 'react';
import { MessageSquare, ArrowRight, ArrowLeft, ChevronRight, Building2 } from 'lucide-react';
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
  const { login } = useAuth();
  const [email, setEmail] = useState(() => {
    try {
      return sessionStorage.getItem('teambee:lastEmail') || '';
    } catch (storageError) {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [showSlugField, setShowSlugField] = useState(false);
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

  // Two-step sign-in: credentials first; when the account exists in several
  // workspaces (same password), the server answers with a picker payload
  // instead of a session, and the user chooses where to land.
  const [workspaces, setWorkspaces] = useState(null);
  const [selectingSlug, setSelectingSlug] = useState(null);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const result = await login(email, password, tenantSlug.trim() || undefined);
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
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

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

            {showSlugField ? (
              <div>
                <label style={labelStyle} htmlFor="login-slug">
                  Workspace Slug <span style={{ fontWeight: '400', color: '#64748b' }}>(optional — jump straight to one workspace)</span>
                </label>
                <input
                  id="login-slug"
                  type="text"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  placeholder="e.g. your-business-name"
                  style={inputStyle}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowSlugField(true)}
                className="btn btn-ghost"
                style={{ alignSelf: 'flex-start', padding: '2px 4px', fontSize: '12px', color: 'var(--text-secondary)', gap: '5px' }}
              >
                <Building2 size={13} /> I have a workspace slug
              </button>
            )}

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
              Part of several workspaces? Sign in once — you will choose which one to open next.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
