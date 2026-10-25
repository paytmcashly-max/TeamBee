import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ChatProvider } from './context/ChatContext';

// Direct API calls to backend cloud service when configured
const API_URL = import.meta.env.VITE_API_URL || '';
{
  const originalFetch = window.fetch;
  window.fetch = async (input, init) => {
    let url = input;
    if (typeof url === 'string' && url.startsWith('/') && API_URL) {
      url = `${API_URL.replace(/\/+$/, '')}${url}`;
    }
    const response = await originalFetch(url, { ...init, credentials: init?.credentials || 'include' });
    // A 401 from a data endpoint usually means the ACCESS token died
    // (rotated on password change, revoked, expired) — not necessarily
    // the cookie session. Logging out instantly on any 401 kicked users
    // out mid-work. Instead, silently revalidate the session once via
    // /api/auth/me: if it is alive, AuthContext refreshes the token and
    // work continues; only a failed revalidation logs the user out.
    try {
      const path = typeof url === 'string' ? url : url?.url || '';
      if (
        response.status === 401 &&
        path.includes('/api/') &&
        !path.includes('/api/auth/login') &&
        !path.includes('/api/auth/me') &&
        !window.__teambeeRevalidating
      ) {
        window.__teambeeRevalidating = (async () => {
          try {
            const meRes = await originalFetch(`${API_URL.replace(/\/+$/, '')}/api/auth/me`, {
              credentials: 'include',
            });
            if (meRes.ok) {
              window.dispatchEvent(new Event('auth:revalidate'));
            } else {
              window.dispatchEvent(new Event('auth:unauthorized'));
            }
          } catch (revalError) {
            window.dispatchEvent(new Event('auth:unauthorized'));
          } finally {
            window.__teambeeRevalidating = null;
          }
        })();
      }
    } catch (ignored) {}
    return response;
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <SocketProvider>
        <ChatProvider>
          <App />
        </ChatProvider>
      </SocketProvider>
    </AuthProvider>
  </React.StrictMode>
);
