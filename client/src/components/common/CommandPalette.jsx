import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  LayoutDashboard,
  Inbox,
  LifeBuoy,
  Radio,
  Sparkles,
  Users,
  Shield,
  LogOut,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

// Cmd/Ctrl+K command palette — the pattern every mature SaaS in the
// open-source study ships (Chatwoot, Twenty, Dub): one keyboard-first
// surface to JUMP (screens, chats) and ACT (open a tool, sign out).
// Mounted only inside the signed-in shell; owns its open state and
// the global shortcut listener.
export default function CommandPalette({
  onOpenDashboard,
  onOpenInbox,
  onOpenHelp,
  onOpenSettings,
  onOpenTemplates,
  onOpenBroadcasts,
  onOpenAgents,
  isAdmin,
}) {
  const { logout } = useAuth();
  const { chats, selectChat } = useChat();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open ]);

  const close = () => setOpen(false);
  const runAndClose = (fn) => () => {
    close();
    fn();
  };

  const items = useMemo(() => {
    const actions = [
      { group: 'Go to', icon: LayoutDashboard, label: 'Owner dashboard', keywords: 'home overview stats', run: runAndClose(onOpenDashboard), admin: true },
      { group: 'Go to', icon: Inbox, label: 'Inbox', keywords: 'chats conversations', run: runAndClose(onOpenInbox) },
      { group: 'Go to', icon: LifeBuoy, label: 'Help & support', keywords: 'faq support questions', run: runAndClose(onOpenHelp) },
      { group: 'Actions', icon: Radio, label: 'Send a broadcast', keywords: 'campaign bulk message', run: runAndClose(onOpenBroadcasts) },
      { group: 'Actions', icon: Sparkles, label: 'Templates', keywords: 'message template create approve', run: runAndClose(onOpenTemplates) },
      { group: 'Actions', icon: Users, label: 'Team & agents', keywords: 'invite agents roles automation', run: runAndClose(onOpenAgents), admin: true },
      { group: 'Actions', icon: Shield, label: 'WhatsApp setup & settings', keywords: 'connect number meta settings', run: runAndClose(onOpenSettings), admin: true },
      { group: 'Actions', icon: LogOut, label: 'Sign out', keywords: 'logout exit', run: runAndClose(logout) },
    ].filter((a) => !a.admin || isAdmin);

    const q = query.trim().toLowerCase();
    const match = (text) => !q || text.toLowerCase().includes(q);

    const visibleActions = actions.filter((a) => match(`${a.label} ${a.keywords}`));
    const visibleChats = (chats || [])
      .filter((c) => match(`${c.contact?.name || ''} ${c.contact?.waId || ''} ${c.lastMessagePreview || ''}`))
      .slice(0, q ? 8 : 5)
      .map((c) => ({
        group: 'Chats',
        icon: MessageSquare,
        label: c.contact?.name || c.contact?.waId || 'Chat',
        meta: c.lastMessagePreview || c.contact?.waId || '',
        run: runAndClose(() => {
          onOpenInbox();
          selectChat(c.id);
        }),
      }));

    return [...visibleActions, ...visibleChats];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, chats, isAdmin]);

  useEffect(() => {
    setActive((prev) => Math.min(prev, Math.max(0, items.length - 1)));
  }, [items.length]);

  if (!open) return null;

  const onListKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (items.length ? (i + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      items[active]?.run();
    } else if (e.key === 'Escape') {
      close();
    }
  };

  let lastGroup = null;
  return (
    <div className="cmdk-backdrop" onClick={close} role="presentation">
      <div
        className="cmdk-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onListKey}
      >
        <div className="cmdk-input-row">
          <Search size={17} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="cmdk-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Jump to a chat, screen or action…"
            aria-label="Search commands"
          />
          <span className="cmdk-esc">esc</span>
        </div>
        <div className="cmdk-list" role="listbox">
          {items.length === 0 && <div className="cmdk-empty">Nothing matches “{query}”.</div>}
          {items.map((item, i) => {
            const Icon = item.icon;
            const head = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <React.Fragment key={`${item.group}-${item.label}-${i}`}>
                {head && <div className="cmdk-group">{head}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  className={`cmdk-item${i === active ? ' active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={item.run}
                >
                  <Icon size={16} />
                  <span className="cmdk-item-main">
                    <span className="cmdk-item-label">{item.label}</span>
                    {item.meta && <span className="cmdk-item-meta">{item.meta}</span>}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <div className="cmdk-foot">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>Ctrl/⌘ K to toggle</span>
        </div>
      </div>
    </div>
  );
}
