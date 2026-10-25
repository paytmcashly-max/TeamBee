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
  Edit2,
  Check,
  Mail,
  Award,
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { useToast } from '../../context/ToastContext';

export default function ContactSidebar({ onOpenTemplatePicker, onClose }) {
  const { activeChat, updateChatTags, updateContact, messagingWindow } = useChat();
  const toast = useToast();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  // Custom Lead Field Editor
  const [isAddingField, setIsAddingField] = useState(false);
  const [fieldKey, setFieldKey] = useState('');
  const [fieldVal, setFieldVal] = useState('');

  if (!activeChat) return null;

  const contact = activeChat.contact;
  let customAttrs = {};
  try {
    customAttrs = contact?.customAttributes ? JSON.parse(contact.customAttributes) : {};
  } catch (e) {
    customAttrs = {};
  }

  let tags = [];
  try {
    const parsedTags = activeChat.tags ? JSON.parse(activeChat.tags) : [];
    tags = Array.isArray(parsedTags) ? parsedTags : [];
  } catch {
    tags = [];
  }

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    try {
      const result = await updateContact(activeChat.id, { name: nameInput.trim() });
      if (!result?.success) {
        toast.error(result?.error || 'Failed to save the contact name');
        return;
      }
      setIsEditingName(false);
    } catch (err) {
      toast.error(err.message || 'Failed to save the contact name');
    }
  };

  const handleAddTag = async () => {
    if (!newTagInput.trim()) return;
    const tag = newTagInput.trim();
    if (!tags.includes(tag)) {
      try {
        const result = await updateChatTags(activeChat.id, [...tags, tag]);
        if (!result?.success) {
          toast.error(result?.error || 'Failed to add the tag');
          return;
        }
      } catch (err) {
        toast.error(err.message || 'Failed to add the tag');
        return;
      }
    }
    setNewTagInput('');
    setIsAddingTag(false);
  };

  const handleRemoveTag = async (tagToRemove) => {
    const updated = tags.filter((t) => t !== tagToRemove);
    try {
      const result = await updateChatTags(activeChat.id, updated);
      if (!result?.success) toast.error(result?.error || 'Failed to remove the tag');
    } catch (err) {
      toast.error(err.message || 'Failed to remove the tag');
    }
  };

  const handleSaveCustomField = async () => {
    if (!fieldKey.trim() || !fieldVal.trim()) return;
    const updatedAttrs = {
      ...customAttrs,
      [fieldKey.trim()]: fieldVal.trim(),
    };
    try {
      const result = await updateContact(activeChat.id, { customAttributes: updatedAttrs });
      if (!result?.success) {
        toast.error(result?.error || 'Failed to save the field');
        return;
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save the field');
      return;
    }
    setFieldKey('');
    setFieldVal('');
    setIsAddingField(false);
  };

  const handleRemoveCustomField = async (keyToRemove) => {
    const updatedAttrs = { ...customAttrs };
    delete updatedAttrs[keyToRemove];
    try {
      const result = await updateContact(activeChat.id, { customAttributes: updatedAttrs });
      if (!result?.success) toast.error(result?.error || 'Failed to remove the field');
    } catch (err) {
      toast.error(err.message || 'Failed to remove the field');
    }
  };

  const hoursRemaining = parseFloat(messagingWindow?.hoursRemaining || 0);
  const slaPercentage = Math.min(100, Math.max(0, (hoursRemaining / 24) * 100));

  return (
    <aside className="col-crm-sidebar">
      {/* 1. Top Profile Summary */}
      <div style={{ padding: '20px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center', position: 'relative' }}>
        {/* Close Button for Drawer (Tablet / Mobile) */}
        {onClose && (
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              padding: '6px',
              color: 'var(--text-secondary)',
            }}
            title="Close CRM Sidebar"
          >
            <X size={18} />
          </button>
        )}
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

        {/* Name with inline editing */}
        {isEditingName ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', marginBottom: '6px' }}>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              autoFocus
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: '4px',
                color: '#fff',
                padding: '4px 8px',
                fontSize: '14px',
                textAlign: 'center',
                outline: 'none',
              }}
            />
            <button
              onClick={handleSaveName}
              className="btn btn-primary"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              <Check size={13} />
            </button>
            <button
              onClick={() => setIsEditingName(false)}
              className="btn btn-ghost"
              style={{ padding: '4px 6px', fontSize: '11px' }}
            >
              ✕
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginBottom: '4px',
            }}
          >
            <h3 style={{ fontSize: '16px', color: '#fff', fontWeight: '700' }}>
              {contact?.name || 'Customer'}
            </h3>
            <button
              onClick={() => {
                setNameInput(contact?.name || '');
                setIsEditingName(true);
              }}
              className="btn btn-ghost"
              style={{ padding: '2px', color: 'var(--text-muted)' }}
              title="Edit contact name"
            >
              <Edit2 size={12} />
            </button>
          </div>
        )}

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
            href={`https://wa.me/${contact?.waId}?text=${encodeURIComponent('Namaste! Connecting regarding your query on TeamBee.')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ width: '100%', fontSize: '12px', padding: '6px 10px', textDecoration: 'none' }}
          >
            <ExternalLink size={13} /> Direct WhatsApp Web
          </a>
        </div>
      </div>

      {/* 2. Meta 24-Hour SLA Window Progress Meter */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            24h WhatsApp SLA Window
          </span>
          <span
            style={{
              fontSize: '11.5px',
              fontWeight: '700',
              color: messagingWindow?.isOpen ? '#10b981' : '#f87171',
            }}
          >
            {messagingWindow?.isOpen ? `${hoursRemaining}h remaining` : 'EXPIRED'}
          </span>
        </div>
        <div
          style={{
            height: '6px',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '999px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${slaPercentage}%`,
              background:
                slaPercentage > 50
                  ? 'linear-gradient(90deg, #10b981, #25D366)'
                  : slaPercentage > 20
                  ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                  : 'linear-gradient(90deg, #ef4444, #f87171)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.3 }}>
          {messagingWindow?.isOpen
            ? 'Free inbound/outbound session active. Send any message.'
            : 'Session expired. Send Meta pre-approved template to restart timer.'}
        </p>
      </div>

      {/* 3. CRM Intelligence / Custom Attributes */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: '700',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Lead & CRM Profile
          </span>
          <button
            onClick={() => setIsAddingField(true)}
            className="btn btn-ghost"
            style={{ padding: '2px 6px', fontSize: '11px' }}
          >
            <Plus size={13} /> Field
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
          {Object.entries(customAttrs).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{key}:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    color: '#fff',
                    fontWeight: '600',
                    background: 'rgba(255, 255, 255, 0.05)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '11.5px',
                  }}
                >
                  {String(val)}
                </span>
                <button
                  onClick={() => handleRemoveCustomField(key)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  title="Remove field"
                >
                  <X size={11} />
                </button>
              </div>
            </div>
          ))}

          {isAddingField && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                background: 'var(--bg-surface)',
                padding: '8px',
                borderRadius: '6px',
                marginTop: '6px',
              }}
            >
              <input
                type="text"
                placeholder="Field name (e.g. Budget, City)"
                value={fieldKey}
                onChange={(e) => setFieldKey(e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '4px 6px',
                  fontSize: '11.5px',
                  outline: 'none',
                }}
              />
              <input
                type="text"
                placeholder="Value (e.g. ₹85,000, Mumbai)"
                value={fieldVal}
                onChange={(e) => setFieldVal(e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '4px 6px',
                  fontSize: '11.5px',
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleSaveCustomField}
                  className="btn btn-primary"
                  style={{ padding: '2px 8px', fontSize: '11px' }}
                >
                  Save
                </button>
                <button
                  onClick={() => setIsAddingField(false)}
                  className="btn btn-ghost"
                  style={{ padding: '2px 6px', fontSize: '11px' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ color: 'var(--text-muted)' }}>First Contact:</span>
            <span style={{ color: 'var(--text-secondary)' }}>
              {contact?.createdAt
                ? new Date(contact.createdAt).toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Dynamic Tags Manager */}
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

      {/* 5. Meta WhatsApp Quick Template Launcher */}
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

      {/* 6. Operational Audit */}
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
            <span>Response SLA tracked from live message events</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
