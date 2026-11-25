import React, { useState } from 'react';
import { Phone, X, Edit2 } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { formatFullDate, formatTimeShort, parseJsonArray, parseJsonObject } from '../../utils/formatters';

export default function ContactSidebar({ onClose }) {
  const { activeChat, updateChatTags, updateContact, messagingWindow } = useChat();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isAddingField, setIsAddingField] = useState(false);
  const [fieldKey, setFieldKey] = useState('');
  const [fieldVal, setFieldVal] = useState('');

  if (!activeChat) return null;

  const contact = activeChat.contact;
  const customAttrs = parseJsonObject(contact?.customAttributes);
  const tags = parseJsonArray(activeChat.tags);

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    await updateContact(activeChat.id, { name: nameInput.trim() });
    setIsEditingName(false);
  };

  const handleAddTag = async () => {
    const tag = newTagInput.trim();
    if (!tag) return;
    if (!tags.includes(tag)) {
      await updateChatTags(activeChat.id, [...tags, tag]);
    }
    setNewTagInput('');
    setIsAddingTag(false);
  };

  const handleRemoveTag = async (tagToRemove) => {
    await updateChatTags(activeChat.id, tags.filter((t) => t !== tagToRemove));
  };

  const handleSaveCustomField = async () => {
    if (!fieldKey.trim() || !fieldVal.trim()) return;
    await updateContact(activeChat.id, {
      customAttributes: {
        ...customAttrs,
        [fieldKey.trim()]: fieldVal.trim(),
      },
    });
    setFieldKey('');
    setFieldVal('');
    setIsAddingField(false);
  };

  const handleRemoveCustomField = async (keyToRemove) => {
    const updatedAttrs = { ...customAttrs };
    delete updatedAttrs[keyToRemove];
    await updateContact(activeChat.id, { customAttributes: updatedAttrs });
  };

  const contactName = contact?.name || contact?.waId || 'WhatsApp User';
  const contactEmail = customAttrs.Email || contact?.email || '';
  const contactPhone = contact?.waId ? `+${contact.waId}` : '';
  const customerSince = formatFullDate(contact?.createdAt);
  const customerId = contact?.id ? `TB-${contact.id.slice(0, 6).toUpperCase()}` : 'Not assigned';
  const customEntries = Object.entries(customAttrs).filter(([k]) => k !== 'Email');

  return (
    <aside className="customer-details-panel" data-name="Customer details">
      <div className="details-header">
        <h3 className="details-header-title">Customer details</h3>
        {onClose && (
          <button
            type="button"
            className="details-close-btn"
            onClick={onClose}
            title="Close customer panel"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="details-profile-section">
        {isEditingName ? (
          <div className="details-name-edit-box">
            <input
              type="text"
              className="details-name-input"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Enter contact name"
              autoFocus
            />
            <div className="details-name-edit-actions">
              <button type="button" className="details-save-name-btn" onClick={handleSaveName}>
                Save
              </button>
              <button type="button" className="details-cancel-name-btn" onClick={() => setIsEditingName(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="details-name-row">
            <h2 className="details-customer-name">{contactName}</h2>
            <button
              type="button"
              className="details-edit-icon-btn"
              onClick={() => {
                setNameInput(contactName);
                setIsEditingName(true);
              }}
              title="Edit name"
            >
              <Edit2 size={13} />
            </button>
          </div>
        )}

        <span className="details-customer-email">
          {contactEmail || contactPhone || 'No email recorded'}
        </span>

        {contactPhone && (
          <a
            href={`tel:${contactPhone}`}
            className="details-call-btn"
            title={`Call ${contactName}`}
          >
            <Phone size={13} />
            <span>Call {contactPhone}</span>
          </a>
        )}
      </div>

      <div className="details-section">
        <span className="details-section-label">LABELS</span>

        <div className="details-tags-list">
          {tags.length > 0 ? (
            tags.map((tag, idx) => (
              <span
                key={idx}
                className={`details-tag-pill ${tag.toLowerCase().includes('vip') ? 'vip' : 'normal'}`}
              >
                <span>{tag}</span>
                <button
                  type="button"
                  className="details-tag-remove"
                  onClick={() => handleRemoveTag(tag)}
                  title={`Remove ${tag}`}
                >
                  <X size={10} />
                </button>
              </span>
            ))
          ) : (
            <span className="details-empty-note">No labels assigned yet</span>
          )}
        </div>

        {isAddingTag ? (
          <div className="details-add-tag-box">
            <input
              type="text"
              className="details-add-tag-input"
              placeholder="Tag name (e.g. Priority, Billing)"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              autoFocus
            />
            <div className="details-add-tag-actions">
              <button type="button" className="details-add-tag-confirm" onClick={handleAddTag}>
                Add
              </button>
              <button type="button" className="details-add-tag-cancel" onClick={() => setIsAddingTag(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="details-add-tag-btn"
            onClick={() => setIsAddingTag(true)}
          >
            + Add label
          </button>
        )}
      </div>

      <div className="details-divider" />

      <div className="details-section">
        <span className="details-section-label">DETAILS</span>

        <div className="details-kv-table">
          {contactPhone && (
            <div className="details-kv-row">
              <span className="details-k">WhatsApp</span>
              <span className="details-v">{contactPhone}</span>
            </div>
          )}

          <div className="details-kv-row">
            <span className="details-k">Customer since</span>
            <span className="details-v">{customerSince}</span>
          </div>

          <div className="details-kv-row">
            <span className="details-k">Customer ID</span>
            <span className="details-v">{customerId}</span>
          </div>

          {customEntries.map(([k, v]) => (
            <div key={k} className="details-kv-row">
              <span className="details-k">{k}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="details-v">{String(v)}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveCustomField(k)}
                  className="details-tag-remove"
                  title="Remove field"
                >
                  <X size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {isAddingField ? (
          <div className="details-add-field-box">
            <input
              type="text"
              placeholder="Field name (e.g. City)"
              className="details-add-field-input"
              value={fieldKey}
              onChange={(e) => setFieldKey(e.target.value)}
            />
            <input
              type="text"
              placeholder="Value"
              className="details-add-field-input"
              value={fieldVal}
              onChange={(e) => setFieldVal(e.target.value)}
            />
            <div className="details-add-field-actions">
              <button type="button" className="details-add-field-confirm" onClick={handleSaveCustomField}>
                Save
              </button>
              <button type="button" className="details-add-field-cancel" onClick={() => setIsAddingField(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="details-add-tag-btn"
            onClick={() => setIsAddingField(true)}
            style={{ marginTop: '10px' }}
          >
            + Add detail
          </button>
        )}
      </div>

      <div className="details-divider" />

      <div className="details-section">
        <span className="details-section-label">CONVERSATION STATE</span>

        <div className="details-activity-list">
          <div className="activity-item">
            <span className="activity-title">
              ● Owner: {activeChat.assignedAgent?.name || 'Unassigned queue'}
            </span>
            <span className="activity-timestamp">
              Status: {activeChat.status || 'OPEN'}
            </span>
          </div>

          <div className="activity-item">
            <span className="activity-title">
              ● {messagingWindow?.isOpen ? 'Care window active' : 'Care window expired'}
            </span>
            <span className="activity-timestamp">
              {messagingWindow?.isOpen
                ? `${messagingWindow.hoursRemaining}h remaining`
                : 'Send approved template to re-engage'}
            </span>
          </div>

          {activeChat.lastMessageAt && (
            <div className="activity-item">
              <span className="activity-title">● Last activity</span>
              <span className="activity-timestamp">
                {formatFullDate(activeChat.lastMessageAt)} · {formatTimeShort(activeChat.lastMessageAt)}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
