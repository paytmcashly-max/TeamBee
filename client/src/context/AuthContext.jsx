import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [agent, setAgent] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

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
    verifySession();
  }, [token]);

  const login = async (email, password, tenantSlug) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, tenantSlug: tenantSlug || undefined }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Login failed');
    }

    setToken(data.token);
    setAgent(data.agent);
    setTenant(data.tenant);
    return data;
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    setToken(null);
    setAgent(null);
    setTenant(null);
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
        logout,
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
