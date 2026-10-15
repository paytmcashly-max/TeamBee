import React, { useState } from 'react';
import {
  Phone,
  Calendar,
  Tag,
  FileText,
  User,
  MapPin,
  GraduationCap,
  Sparkles,
  ExternalLink,
  Plus,
  X,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';

export default function ContactSidebar({ onOpenTemplatePicker }) {
  const { activeChat, updateChatTags } = useChat();
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  if (!activeChat) return null;

  const contact = activeChat.contact;
  let customAttrs = {};
  try {
    customAttrs = contact?.customAttributes ? JSON.parse(contact.customAttributes) : {};
  } catch (e) {
    customAttrs = {};
  }

  const tags = activeChat.tags ? JSON.parse(activeChat.tags) : [];

  const handleAddTag = async () => {
    if (!newTagInput.trim()) return;
    const tag = newTagInput.trim();
    if (!tags.includes(tag)) {
      const updated = [...tags, tag];
      await updateChatTags(activeChat.id, updated);
    }
    setNewTagInput('');
    setIsAddingTag(false);
  };

  const handleRemoveTag = async (tagToRemove) => {
    const updated = tags.filter((t) => t !== tagToRemove);
    await updateChatTags(activeChat.id, updated);
  };

  return (
    <aside className="col-crm-sidebar">
      {/* Top Profile Summary */}
      <div style={{ padding: '20px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: '700',
            color: '#34d399',
            margin: '0 auto 12px auto',
            border: '2px solid rgba(16, 185, 129, 0.3)',
          }}
        >
          {contact?.name ? contact.name.charAt(0).toUpperCase() : 'C'}
        </div>

        <h3 style={{ fontSize: '16px', color: '#fff', marginBottom: '4px' }}>
          {contact?.name || 'Customer'}
        </h3>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            color: 'var(--text-secondary)',
            marginBottom: '12px',
          }}
        >
          <Phone size={13} style={{ color: 'var(--wa-primary)' }} />
          <span>+{contact?.waId}</span>
        </div>

        <div>
          <a
            href={`https://wa.me/${contact?.waId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ width: '100%', fontSize: '12px', padding: '6px 10px', textDecoration: 'none' }}
          >
            <ExternalLink size={13} /> Open WhatsApp Web
          </a>
        </div>
      </div>

      {/* CRM Intelligence / Custom Attributes */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: '700',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '12px',
          }}
        >
          Lead & CRM Profile
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
          {customAttrs.leadStage && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Lead Stage:</span>
              <span
                style={{
                  fontWeight: '600',
                  color: '#38bdf8',
                  background: 'rgba(56, 189, 248, 0.12)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                }}
              >
                {customAttrs.leadStage}
              </span>
            </div>
          )}

          {customAttrs.targetExam && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Target Program:</span>
              <span style={{ color: '#fff', fontWeight: '500' }}>{customAttrs.targetExam}</span>
            </div>
          )}

          {customAttrs.city && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>City / Region:</span>
              <span style={{ color: '#fff', fontWeight: '500' }}>{customAttrs.city}</span>
            </div>
          )}

          {customAttrs.school && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Institution:</span>
              <span style={{ color: '#fff', fontWeight: '500' }}>{customAttrs.school}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>First Contact:</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {new Date(contact?.createdAt || Date.now()).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Dynamic Tags Manager */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: '700',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Tags & Segments
          </span>
          <button
            onClick={() => setIsAddingTag(true)}
            className="btn btn-ghost"
            style={{ padding: '2px 6px', fontSize: '11px' }}
          >
            <Plus size={13} /> Add
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: '11.5px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#e2e8f0',
                padding: '3px 8px',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Tag size={10} style={{ color: 'var(--wa-primary)' }} />
              <span>{tag}</span>
              <button
                onClick={() => handleRemoveTag(tag)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                }}
              >
                <X size={11} />
              </button>
            </span>
          ))}

          {isAddingTag && (
            <div style={{ display: 'flex', gap: '4px', width: '100%', marginTop: '6px' }}>
              <input
                type="text"
                placeholder="New tag..."
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                autoFocus
                style={{
                  flex: 1,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '4px 8px',
                  fontSize: '12px',
                  outline: 'none',
                }}
              />
              <button onClick={handleAddTag} className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '11px' }}>
                Save
              </button>
              <button onClick={() => setIsAddingTag(false)} className="btn btn-ghost" style={{ padding: '4px 6px' }}>
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Meta WhatsApp Quick Template Launcher */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: '700',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '10px',
          }}
        >
          Meta Broadcast & Re-engagement
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.4 }}>
          Send pre-approved WhatsApp marketing or utility templates with automatic variable interpolation.
        </p>
        <button
          onClick={onOpenTemplatePicker}
          className="btn btn-primary"
          style={{ width: '100%', fontSize: '12px', padding: '8px' }}
        >
          <Sparkles size={14} /> Send Approved Template
        </button>
      </div>

      {/* Operational SLA & SLA Security */}
      <div style={{ padding: '16px 20px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: '700',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '10px',
          }}
        >
          Operational Audit
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={14} style={{ color: '#10b981' }} />
            <span>End-to-End Encrypted Handshake</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={14} style={{ color: '#38bdf8' }} />
            <span>Average Agent First Response: 1m 24s</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
