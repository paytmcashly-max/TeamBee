import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const AuthContext = createContext(null);

// Reads the tokenVersion claim out of a JWT without verifying it (the
// server verifies); used to adopt a re-issued token only when it is
// actually newer, so verifySession cannot loop on its own token updates.
function tokenVersionOf(t) {
  try {
    const part = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(part));
    return payload.tv ?? 0;
  } catch (e) {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [agent, setAgent] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const verifySessionRef = useRef(null);

  // Validate session on mount
  useEffect(() => {
    async function verifySession() {
      try {
        const res = await fetch('/api/auth/me', {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (data.success) {
          setAgent(data.agent);
          setTenant(data.tenant);
          // After a reload the in-memory token is gone while the cookie
          // session lives on; /me returns a fresh token so API calls and
          // the socket can authenticate again. Without this the socket
          // connected with a null token and the "connection lost" banner
          // never cleared.
          if (data.token && (!token || tokenVersionOf(data.token) !== tokenVersionOf(token))) {
            setToken(data.token);
          }
        } else {
          setToken(null);
          setAgent(null);
          setTenant(null);
        }
      } catch (e) {
        console.warn('Session verification error:', e);
      } finally {
        setLoading(false);
      }
    }
    verifySessionRef.current = verifySession;
    verifySession();
  }, [token]);

  // The fetch wrapper in main.jsx asks for a silent revalidation when a
  // data call answers 401: refresh the session from the cookie instead
  // of logging the user out over a rotated/revoked access token.
  useEffect(() => {
    const onRevalidate = () => {
      if (verifySessionRef.current) verifySessionRef.current();
    };
    window.addEventListener('auth:revalidate', onRevalidate);
    return () => window.removeEventListener('auth:revalidate', onRevalidate);
  }, []);

  const login = async (email, password, tenantSlug) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, tenantSlug: tenantSlug || undefined }),
    });
    const data = await res.json();
    if (!data.success) {
      // Not an error: the account lives in several workspaces and the user
      // must pick one. LoginView renders the picker from this payload and
      // calls login again with the chosen workspace's slug.
      if (data.code === 'WORKSPACE_SELECTION_REQUIRED') {
        return data;
      }
      throw new Error(data.error || 'Login failed');
    }

    try {
      sessionStorage.setItem('teambee:lastEmail', email);
    } catch (storageError) {}
    setToken(data.token);
    setAgent(data.agent);
    setTenant(data.tenant);
    return data;
  };

  // Public self-serve signup: creates a new workspace (tenant) + its
  // first ADMIN and adopts the returned session exactly like login.
  const signup = async ({ businessName, adminName, email, password, inviteCode }) => {
    const res = await fetch('/api/auth/register-tenant', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName,
        adminName,
        email,
        password,
        inviteCode: inviteCode || undefined,
      }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Signup failed');
    }
    try {
      sessionStorage.setItem('teambee:lastEmail', email);
    } catch (storageError) {}
    setToken(data.token);
    setAgent(data.agent);
    setTenant(data.tenant);
    return data;
  };

  // Global session-expiry hook (dispatched by the fetch wrapper in main.jsx)
  useEffect(() => {
    const handleUnauthorized = () => {
      setToken(null);
      setAgent(null);
      setTenant(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  // Login-page workspace discovery: which active workspaces can this
  // email sign in to? The login view shows a chooser only for 2+.
  const lookupWorkspaces = async (email) => {
    const res = await fetch('/api/auth/workspaces/lookup', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Workspace lookup failed');
    }
    return data.workspaces || [];
  };

  const logout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {});
    setToken(null);
    setAgent(null);
    setTenant(null);
  };

  const changePassword = async (currentPassword, newPassword) => {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to change password');
    }
    if (data.token) setToken(data.token);
    return data;
  };

  const updateTenantInfo = (updated) => {
    setTenant((prev) => ({ ...prev, ...updated }));
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        agent,
        tenant,
        loading,
        login,
        signup,
        lookupWorkspaces,
        logout,
        changePassword,
        updateTenantInfo,
        isAdmin: agent?.role === 'ADMIN' || agent?.role === 'SUPERVISOR',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
