const CARE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function formatTimeShort(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatRelativeListTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatDayLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((today.getTime() - target.getTime()) / 86400000);
  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatFullDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getCareWindowState(chat) {
  const anchor = chat?.lastCustomerMessageAt || chat?.lastMessageAt;
  if (!anchor) {
    return { isOpen: false, hoursRemaining: 0, isExpiringSoon: false };
  }
  const diffMs = Date.now() - new Date(anchor).getTime();
  if (diffMs >= CARE_WINDOW_MS || Number.isNaN(diffMs)) {
    return { isOpen: false, hoursRemaining: 0, isExpiringSoon: false };
  }
  const remainingMs = CARE_WINDOW_MS - Math.max(0, diffMs);
  const hoursRemaining = Math.max(1, Math.ceil(remainingMs / 3600000));
  return {
    isOpen: true,
    hoursRemaining,
    isExpiringSoon: hoursRemaining <= 4,
  };
}

export function parseJsonArray(raw, fallback = []) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function parseJsonObject(raw, fallback = {}) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function getInitials(name, fallback = '?') {
  const clean = String(name || '').trim();
  if (!clean) return fallback;
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}
