import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('chatflow_token') || null);
  const [agent, setAgent] = useState(() => {
    const saved = localStorage.getItem('chatflow_agent');
    return saved ? JSON.parse(saved) : null;
  });
  const [tenant, setTenant] = useState(() => {
    const saved = localStorage.getItem('chatflow_tenant');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  // Validate session on mount
  useEffect(() => {
    async function verifySession() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          setAgent(data.agent);
          setTenant(data.tenant);
          localStorage.setItem('chatflow_agent', JSON.stringify(data.agent));
          localStorage.setItem('chatflow_tenant', JSON.stringify(data.tenant));
        } else {
          logout();
        }
      } catch (e) {
        console.warn('Session verification error:', e);
      } finally {
        setLoading(false);
      }
    }
    verifySession();
  }, [token]);

  const login = async (email, password, tenantSlug = 'apex-educare') => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, tenantSlug }),
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Login failed');
    }

    setToken(data.token);
    setAgent(data.agent);
    setTenant(data.tenant);
    localStorage.setItem('chatflow_token', data.token);
    localStorage.setItem('chatflow_agent', JSON.stringify(data.agent));
    localStorage.setItem('chatflow_tenant', JSON.stringify(data.tenant));
    return data;
  };

  const logout = () => {
    setToken(null);
    setAgent(null);
    setTenant(null);
    localStorage.removeItem('chatflow_token');
    localStorage.removeItem('chatflow_agent');
    localStorage.removeItem('chatflow_tenant');
  };

  const updateTenantInfo = (updated) => {
    setTenant((prev) => ({ ...prev, ...updated }));
    localStorage.setItem('chatflow_tenant', JSON.stringify({ ...tenant, ...updated }));
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
