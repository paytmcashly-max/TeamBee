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
    // A 401 from any data endpoint means the session died server-side
    // (expired, revoked, password changed). Broadcast it so AuthContext can
    // return the user to the login screen instead of leaving a zombie UI.
    try {
      const path = typeof url === 'string' ? url : url?.url || '';
      if (
        response.status === 401 &&
        path.includes('/api/') &&
        !path.includes('/api/auth/login') &&
        !path.includes('/api/auth/me')
      ) {
        window.dispatchEvent(new Event('auth:unauthorized'));
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
