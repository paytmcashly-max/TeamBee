import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ChatProvider } from './context/ChatContext';

// Direct API calls to backend cloud service when configured
const API_URL = import.meta.env.VITE_API_URL || '';
if (API_URL) {
  const originalFetch = window.fetch;
  window.fetch = (input, init) => {
    if (typeof input === 'string' && input.startsWith('/')) {
      input = `${API_URL.replace(/\/+$/, '')}${input}`;
    }
    return originalFetch(input, init);
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
