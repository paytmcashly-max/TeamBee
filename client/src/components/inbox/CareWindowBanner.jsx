import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

export default function CareWindowBanner({ isExpired, hoursRemaining, onOpenTemplatePicker }) {
  if (isExpired) {
    return (
      <div className="canvas-care-banner expired">
        <div className="care-banner-left">
          <AlertTriangle size={14} className="care-banner-icon" />
          <span>Customer care window closed · Free-form WhatsApp replies paused</span>
        </div>
        <button
          type="button"
          className="care-banner-action"
          onClick={onOpenTemplatePicker}
        >
          Send template
        </button>
      </div>
    );
  }

  return (
    <div className="canvas-care-banner active">
      <div className="care-banner-left">
        <Clock size={14} className="care-banner-icon" />
        <span>Customer care window · {hoursRemaining || 24}h left to reply directly</span>
      </div>
      <span className="care-banner-right">Meta 24h rule active</span>
    </div>
  );
}
