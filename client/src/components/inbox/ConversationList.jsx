import React from 'react';
import {
  Search,
  Check,
  CheckCheck,
  Clock,
  MessageSquare,
  User,
  Users,
  Shield,
  Filter,
  Flame,
  Radio,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';

export default function ConversationList({
  onOpenSettings,
  onOpenTemplates,
  onOpenBroadcasts,
  onOpenAgents,
}) {
  const { agent, tenant, isAdmin, logout } = useAuth();
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
  } = useChat();

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
  const filteredChats = chats.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = c.contact?.name?.toLowerCase().includes(q);
    const phoneMatch = c.contact?.waId?.includes(q);
    const previewMatch = c.lastMessagePreview?.toLowerCase().includes(q);
    return nameMatch || phoneMatch || previewMatch;
  });

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
                {isAdmin ? '👑 Tenant Admin' : 'Staff Agent'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
            {isAdmin && (
              <>
                <button
                  onClick={onOpenAgents}
                  className="btn btn-ghost"
                  style={{ padding: '6px', color: 'var(--text-secondary)' }}
                  title="Team Staff & Agents"
                >
                  <Users size={15} />
                </button>
                <button
                  onClick={onOpenSettings}
                  className="btn btn-ghost"
                  style={{ padding: '6px', color: 'var(--text-secondary)' }}
                  title="Meta API Credentials"
                >
                  <Shield size={15} />
                </button>
              </>
            )}
            <button
              onClick={onOpenTemplates}
              className="btn btn-ghost"
              style={{ padding: '6px', color: 'var(--text-secondary)' }}
              title="Approved WhatsApp Templates"
            >
              <Sparkles size={15} />
            </button>
            <button
              onClick={onOpenBroadcasts}
              className="btn btn-ghost"
              style={{ padding: '6px', color: '#38bdf8' }}
              title="Outbound Broadcast Campaigns"
            >
              <Radio size={15} />
            </button>
            <button
              onClick={logout}
              className="btn btn-ghost"
              style={{ padding: '6px', color: '#f87171' }}
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Role-Based Tabs (Mine / Unassigned / All) */}
      <div style={{ padding: '10px 16px 6px 16px' }}>
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
      <div style={{ padding: '6px 16px 10px 16px' }}>
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

      {/* Conversation Cards List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loadingChats && chats.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            Loading WhatsApp chats...
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
              <div
                key={chat.id}
                onClick={() => selectChat(chat.id)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: isSelected ? 'var(--bg-surface-active)' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--wa-primary)' : '3px solid transparent',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                  position: 'relative',
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  userSelect: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
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
                    <span
                      style={{
                        position: 'absolute',
                        bottom: '-2px',
                        right: '-2px',
                        fontSize: '8px',
                        background: '#047857',
                        color: '#fff',
                        borderRadius: '3px',
                        padding: '1px 3px',
                        fontWeight: '700',
                      }}
                    >
                      +91
                    </span>
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
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
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
