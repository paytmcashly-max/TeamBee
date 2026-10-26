import React from 'react';
import { Copy, Reply } from 'lucide-react';

// Bottom action sheet for a message (long-press on touch, right-click
// on desktop). Reply is offered only for messages Meta can quote —
// i.e. those carrying a WAMID (inbound customer messages and outbound
// ones that actually reached Meta). Notes/system rows have none.
export default React.memo(function MessageActionSheet({ msg, onCopy, onReply, onClose }) {
  if (!msg) return null;
  const canReply = Boolean(msg.waMessageId);
  return (
    <div className="msg-menu-backdrop" onClick={onClose}>
      <div
        className="msg-menu-sheet"
        role="menu"
        aria-label="Message actions"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="msg-menu-preview">{msg.content}</div>
        {canReply && onReply && (
          <button type="button" className="msg-menu-action" onClick={onReply}>
            <Reply size={17} /> Reply
          </button>
        )}
        <button type="button" className="msg-menu-action" onClick={onCopy}>
          <Copy size={17} /> Copy text
        </button>
      </div>
    </div>
  );
});
