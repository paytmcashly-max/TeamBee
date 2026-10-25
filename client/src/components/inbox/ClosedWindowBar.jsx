import React from 'react';
import { Clock, Sparkles } from 'lucide-react';

// Shown in place of the composer input when the Meta 24-hour window is
// closed. Outside the window a free-form WhatsApp message CANNOT be sent
// at all, so offering a text box with a warning crammed into its
// placeholder (the old design) invited the user to type, hit send, and
// eat an error. The honest design: no fake input — say the window is
// closed and give ONE action that works, sending an approved template.
// Team Notes are unaffected: they never needed the window, and the mode
// tabs above this bar still switch to them.
export default React.memo(function ClosedWindowBar({ onSendTemplate }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
        background: 'rgba(239, 68, 68, 0.06)',
        border: '1px solid rgba(239, 68, 68, 0.22)',
        borderRadius: '12px',
        padding: '10px 12px',
      }}
    >
      <div style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', flex: '1 1 220px', minWidth: 0 }}>
        <Clock size={17} style={{ color: '#f87171', flexShrink: 0, marginTop: '1px' }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#fca5a5' }}>
            24-hour window closed
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            Free messages can’t be sent to this customer right now. Send an approved template to
            restart the conversation — or switch to Team Note for an internal note.
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onSendTemplate}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          background: 'var(--wa-teal)',
          color: '#fff',
          border: 'none',
          borderRadius: '10px',
          padding: '10px 14px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          minHeight: '42px',
          flexShrink: 0,
        }}
      >
        <Sparkles size={15} />
        Send template
      </button>
    </div>
  );
});
