import React from 'react';
import { formatDayLabel } from '../../utils/formatters';
import MessageBubble from './MessageBubble';

export default function MessageList({
  containerRef,
  messages,
  loadingMessages,
  hasMore,
  loadingOlder,
  onLoadOlder,
  typingUsers,
  contactName,
  onReply,
}) {
  const activeTypers = Object.entries(typingUsers || {})
    .filter(([, isTyping]) => Boolean(isTyping))
    .map(([name]) => name);

  let lastDayLabel = '';

  return (
    <div className="canvas-messages-container" ref={containerRef}>
      {hasMore && (
        <div className="canvas-load-older-row">
          <button
            type="button"
            className="canvas-load-older-btn"
            onClick={onLoadOlder}
            disabled={loadingOlder}
          >
            {loadingOlder ? 'Loading history...' : 'Load older messages'}
          </button>
        </div>
      )}

      {loadingMessages && messages.length === 0 ? (
        <div className="canvas-loading-messages">
          <span>Loading conversation history...</span>
        </div>
      ) : messages.length === 0 ? (
        <div className="canvas-loading-messages">
          <span>No messages yet. Say hello or send an approved template.</span>
        </div>
      ) : (
        messages.map((msg, index) => {
          const dayLabel = formatDayLabel(msg.createdAt) || 'Recent';
          const showDivider = dayLabel !== lastDayLabel;
          lastDayLabel = dayLabel;

          return (
            <React.Fragment key={msg.id || msg.clientMessageId || index}>
              {showDivider && (
                <div className="canvas-date-separator">
                  <span>{dayLabel}</span>
                </div>
              )}
              <MessageBubble msg={msg} contactName={contactName} onReply={onReply} />
            </React.Fragment>
          );
        })
      )}

      {activeTypers.length > 0 && (
        <div className="canvas-typing-row">
          <span>
            {activeTypers.join(', ')} {activeTypers.length === 1 ? 'is' : 'are'} typing...
          </span>
        </div>
      )}
    </div>
  );
}
