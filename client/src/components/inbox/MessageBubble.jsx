import React from 'react';
import { Clock, Check, CheckCheck, AlertTriangle, FileText, Download, Lock, CornerUpLeft } from 'lucide-react';
import { buildApiUrl } from '../../services/apiClient';
import { formatTimeShort, parseJsonArray, parseJsonObject } from '../../utils/formatters';

function renderDeliveryStatus(status) {
  switch (status) {
    case 'PENDING':
      return <Clock size={11} className="msg-status-icon pending" title="Sending..." />;
    case 'SENT':
      return <Check size={12} className="msg-status-icon sent" title="Sent" />;
    case 'DELIVERED':
      return <CheckCheck size={12} className="msg-status-icon delivered" title="Delivered" />;
    case 'READ':
      return <CheckCheck size={12} className="msg-status-icon read" title="Read" />;
    case 'FAILED':
      return <AlertTriangle size={12} className="msg-status-icon failed" title="Delivery failed" />;
    default:
      return null;
  }
}

export default function MessageBubble({ msg, contactName, onReply }) {
  const timeText = formatTimeShort(msg.createdAt);

  if (msg.senderType === 'SYSTEM') {
    return (
      <div className="canvas-system-row">
        <span className="canvas-system-pill">
          {msg.content} · {timeText}
        </span>
      </div>
    );
  }

  const isInternalNote = Boolean(msg.isInternal || msg.senderType === 'NOTE' || msg.messageType === 'NOTE');
  if (isInternalNote) {
    const author = msg.senderAgent?.name || 'Teammate';
    return (
      <div className="canvas-note-row">
        <div className="canvas-note-card">
          <div className="note-card-header">
            <Lock size={11} />
            <span>INTERNAL NOTE · {author.toUpperCase()}</span>
            <span style={{ marginLeft: 'auto', fontWeight: 400 }}>{timeText}</span>
          </div>
          <div className="note-card-body">{msg.content}</div>
        </div>
      </div>
    );
  }

  const isOutbound = msg.direction === 'OUTBOUND' || msg.senderType === 'AGENT';
  const rawMedia = msg.mediaUrl || (msg.mediaId && msg.id ? `/api/messages/media/${msg.id}` : null);
  const resolvedMediaUrl = rawMedia ? buildApiUrl(rawMedia) : null;
  const parsedPayload = parseJsonObject(msg.rawPayload);
  const buttons = parseJsonArray(msg.buttons || parsedPayload.buttons);
  const replyQuote = msg.replyTo || parsedPayload.replyTo || null;

  return (
    <div className={`canvas-msg-row ${isOutbound ? 'outbound' : 'inbound'}`}>
      <div className={`canvas-msg-bubble ${isOutbound ? 'outbound' : 'inbound'}`}>
        {isOutbound && msg.senderAgent?.name && (
          <div className="msg-sender-name">{msg.senderAgent.name}</div>
        )}
        {!isOutbound && contactName && (
          <div className="msg-sender-name" style={{ color: 'var(--tb-text-secondary)' }}>
            {contactName}
          </div>
        )}

        {replyQuote && (
          <div
            style={{
              background: 'var(--tb-light-bg)',
              borderLeft: '3px solid var(--tb-primary-green)',
              borderRadius: '6px',
              padding: '6px 9px',
              marginBottom: '6px',
              fontSize: '11.5px',
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--tb-primary-green)', fontSize: '10.5px' }}>
              {replyQuote.senderName || 'Quoted message'}
            </div>
            <div style={{ color: 'var(--tb-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {replyQuote.content}
            </div>
          </div>
        )}

        {resolvedMediaUrl && msg.messageType === 'IMAGE' && (
          <a href={resolvedMediaUrl} target="_blank" rel="noreferrer" className="msg-image-wrap">
            <img
              src={resolvedMediaUrl}
              alt={msg.mediaFilename || 'WhatsApp image'}
              className="msg-image-thumb"
              loading="lazy"
            />
          </a>
        )}

        {resolvedMediaUrl && msg.messageType === 'VIDEO' && (
          <video controls className="msg-video-player" src={resolvedMediaUrl} />
        )}

        {resolvedMediaUrl && msg.messageType === 'AUDIO' && (
          <audio controls className="msg-audio-player" src={resolvedMediaUrl} />
        )}

        {resolvedMediaUrl && msg.messageType === 'DOCUMENT' && (
          <a
            href={resolvedMediaUrl}
            target="_blank"
            rel="noreferrer"
            download={msg.mediaFilename || true}
            className="msg-doc-card"
          >
            <FileText size={18} style={{ color: 'var(--tb-primary-green)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {msg.mediaFilename || 'Download document'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--tb-text-secondary)' }}>
                {msg.mediaMimeType || 'Attachment'}
              </div>
            </div>
            <Download size={14} style={{ color: 'var(--tb-text-secondary)', flexShrink: 0 }} />
          </a>
        )}

        {msg.content && (
          <div className="msg-bubble-text">{msg.content}</div>
        )}

        {buttons.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
            {buttons.map((btn, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '4px 9px',
                  borderRadius: '6px',
                  background: 'var(--tb-light-bg)',
                  border: '1px solid var(--tb-border-color)',
                  color: 'var(--tb-primary-green)',
                }}
              >
                {typeof btn === 'string' ? btn : btn.title || btn.text}
              </span>
            ))}
          </div>
        )}

        {msg.status === 'FAILED' && msg.errorMessage && (
          <div className="msg-error-hint">Failed: {msg.errorMessage}</div>
        )}

        <div className="msg-bubble-meta" style={{ justifyContent: 'space-between', width: '100%' }}>
          {msg.waMessageId && onReply ? (
            <button
              type="button"
              onClick={() => onReply(msg)}
              title="Quote reply"
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: '10px',
                color: 'var(--tb-text-secondary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <CornerUpLeft size={10} />
              <span>Reply</span>
            </button>
          ) : (
            <span />
          )}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span className="msg-time">{timeText}</span>
            {isOutbound && renderDeliveryStatus(msg.status)}
          </div>
        </div>
      </div>
    </div>
  );
}
