import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Sparkles, Lock, Send, X } from 'lucide-react';
import { apiFetch, fileToBase64 } from '../../services/apiClient';

const DEFAULT_QUICK_REPLIES = [
  { id: 'def-welcome', title: 'Welcome greeting', shortcut: 'welcome', body: 'Hi! Thanks for reaching out on WhatsApp. How can I help you today?' },
  { id: 'def-order', title: 'Order tracking', shortcut: 'order', body: 'I am checking your order details right now and will update you shortly.' },
  { id: 'def-payment', title: 'Payment confirmation', shortcut: 'payment', body: 'We have received your payment. Your confirmation receipt is being generated.' },
];

function inferWhatsAppMediaType(mimeType = '') {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  return 'DOCUMENT';
}

export default function MessageComposer({
  chatId,
  isExpired,
  replyToMessage,
  onClearReply,
  onSendMessage,
  onOpenTemplatePicker,
  onTypingChange,
}) {
  const [composeMode, setComposeMode] = useState('WHATSAPP');
  const [inputContent, setInputContent] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [quickReplies, setQuickReplies] = useState(DEFAULT_QUICK_REPLIES);
  const [composerError, setComposerError] = useState(null);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    let active = true;
    apiFetch('/api/quick-replies')
      .then((data) => {
        if (active && Array.isArray(data.quickReplies) && data.quickReplies.length > 0) {
          setQuickReplies(data.quickReplies);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setComposerError(null);
    setShowQuickReplies(false);
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (onTypingChange && chatId) onTypingChange(chatId, false);
    };
  }, [chatId, onTypingChange]);

  const notifyTyping = () => {
    if (!onTypingChange || !chatId || composeMode === 'NOTE') return;
    onTypingChange(chatId, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTypingChange(chatId, false);
    }, 2000);
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    const content = inputContent.trim();
    if (!content || sending) return;

    setComposerError(null);
    setInputContent('');
    setSending(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (onTypingChange && chatId) onTypingChange(chatId, false);

    try {
      await onSendMessage(
        content,
        composeMode === 'NOTE'
          ? { isInternal: true, messageType: 'NOTE' }
          : {
              isInternal: false,
              messageType: 'TEXT',
              replyToMessageId: replyToMessage?.id || null,
            }
      );
      if (composeMode !== 'NOTE' && onClearReply) onClearReply();
    } catch (err) {
      setComposerError(err.message || 'Failed to send message');
      setInputContent(content);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setComposerError(null);
    setUploadingMedia(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const uploaded = await apiFetch('/api/media/upload', {
        method: 'POST',
        body: JSON.stringify({
          fileBase64,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
        }),
      });

      const mediaType = inferWhatsAppMediaType(uploaded.mimeType || file.type);
      await onSendMessage(file.name, {
        messageType: mediaType,
        mediaUrl: uploaded.url,
        mediaFilename: uploaded.filename || file.name,
        replyToMessageId: replyToMessage?.id || null,
      });
      if (onClearReply) onClearReply();
    } catch (err) {
      setComposerError(err.message || 'Failed to upload attachment');
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Escape') {
      setShowQuickReplies(false);
    }
  };

  const quickQuery = inputContent.startsWith('/') ? inputContent.slice(1).toLowerCase() : '';
  const visibleReplies = quickReplies.filter((qr) =>
    !quickQuery || `${qr.shortcut || ''} ${qr.title} ${qr.body}`.toLowerCase().includes(quickQuery)
  );

  return (
    <div className="canvas-composer-wrapper">
      <div className="composer-mode-tabs" style={{ marginBottom: '8px' }}>
        <button
          type="button"
          className={`composer-tab ${composeMode === 'WHATSAPP' ? 'active' : ''}`}
          onClick={() => setComposeMode('WHATSAPP')}
        >
          WhatsApp reply
        </button>
        <button
          type="button"
          className={`composer-tab note ${composeMode === 'NOTE' ? 'active' : ''}`}
          onClick={() => setComposeMode('NOTE')}
        >
          <Lock size={11} style={{ marginRight: '4px', verticalAlign: '-1px' }} />
          Private note
        </button>
      </div>

      {replyToMessage && composeMode === 'WHATSAPP' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            padding: '7px 12px',
            marginBottom: '8px',
            background: 'var(--tb-green-pill-bg)',
            borderLeft: '3px solid var(--tb-primary-green)',
            borderRadius: '7px',
            fontSize: '12px',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 600, color: 'var(--tb-primary-green)' }}>Replying to message: </span>
            <span style={{ color: 'var(--tb-text-secondary)' }}>
              {String(replyToMessage.content || '').slice(0, 90)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClearReply}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tb-text-secondary)' }}
            aria-label="Cancel quote reply"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {composerError && (
        <div className="tb-alert error" style={{ marginBottom: '8px', padding: '8px 12px' }}>
          <span>{composerError}</span>
          <button
            type="button"
            onClick={() => setComposerError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          >
            ×
          </button>
        </div>
      )}

      {isExpired && composeMode === 'WHATSAPP' ? (
        <div className="canvas-expired-composer">
          <div className="expired-composer-header">
            <Lock size={16} style={{ color: 'var(--tb-expired-text)', flexShrink: 0 }} />
            <div className="expired-composer-text-block">
              <span className="expired-composer-title">
                Re-engage customer with an approved WhatsApp template
              </span>
              <span className="expired-composer-desc">
                Free-form messages pause after 24 hours without a customer reply. Switch to Private note above for team notes.
              </span>
            </div>
          </div>

          <button
            type="button"
            className="expired-choose-template-btn"
            onClick={onOpenTemplatePicker}
          >
            Choose template ↗
          </button>
        </div>
      ) : (
        <form onSubmit={handleSend} className="composer-box-relative">
          {showQuickReplies && visibleReplies.length > 0 && (
            <div className="composer-quick-replies">
              {visibleReplies.map((qr) => (
                <button
                  key={qr.id}
                  type="button"
                  className="quick-reply-item"
                  onClick={() => {
                    setInputContent(qr.body);
                    setShowQuickReplies(false);
                    textareaRef.current?.focus();
                  }}
                >
                  <span className="quick-reply-title">
                    /{qr.shortcut || qr.title}
                  </span>
                  <span className="quick-reply-body">{qr.body}</span>
                </button>
              ))}
            </div>
          )}

          <div
            className="canvas-active-composer"
            style={composeMode === 'NOTE' ? { borderColor: 'var(--tb-note-border)', background: '#fffdf2' } : undefined}
          >
            <textarea
              ref={textareaRef}
              className={`composer-textarea ${composeMode === 'NOTE' ? 'note-mode' : ''}`}
              rows={2}
              placeholder={
                composeMode === 'NOTE'
                  ? 'Write an internal team note (not sent to customer)...'
                  : 'Write a WhatsApp reply or type / for quick replies...'
              }
              value={inputContent}
              onChange={(e) => {
                const next = e.target.value;
                setInputContent(next);
                setShowQuickReplies(next.startsWith('/') && composeMode === 'WHATSAPP');
                notifyTyping();
              }}
              onKeyDown={handleKeyDown}
            />

            <div className="composer-toolbar">
              <div className="composer-toolbar-left">
                {composeMode === 'WHATSAPP' && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      style={{ display: 'none' }}
                      accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.csv"
                      onChange={handleFileUpload}
                    />
                    <button
                      type="button"
                      className="composer-tool-btn"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingMedia}
                      title="Attach image, audio, video, or document"
                    >
                      <Paperclip size={15} />
                    </button>
                    <button
                      type="button"
                      className="composer-tool-btn"
                      onClick={() => setShowQuickReplies((prev) => !prev)}
                      title="Insert quick reply"
                    >
                      <Sparkles size={15} />
                    </button>
                    <button
                      type="button"
                      className="composer-tool-btn"
                      onClick={onOpenTemplatePicker}
                      title="Send approved template"
                      style={{ fontSize: '11px', width: 'auto', padding: '0 8px', fontWeight: 600 }}
                    >
                      Templates
                    </button>
                  </>
                )}
                <span className="composer-hint">
                  {uploadingMedia ? 'Uploading media...' : 'Enter to send · Shift+Enter for new line'}
                </span>
              </div>

              <button
                type="submit"
                className="composer-send-btn"
                disabled={!inputContent.trim() || sending || uploadingMedia}
                style={composeMode === 'NOTE' ? { backgroundColor: '#b45309' } : undefined}
              >
                <span>{sending ? 'Sending...' : composeMode === 'NOTE' ? 'Save note' : 'Send'}</span>
                <Send size={13} />
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
