import React, { useState } from 'react';
import { Search, Plus, ChevronDown, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { formatRelativeListTime, getCareWindowState, parseJsonArray } from '../../utils/formatters';

const STATUS_OPTIONS = [
  { id: 'ALL', label: 'All status' },
  { id: 'OPEN', label: 'Open' },
  { id: 'UNASSIGNED', label: 'Unassigned' },
  { id: 'RESOLVED', label: 'Resolved' },
];

export default function ConversationList({ onOpenNewChat }) {
  const { agent } = useAuth();
  const {
    chats,
    chatCounts,
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

  const [sortOrder, setSortOrder] = useState('newest');

  const sortedChats = [...chats].sort((a, b) => {
    const timeA = new Date(a.lastMessageAt || a.updatedAt || 0).getTime();
    const timeB = new Date(b.lastMessageAt || b.updatedAt || 0).getTime();
    return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
  });

  const totalCount = chatCounts?.all ?? chats.length;
  const unassignedCount = chatCounts?.unassigned ?? chats.filter((c) => c.status === 'UNASSIGNED' || !c.assignedAgentId).length;
  const mineCount = chatCounts?.mine ?? chats.filter((c) => c.assignedAgentId === agent?.id).length;

  return (
    <div className="conversation-queue" data-name="Conversation queue">
      <div className="queue-header">
        <h2 className="queue-title">Conversations</h2>
        <button
          type="button"
          className="queue-plus-btn"
          onClick={onOpenNewChat}
          title="Start new conversation"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="queue-search-wrapper">
        <div className="queue-search-box">
          <Search size={15} className="queue-search-icon" />
          <input
            type="text"
            className="queue-search-input"
            placeholder="Search name or number"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="queue-search-clear"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="queue-filter-row">
        <button
          type="button"
          className={`queue-filter-pill ${tabFilter === 'all' ? 'active' : ''}`}
          onClick={() => setTabFilter('all')}
        >
          All {totalCount}
        </button>
        <button
          type="button"
          className={`queue-filter-pill ${tabFilter === 'unassigned' ? 'active' : ''}`}
          onClick={() => setTabFilter('unassigned')}
        >
          Unassigned {unassignedCount}
        </button>
        <button
          type="button"
          className={`queue-filter-pill ${tabFilter === 'mine' ? 'active' : ''}`}
          onClick={() => setTabFilter('mine')}
        >
          Mine {mineCount}
        </button>
      </div>

      <div className="queue-status-pills">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`queue-status-chip ${statusFilter === opt.id ? 'active' : ''}`}
            onClick={() => setStatusFilter(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="queue-sort-row">
        <button
          type="button"
          className="queue-sort-btn"
          onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
          title="Toggle sort order"
        >
          <span>{sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}</span>
          <ChevronDown size={13} />
        </button>
      </div>

      <div className="queue-cards-list">
        {loadingChats && chats.length === 0 ? (
          <div className="queue-empty-state">
            <span className="queue-empty-text">Loading conversations...</span>
          </div>
        ) : sortedChats.length === 0 ? (
          <div className="queue-empty-state">
            <span className="queue-empty-title">No conversations found</span>
            <span className="queue-empty-subtitle">
              {searchQuery ? 'Try matching another name or phone number' : 'Incoming WhatsApp messages will appear here'}
            </span>
          </div>
        ) : (
          sortedChats.map((chat) => {
            const isSelected = activeChatId === chat.id;
            const contactName = chat.contact?.name || chat.contact?.waId || 'WhatsApp User';
            const timeAgo = formatRelativeListTime(chat.lastMessageAt || chat.updatedAt);
            const tags = parseJsonArray(chat.tags);
            const windowState = getCareWindowState(chat);
            const isExpired = !windowState.isOpen;
            const isUnread = (chat.unreadCount || 0) > 0;
            const isResolved = chat.status === 'RESOLVED';

            return (
              <div
                key={chat.id}
                className={`queue-card ${isSelected ? 'selected' : ''}`}
                onClick={() => selectChat(chat.id)}
              >
                {isSelected && <div className="queue-card-selection-bar" />}

                <div className="queue-card-content">
                  <div className="queue-card-top">
                    <span className="queue-card-name">{contactName}</span>
                    <span className="queue-card-time">{timeAgo}</span>
                  </div>

                  <p className="queue-card-snippet">
                    {chat.lastMessagePreview || 'No messages yet'}
                  </p>

                  <div className="queue-card-bottom">
                    <div className="queue-card-tags">
                      {tags.length > 0 ? (
                        tags.slice(0, 2).map((tag, idx) => (
                          <span
                            key={idx}
                            className={`queue-tag-pill ${tag.toLowerCase().includes('vip') ? 'vip' : 'normal'}`}
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="queue-tag-pill normal">
                          {chat.assignedAgent?.name?.split(' ')[0] || (chat.status === 'UNASSIGNED' ? 'Unassigned' : 'Customer')}
                        </span>
                      )}
                    </div>

                    <div className="queue-card-status">
                      {isExpired ? (
                        <span className="queue-badge-expired">Expired</span>
                      ) : isUnread ? (
                        <span className="queue-badge-new">● New</span>
                      ) : isResolved ? (
                        <span className="queue-badge-resolved">Resolved</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {chatPagination?.hasMore && (
          <div className="queue-pagination-wrapper">
            <button
              type="button"
              className="queue-load-more-btn"
              onClick={loadMoreChats}
              disabled={loadingChats}
            >
              {loadingChats ? 'Loading...' : 'Load more conversations'}
            </button>
          </div>
        )}
      </div>

      <div className="queue-footer">
        <span>Showing {sortedChats.length} conversations</span>
      </div>
    </div>
  );
}
