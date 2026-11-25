import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '../../services/apiClient';

export default function QuickRepliesSection() {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const loadReplies = () => {
    apiFetch('/api/quick-replies')
      .then((data) => setItems(data.quickReplies || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadReplies();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      await apiFetch('/api/quick-replies', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          shortcut: shortcut.trim() || undefined,
          body: body.trim(),
        }),
      });
      setTitle('');
      setShortcut('');
      setBody('');
      loadReplies();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setFeedback(null);
    try {
      await apiFetch(`/api/quick-replies/${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="page-card page-stack" style={{ gap: '12px', marginTop: '20px' }}>
      <div className="page-card-header" style={{ marginBottom: 0 }}>
        <div>
          <h2 className="page-card-title">Canned quick replies ({items.length})</h2>
          <p className="page-card-subtitle">Type / in the inbox composer to insert these saved responses</p>
        </div>
      </div>

      {feedback && <div className={`tb-alert ${feedback.type}`}>{feedback.text}</div>}

      {items.length > 0 && (
        <div className="page-stack" style={{ gap: '8px' }}>
          {items.map((qr) => (
            <div
              key={qr.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'var(--tb-light-bg)',
                border: '1px solid var(--tb-border-light)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '12.5px', fontWeight: 600 }}>
                  {qr.title} {qr.shortcut ? <span className="tb-hint">· /{qr.shortcut}</span> : null}
                </div>
                <div className="tb-hint">{qr.body}</div>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '4px' }}
                onClick={() => handleDelete(qr.id)}
                title="Delete quick reply"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="page-stack" style={{ gap: '10px' }}>
        <div className="tb-form-grid-2">
          <input
            type="text"
            required
            className="tb-input"
            placeholder="Title (e.g. Pricing overview)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            type="text"
            className="tb-input"
            placeholder="Slash shortcut (e.g. pricing)"
            value={shortcut}
            onChange={(e) => setShortcut(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            required
            className="tb-input"
            placeholder="Message text inserted on /shortcut..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary" disabled={saving}>
            <Plus size={14} />
            <span>Add</span>
          </button>
        </div>
      </form>
    </div>
  );
}
