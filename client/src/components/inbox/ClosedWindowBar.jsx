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
// Styling: design system only (.closed-bar in styles/components.css).
export default React.memo(function ClosedWindowBar({ onSendTemplate }) {
  return (
    <div className="closed-bar">
      <div className="closed-bar-main">
        <Clock size={17} style={{ color: '#f87171', flexShrink: 0, marginTop: '1px' }} />
        <div style={{ minWidth: 0 }}>
          <div className="closed-bar-title">24-hour window closed</div>
          <div className="closed-bar-text">
            Free messages can’t be sent to this customer right now. Send an approved template to
            restart the conversation — or switch to Team Note for an internal note.
          </div>
        </div>
      </div>
      <button type="button" onClick={onSendTemplate} className="btn btn-lg" style={{ background: 'var(--wa-teal)', color: '#fff', flexShrink: 0 }}>
        <Sparkles size={15} />
        Send template
      </button>
    </div>
  );
});
