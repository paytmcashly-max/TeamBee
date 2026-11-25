import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch, setApiAuthToken, setUnauthorizedHandler } from '../services/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(null);
  const [agent, setAgent] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((nextToken, nextAgent, nextTenant) => {
    setApiAuthToken(nextToken || null);
    setTokenState(nextToken || null);
    setAgent(nextAgent || null);
    setTenant(nextTenant || null);
    if (nextTenant?.slug) {
      localStorage.setItem('teambee_workspace_slug', nextTenant.slug);
    }
  }, []);

  useEffect(() => {
    let active = true;
    setUnauthorizedHandler(() => {
      if (active) applySession(null, null, null);
    });

    async function verifySession() {
      try {
        const data = await apiFetch('/api/auth/me');
        if (!active) return;
        applySession(data.token || null, data.agent, data.tenant);
      } catch {
        if (!active) return;
        applySession(null, null, null);
      } finally {
        if (active) setLoading(false);
      }
    }
    verifySession();
    return () => {
      active = false;
      setUnauthorizedHandler(null);
    };
  }, [applySession]);

  const login = async (email, password, tenantSlug = '') => {
    const slug = tenantSlug || localStorage.getItem('teambee_workspace_slug') || '';
    const payload = { email, password };
    if (slug) payload.tenantSlug = slug;

    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    applySession(data.token, data.agent, data.tenant);
    return data;
  };

  const registerTenant = async ({ businessName, adminName, email, password, slug }) => {
    const data = await apiFetch('/api/auth/register-tenant', {
      method: 'POST',
      body: JSON.stringify({ businessName, adminName, email, password, slug }),
    });

    applySession(data.token, data.agent, data.tenant);
    return data;
  };

  const logout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    applySession(null, null, null);
  };

  const updateTenantInfo = (updated) => {
    setTenant((prev) => (prev ? { ...prev, ...updated } : prev));
  };

  const role = String(agent?.role || '').toUpperCase();

  return (
    <AuthContext.Provider
      value={{
        token,
        agent,
        tenant,
        loading,
        login,
        registerTenant,
        logout,
        updateTenantInfo,
        isAdmin: role === 'ADMIN',
        isManager: role === 'ADMIN' || role === 'SUPERVISOR',
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
