import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch, setApiAuthToken } from '../services/apiClient';

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
    async function verifySession() {
      try {
        const data = await apiFetch('/api/auth/me');
        if (!active) return;
        setAgent(data.agent);
        setTenant(data.tenant);
      } catch {
        if (!active) return;
        setApiAuthToken(null);
        setTokenState(null);
        setAgent(null);
        setTenant(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    verifySession();
    return () => {
      active = false;
    };
  }, []);

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
