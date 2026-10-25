import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

// Toast notifications: the app's single feedback channel. This replaces
// 22 native alert() calls — alerts block the whole UI, look alien on a
// phone, and gave success and failure the same treatment. A toast is
// non-blocking, colour-coded, and dismisses itself.
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (type, message) => {
      if (!message) return;
      idRef.current += 1;
      const id = idRef.current;
      setToasts((prev) => [...prev.slice(-2), { id, type, message: String(message) }]);
      setTimeout(() => dismiss(id), 4200);
    },
    [dismiss]
  );

  const api = {
    notify,
    error: (message) => notify('error', message),
    success: (message) => notify('success', message),
    info: (message) => notify('info', message),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} role="status">
            {t.type === 'success' ? (
              <CheckCircle2 size={17} />
            ) : t.type === 'error' ? (
              <AlertTriangle size={17} />
            ) : (
              <Info size={17} />
            )}
            <span className="toast-text">{t.message}</span>
            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
