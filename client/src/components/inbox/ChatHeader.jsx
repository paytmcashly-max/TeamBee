import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, Check, Info, UserCheck, Clock } from 'lucide-react';

export default function ChatHeader({
  chat,
  currentAgent,
  isAdmin,
  agentsList,
  isSidebarOpen,
  onBack,
  onToggleSidebar,
  onAssign,
  onToggleResolve,
  onSnooze,
}) {
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);

  const contactName = chat.contact?.name || chat.contact?.waId || 'WhatsApp User';
  const contactPhone = chat.contact?.waId ? `+${chat.contact.waId}` : '';
  const assignedAgentName =
    agentsList.find((a) => a.id === chat.assignedAgentId)?.name ||
    chat.assignedAgent?.name ||
    (chat.assignedAgentId === currentAgent?.id ? currentAgent?.name : 'Unassigned');

  const isUnassigned = !chat.assignedAgentId || chat.status === 'UNASSIGNED';
  const isSnoozed = Boolean(chat.snoozedUntil && new Date(chat.snoozedUntil).getTime() > Date.now());

  return (
    <header className="canvas-header">
      <div className="canvas-header-left">
        <button
          type="button"
          className="canvas-back-btn"
          onClick={onBack}
          title="Back to queue"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="canvas-contact-info">
          <div className="canvas-contact-name-row">
            <h2 className="canvas-contact-name">{contactName}</h2>
            {chat.status && (
              <span className="canvas-contact-phone">· {chat.status.toLowerCase()}</span>
            )}
            {isSnoozed && (
              <span className="page-pill-badge warning" style={{ fontSize: '10px', padding: '1px 6px' }}>
                Snoozed
              </span>
            )}
          </div>
          <span className="canvas-contact-phone">{contactPhone}</span>
        </div>
      </div>

      <div className="canvas-header-actions">
        {isAdmin ? (
          <div className="canvas-assign-wrapper">
            <button
              type="button"
              className="canvas-assignee-pill"
              onClick={() => setShowAssignDropdown((prev) => !prev)}
            >
              <span className="assignee-label">Owner</span>
              <span className="assignee-name">{assignedAgentName}</span>
              <ChevronDown size={13} className="assignee-chevron" />
            </button>

            {showAssignDropdown && (
              <div className="canvas-assign-dropdown">
                <div className="assign-dropdown-header">Assign conversation</div>
                <button
                  type="button"
                  className="assign-dropdown-item"
                  onClick={() => {
                    onAssign(null);
                    setShowAssignDropdown(false);
                  }}
                >
                  <span>Unassigned pool</span>
                </button>
                {agentsList.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`assign-dropdown-item ${chat.assignedAgentId === a.id ? 'active' : ''}`}
                    onClick={() => {
                      onAssign(a.id);
                      setShowAssignDropdown(false);
                    }}
                  >
                    <span className={`agent-status-dot ${a.status?.toLowerCase() || 'offline'}`} />
                    <span className="agent-dropdown-name">{a.name}</span>
                    {chat.assignedAgentId === a.id && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : isUnassigned ? (
          <button
            type="button"
            className="canvas-claim-btn"
            onClick={() => onAssign(currentAgent?.id)}
            title="Claim this conversation"
          >
            <UserCheck size={13} style={{ marginRight: '5px', verticalAlign: '-2px' }} />
            Claim chat
          </button>
        ) : (
          <span className="canvas-assignee-pill" style={{ cursor: 'default' }}>
            <span className="assignee-label">Owner</span>
            <span className="assignee-name">{assignedAgentName}</span>
          </span>
        )}

        {onSnooze && chat.status !== 'RESOLVED' && (
          <button
            type="button"
            className="canvas-info-btn"
            onClick={() =>
              onSnooze(isSnoozed ? null : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString())
            }
            title={isSnoozed ? 'Clear snooze' : 'Snooze conversation for 2 hours'}
            style={{ width: 'auto', padding: '0 8px', fontSize: '11px', gap: '4px' }}
          >
            <Clock size={13} />
            <span>{isSnoozed ? 'Unsnooze' : '2h'}</span>
          </button>
        )}

        <button
          type="button"
          className={`canvas-resolve-btn ${chat.status === 'RESOLVED' ? 'resolved' : ''}`}
          onClick={onToggleResolve}
          title={chat.status === 'RESOLVED' ? 'Reopen conversation' : 'Mark conversation as resolved'}
        >
          {chat.status === 'RESOLVED' ? 'Reopen' : '✓ Resolve'}
        </button>

        <button
          type="button"
          className={`canvas-info-btn ${isSidebarOpen ? 'active' : ''}`}
          onClick={onToggleSidebar}
          title="Toggle customer details"
        >
          <Info size={16} />
        </button>
      </div>
    </header>
  );
}
