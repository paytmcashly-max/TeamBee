import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Check,
  CheckCheck,
  Clock,
  MessageSquare,
  User,
  Users,
  LayoutDashboard,
  Shield,
  Filter,
  Flame,
  Radio,
  Sparkles,
  LogOut,
  ArrowLeftRight,
  MoreVertical,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useToast } from '../../context/ToastContext';

export default function ConversationList({
  onOpenSettings,
  onOpenTemplates,
  onOpenBroadcasts,
  onOpenAgents,
  onOpenDashboard,
}) {
  const { agent, tenant, isAdmin, logout } = useAuth();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);

  // The header carries only the primary action (Broadcast) plus this menu:
  // consoles (templates, team, Meta settings) and session actions (switch
  // workspace, sign out) live here instead of six competing icon buttons.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const handleSwitchWorkspace = () => {
    // Switch workspace = sign out into the picker flow with the email
    // prefilled; the password is re-entered (never kept).
    try {
      sessionStorage.setItem('teambee:switchWorkspace', '1');
      if (agent?.email) sessionStorage.setItem('teambee:lastEmail', agent.email);
    } catch (storageError) {}
    logout();
  };

  const menuItemStyle = (danger) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    padding: '9px 10px',
    fontSize: '13px',
    fontWeight: '500',
    color: danger ? '#f87171' : '#e2e8f0',
    cursor: 'pointer',
  });
  const {
    chats,
    activeChatId,
    selectChat,
    tabFilter,
    setTabFilter,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    loadingChats,
    chatPagination,
    loadMoreChats,
    mentionAlert,
    clearMentionAlert,
    snoozeChat,
    updateChatStatus,
  } = useChat();
  const [selectedTag, setSelectedTag] = useState(null);

  // Row swipe (touch): a left swipe on a conversation row reveals quick
  // actions (Snooze 1h, Resolve/Reopen). The identical actions remain one
  // tap away in the open chat's header, so nothing is swipe-only.
  const SWIPE_RAIL_W = 148;
  const [swipedChatId, setSwipedChatId] = useState(null);
  const [dragState, setDragState] = useState(null); // {id, dx} while dragging
  const swipeRef = useRef({ id: null });
  const swallowClickRef = useRef(false);
  const rowOffset = (chat) =>
    dragState?.id === chat.id
      ? dragState.dx
      : swipedChatId === chat.id
        ? -SWIPE_RAIL_W
        : 0;
  useEffect(() => {
    setSwipedChatId(null);
  }, [activeChatId]);

  const formatTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  const parseTags = (value) => {
    try {
      const parsed = value ? JSON.parse(value) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  // ⚡ Instant in-memory search filtering (0ms latency while typing)
// Distinct tags across the loaded chats (tags live on chats as a JSON
  // string array; ContactSidebar manages them per chat).
  const allTags = [...new Set(chats.flatMap((c) => parseTags(c.tags)))].sort((a, b) =>
    a.localeCompare(b)
  );

  // Recomputed only when its actual inputs change (was: every render).
  const filteredChats = useMemo(
    () =>
      chats.filter((c) => {
        if (selectedTag && !parseTags(c.tags).includes(selectedTag)) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const nameMatch = c.contact?.name?.toLowerCase().includes(q);
        const phoneMatch = c.contact?.waId?.includes(q);
        const previewMatch = c.lastMessagePreview?.toLowerCase().includes(q);
        return nameMatch || phoneMatch || previewMatch;
      }),
    [chats, selectedTag, searchQuery]
  );

  return (
    <aside className="col-conversations">
      {/* Top Header: Business Branding & Quick Action Badges */}
      <div className="conversations-header" style={{ padding: '16px 16px 12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#062B18',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)',
              }}
            >
              <MessageSquare size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: '700', fontSize: '15px', color: '#fff', letterSpacing: '-0.01em' }}>
                  {tenant?.name || 'TeamBee'}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    background: 'rgba(37, 211, 102, 0.15)',
                    color: '#25D366',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontWeight: '600',
                  }}
                >
                  Meta API
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                {tenant?.displayPhoneNumber || 'Not connected'}
              </div>
            </div>
          </div>

        </div>

        {/* Current Agent Info Strip */}
        <div
          style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              {agent?.avatarUrl ? (
                <img
                  src={agent.avatarUrl}
                  alt="Avatar"
                  style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  aria-label="Avatar"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'var(--wa-primary)',
                    color: '#06281a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: '700',
                  }}
                >
                  {(agent?.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
              )}
              <span
                style={{
                  position: 'absolute',
                  bottom: '-1px',
                  right: '-1px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#25D366',
                  border: '1.5px solid #0f1624',
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#fff', lineHeight: 1.2 }}>
                {agent?.name}
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                {isAdmin ? 'Tenant Admin' : 'Staff Agent'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {/* The one primary action that earns a permanent header slot */}
            <button
              onClick={onOpenBroadcasts}
              title="Outbound Broadcast Campaigns"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 11px',
                borderRadius: '999px',
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#38bdf8',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <Radio size={14} /> Broadcast
            </button>

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen((open) => !open)}
                className="btn btn-ghost"
                style={{ padding: '6px', color: 'var(--text-secondary)' }}
                title="More actions"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <MoreVertical size={16} />
              </button>
              {menuOpen && (
                <>
                  <div
                    onClick={() => setMenuOpen(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  />
                  <div
                    role="menu"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      right: 0,
                      minWidth: '224px',
                      background: 'var(--bg-menu)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '12px',
                      boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)',
                      padding: '6px',
                      zIndex: 50,
                    }}
                  >
                    {isAdmin && onOpenDashboard && (
                      <button
                        type="button"
                        role="menuitem"
                        style={menuItemStyle(false)}
                        onClick={() => { setMenuOpen(false); onOpenDashboard(); }}
                      >
                        <LayoutDashboard size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                        Dashboard
                      </button>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      style={menuItemStyle(false)}
                      onClick={() => { setMenuOpen(false); onOpenTemplates(); }}
                    >
                      <Sparkles size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                      Templates
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        role="menuitem"
                        style={menuItemStyle(false)}
                        onClick={() => { setMenuOpen(false); onOpenAgents(); }}
                      >
                        <Users size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                        Team &amp; Agents
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        role="menuitem"
                        style={menuItemStyle(false)}
                        onClick={() => { setMenuOpen(false); onOpenSettings(); }}
                      >
                        <Shield size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                        Meta API Settings
                      </button>
                    )}
                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '5px 4px' }} />
                    <button
                      type="button"
                      role="menuitem"
                      style={menuItemStyle(false)}
                      onClick={() => { setMenuOpen(false); handleSwitchWorkspace(); }}
                    >
                      <ArrowLeftRight size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                      Switch workspace
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      style={menuItemStyle(true)}
                      onClick={() => { setMenuOpen(false); logout(); }}
                    >
                      <LogOut size={15} style={{ flexShrink: 0 }} />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* @mention alert — a teammate tagged me in an internal note */}
      {mentionAlert && (
        <div
          style={{
            margin: '10px 16px 0 16px',
            padding: '9px 12px',
            borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.14)',
            border: '1px solid rgba(245, 158, 11, 0.45)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '12px', color: '#fcd34d', flex: 1, lineHeight: 1.45 }}>
            <strong>{mentionAlert.authorName || 'A teammate'}</strong> mentioned you in an internal note
            {mentionAlert.contactName ? (
              <>
                {' '}on <strong>{mentionAlert.contactName}</strong>
              </>
            ) : null}
            .
          </span>
          <button
            type="button"
            onClick={() => {
              selectChat(mentionAlert.chatId);
              clearMentionAlert();
            }}
            className="btn btn-ghost"
            style={{ fontSize: '11.5px', padding: '3px 8px', color: '#f59e0b', fontWeight: '700', whiteSpace: 'nowrap' }}
          >
            View
          </button>
          <button
            type="button"
            onClick={clearMentionAlert}
            className="btn btn-ghost"
            style={{ fontSize: '11.5px', padding: '3px 6px', color: 'var(--text-secondary)' }}
            aria-label="Dismiss mention alert"
          >
            ✕
          </button>
        </div>
      )}

      {/* Role-Based Tabs (Mine / Unassigned / All) */}
      <div className="list-tabs-wrap" style={{ padding: '10px 16px 6px 16px' }}>
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-surface)',
            padding: '3px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <button
            onClick={() => setTabFilter('mine')}
            style={{
              flex: 1,
              padding: '6px',
              border: 'none',
              borderRadius: '6px',
              background: tabFilter === 'mine' ? '#223252' : 'transparent',
              color: tabFilter === 'mine' ? '#fff' : 'var(--text-secondary)',
              fontWeight: tabFilter === 'mine' ? '600' : '400',
              fontSize: '12.5px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Mine
          </button>
          <button
            onClick={() => setTabFilter('unassigned')}
            style={{
              flex: 1,
              padding: '6px',
              border: 'none',
              borderRadius: '6px',
              background: tabFilter === 'unassigned' ? '#223252' : 'transparent',
              color: tabFilter === 'unassigned' ? '#fbbf24' : 'var(--text-secondary)',
              fontWeight: tabFilter === 'unassigned' ? '600' : '400',
              fontSize: '12.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              transition: 'all 0.15s',
            }}
          >
            <span>Unassigned</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => setTabFilter('all')}
              style={{
                flex: 1,
                padding: '6px',
                border: 'none',
                borderRadius: '6px',
                background: tabFilter === 'all' ? '#223252' : 'transparent',
                color: tabFilter === 'all' ? '#a5b4fc' : 'var(--text-secondary)',
                fontWeight: tabFilter === 'all' ? '600' : '400',
                fontSize: '12.5px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              All (Admin)
            </button>
          )}
        </div>
      </div>

      {/* Search Bar & Status Quick Filter */}
      <div className="list-search-wrap" style={{ padding: '6px 16px 10px 16px' }}>
        <div style={{ position: 'relative', marginBottom: '8px' }}>
          <Search
            size={15}
            style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-muted)' }}
          />
          <input
            type="search"
            className="chat-search-input"
            placeholder="Search customer name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 34px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: '#fff',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Status Pills */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
          {['OPEN', 'UNASSIGNED', 'RESOLVED', 'ALL'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '3px 8px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: statusFilter === st ? '600' : '400',
                border: '1px solid',
                borderColor: statusFilter === st ? 'rgba(255,255,255,0.25)' : 'transparent',
                background:
                  statusFilter === st
                    ? st === 'OPEN'
                      ? 'rgba(16, 185, 129, 0.2)'
                      : st === 'UNASSIGNED'
                      ? 'rgba(245, 158, 11, 0.2)'
                      : 'rgba(255,255,255,0.1)'
                    : 'transparent',
                color:
                  statusFilter === st
                    ? st === 'OPEN'
                      ? '#34d399'
                      : st === 'UNASSIGNED'
                      ? '#fbbf24'
                      : '#fff'
                    : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {st === 'ALL' ? 'Everything' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Tag filter — only rendered when tags exist */}
      {allTags.length > 0 && (
        <div className="list-tags-wrap" style={{ padding: '0 16px 8px 16px' }}>
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            <button
              onClick={() => setSelectedTag(null)}
              style={{
                padding: '3px 9px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: !selectedTag ? '600' : '400',
                border: '1px solid',
                borderColor: !selectedTag ? 'rgba(255,255,255,0.25)' : 'transparent',
                background: !selectedTag ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: !selectedTag ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              All tags
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                style={{
                  padding: '3px 9px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: selectedTag === tag ? '600' : '400',
                  border: '1px solid',
                  borderColor: selectedTag === tag ? 'rgba(167, 139, 250, 0.5)' : 'transparent',
                  background: selectedTag === tag ? 'rgba(167, 139, 250, 0.2)' : 'transparent',
                  color: selectedTag === tag ? '#c4b5fd' : 'var(--text-muted)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversation Cards List */}
      <div className="chat-list-scroll" style={{ flex: 1, overflowY: 'auto' }}>
        {loadingChats && chats.length === 0 ? (
          <div aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skel-row">
                <div className="skel skel-avatar" />
                <div className="skel-lines">
                  <div className="skel skel-line" style={{ width: '55%' }} />
                  <div className="skel skel-line" style={{ width: '82%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredChats.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <MessageSquare size={32} style={{ color: 'var(--text-muted)', marginBottom: '10px', opacity: 0.5 }} />
            <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>
              No conversations found
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {searchQuery ? 'No match for your search query.' : 'New conversations appear here when customers message your WhatsApp number.'}
            </div>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isSelected = chat.id === activeChatId;
            const parsedTags = parseTags(chat.tags);

            return (
              <div key={chat.id} style={{ position: 'relative', overflow: 'hidden' }}>
                {/* Swipe action rail: revealed by a left swipe on the row */}
                <div
                  aria-hidden={swipedChatId !== chat.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: `${SWIPE_RAIL_W}px`,
                    display: 'flex',
                  }}
                >
                  <button
                    type="button"
                    tabIndex={swipedChatId === chat.id ? 0 : -1}
                    aria-label={`Snooze conversation with ${chat.contact?.name || 'customer'} for 1 hour`}
                    onClick={() => {
                      setSwipedChatId(null);
                      snoozeChat(chat.id, new Date(Date.now() + 60 * 60 * 1000).toISOString()).catch((err) =>
                        toast.error(err.message)
                      );
                    }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '3px',
                      border: 'none',
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: '#fbbf24',
                      fontSize: '10.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    <Clock size={17} />
                    Snooze 1h
                  </button>
                  <button
                    type="button"
                    tabIndex={swipedChatId === chat.id ? 0 : -1}
                    aria-label={chat.status === 'RESOLVED' ? 'Reopen conversation' : 'Resolve conversation'}
                    onClick={() => {
                      setSwipedChatId(null);
                      updateChatStatus(chat.id, chat.status === 'RESOLVED' ? 'OPEN' : 'RESOLVED').catch((err) =>
                        toast.error(err.message)
                      );
                    }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '3px',
                      border: 'none',
                      background:
                        chat.status === 'RESOLVED' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(37, 211, 102, 0.18)',
                      color: chat.status === 'RESOLVED' ? '#60a5fa' : '#4ade80',
                      fontSize: '10.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    {chat.status === 'RESOLVED' ? <RotateCcw size={17} /> : <CheckCheck size={17} />}
                    {chat.status === 'RESOLVED' ? 'Reopen' : 'Resolve'}
                  </button>
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Conversation with ${chat.contact?.name || chat.contact?.waId || 'customer'}`}
                  onClick={() => {
                    if (swallowClickRef.current) {
                      swallowClickRef.current = false;
                      return;
                    }
                    if (swipedChatId) {
                      setSwipedChatId(null);
                      return;
                    }
                    selectChat(chat.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectChat(chat.id);
                    }
                  }}
                  onTouchStart={(e) => {
                    const t = e.touches[0];
                    swipeRef.current = {
                      id: chat.id,
                      startX: t.clientX,
                      startY: t.clientY,
                      base: swipedChatId === chat.id ? -SWIPE_RAIL_W : 0,
                      locked: null,
                    };
                  }}
                  onTouchMove={(e) => {
                    const s = swipeRef.current;
                    if (s.id !== chat.id) return;
                    const t = e.touches[0];
                    const dx = t.clientX - s.startX;
                    const dy = t.clientY - s.startY;
                    if (!s.locked) {
                      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
                        s.locked = 'v';
                        return;
                      }
                      if (Math.abs(dx) > 10) s.locked = 'h';
                    }
                    if (s.locked === 'h') {
                      const next = Math.max(-SWIPE_RAIL_W, Math.min(0, s.base + dx));
                      setDragState({ id: chat.id, dx: next });
                    }
                  }}
                  onTouchEnd={() => {
                    const s = swipeRef.current;
                    if (s.id !== chat.id) return;
                    if (s.locked === 'h') {
                      const cur = dragState?.id === chat.id ? dragState.dx : s.base;
                      setSwipedChatId(cur < -64 ? chat.id : null);
                      swallowClickRef.current = true;
                    }
                    setDragState(null);
                    swipeRef.current = { id: null };
                  }}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: isSelected ? 'var(--bg-surface-active)' : 'var(--bg-sidebar)',
                    borderLeft: isSelected ? '3px solid var(--wa-primary)' : '3px solid transparent',
                    cursor: 'pointer',
                    position: 'relative',
                    zIndex: 1,
                    transform: `translateX(${rowOffset(chat)}px)`,
                    transition:
                      dragState?.id === chat.id
                        ? 'background 0.15s ease'
                        : 'transform 0.2s ease, background 0.15s ease',
                    touchAction: 'pan-y',
                    WebkitTapHighlightColor: 'transparent',
                    userSelect: 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--bg-sidebar)';
                  }}
                >
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  {/* Avatar with country code badge */}
                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '15px',
                        fontWeight: '700',
                        color: '#94a3b8',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {chat.contact?.name ? chat.contact.name.charAt(0).toUpperCase() : 'C'}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '3px' }}>
                      <span
                        style={{
                          fontWeight: '600',
                          fontSize: '13.5px',
                          color: '#fff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '180px',
                        }}
                      >
                        {chat.contact?.name || `+${chat.contact?.waId}`}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        {chat.snoozedUntil && new Date(chat.snoozedUntil) > new Date() && (
                          <span
                            title={`Snoozed until ${new Date(chat.snoozedUntil).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px',
                              fontSize: '9.5px',
                              fontWeight: '700',
                              background: 'rgba(245, 158, 11, 0.16)',
                              color: '#f59e0b',
                              padding: '1px 5px',
                              borderRadius: '4px',
                            }}
                          >
                            <Clock size={9} /> {new Date(chat.snoozedUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                        {formatTime(chat.lastMessageAt)}
                      </span>
                    </div>

                    {/* Last message preview */}
                    <div
                      style={{
                        fontSize: '12.5px',
                        color: chat.unreadCount > 0 ? '#e2e8f0' : 'var(--text-secondary)',
                        fontWeight: chat.unreadCount > 0 ? '600' : '400',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginBottom: '6px',
                      }}
                    >
                      {chat.lastMessagePreview || 'New inquiry'}
                    </div>

                    {/* Metadata strip: Assigned Agent Chip + Status badge + Unread count */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {chat.assignedAgent ? (
                          <span
                            style={{
                              fontSize: '10.5px',
                              background: 'rgba(255, 255, 255, 0.08)',
                              color: 'var(--text-secondary)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <User size={10} />
                            {chat.assignedAgent.name.split(' ')[0]}
                          </span>
                        ) : (
                          <span className="badge badge-unassigned" style={{ fontSize: '9.5px', padding: '1px 6px' }}>
                            Unassigned
                          </span>
                        )}

                        {parsedTags.slice(0, 1).map((t) => (
                          <span
                            key={t}
                            style={{
                              fontSize: '10px',
                              background: 'rgba(56, 189, 248, 0.1)',
                              color: '#38bdf8',
                              padding: '1px 5px',
                              borderRadius: '3px',
                            }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>

                      {chat.unreadCount > 0 && (
                        <span
                          style={{
                            background: 'var(--wa-primary)',
                            color: '#062b18',
                            fontSize: '11px',
                            fontWeight: '700',
                            borderRadius: '999px',
                            padding: '1px 6px',
                            minWidth: '18px',
                            textAlign: 'center',
                          }}
                        >
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        {chatPagination?.hasMore && (
          <div style={{ padding: '10px 16px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={loadMoreChats}
              className="btn btn-secondary"
              style={{ width: '100%', fontSize: '11px', padding: '6px' }}
            >
              Load older conversations
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
