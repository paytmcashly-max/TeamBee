import React from 'react';
import { Copy } from 'lucide-react';

// Bottom action sheet for a message (long-press on touch, right-click
// on desktop). Extracted from ChatCanvas; today it carries Copy only —
// the send API has no reply-context support, so no Reply action is
// offered until the backend can honour it.
export default React.memo(function MessageActionSheet({ msg, onCopy, onClose }) {
  if (!msg) return null;
  return (
    <div className="msg-menu-backdrop" onClick={onClose}>
      <div
        className="msg-menu-sheet"
        role="menu"
        aria-label="Message actions"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="msg-menu-preview">{msg.content}</div>
        <button type="button" className="msg-menu-action" onClick={onCopy}>
          <Copy size={17} /> Copy text
        </button>
      </div>
    </div>
  );
});
