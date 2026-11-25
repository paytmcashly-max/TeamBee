import React, { useState, useEffect } from 'react';
import { RefreshCw, Search, Plus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/apiClient';
import { getVariableIndexes, renderTemplateBody, buildDefaultVariables } from '../../utils/templateHelpers';

export default function TemplatesView({ onNavigateToBroadcasts }) {
  const { isAdmin, tenant } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [variables, setVariables] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTpl, setNewTpl] = useState({
    name: '',
    category: 'UTILITY',
    language: 'en_US',
    headerText: '',
    bodyText: '',
    footerText: '',
    examples: {},
  });
  const [feedback, setFeedback] = useState(null);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/templates');
      const list = data.templates || [];
      setTemplates(list);
      if (list.length > 0 && !selected) {
        setSelected(list[0]);
        setVariables(buildDefaultVariables(list[0]));
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleSyncMeta = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      const data = await apiFetch('/api/templates/sync', { method: 'POST' });
      const list = data.templates || [];
      setTemplates(list);
      if (list.length > 0) {
        setSelected(list[0]);
        setVariables(buildDefaultVariables(list[0]));
      }
      setFeedback({ type: 'success', text: `Synced ${data.count || list.length} template(s) from Meta.` });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const createVarIndexes = getVariableIndexes(newTpl.bodyText);

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setFeedback(null);
    try {
      const bodyExamples = createVarIndexes.map((idx) => (newTpl.examples[idx] || '').trim());
      const data = await apiFetch('/api/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: newTpl.name.trim(),
          category: newTpl.category,
          language: newTpl.language.trim() || 'en_US',
          headerText: newTpl.headerText.trim(),
          bodyText: newTpl.bodyText.trim(),
          footerText: newTpl.footerText.trim(),
          bodyExamples,
        }),
      });
      setShowCreate(false);
      setNewTpl({
        name: '',
        category: 'UTILITY',
        language: 'en_US',
        headerText: '',
        bodyText: '',
        footerText: '',
        examples: {},
      });
      if (data.template) {
        setTemplates((prev) => [data.template, ...prev.filter((t) => t.id !== data.template.id)]);
        setSelected(data.template);
        setVariables(buildDefaultVariables(data.template));
      } else {
        await loadTemplates();
      }
      setFeedback({
        type: 'success',
        text: `Template submitted to Meta (${data.template?.status || 'PENDING'}).`,
      });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setCreating(false);
    }
  };

  const filtered = templates.filter((t) =>
    `${t.name} ${t.category} ${t.bodyText}`.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const variableIndexes = selected ? getVariableIndexes(selected.bodyText) : [];

  return (
    <div className="page-scroll-container">
      <div className="workspace-page-header" style={{ padding: '20px 0 18px 0' }}>
        <div className="page-header-text">
          <h1 className="page-header-title">WhatsApp templates</h1>
          <p className="page-header-subtitle">
            Browse synced Meta templates and verify variable previews before launching campaigns.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {isAdmin && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCreate((prev) => !prev)}
              >
                {showCreate ? <X size={14} /> : <Plus size={14} />}
                <span>{showCreate ? 'Close form' : 'Create template'}</span>
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSyncMeta} disabled={syncing}>
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                <span>{syncing ? 'Syncing Meta...' : 'Sync from Meta'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {feedback && (
        <div className={`tb-alert ${feedback.type}`} style={{ marginBottom: '16px' }}>
          <span>{feedback.text}</span>
        </div>
      )}

      {showCreate && isAdmin && (
        <form onSubmit={handleCreateTemplate} className="page-card page-stack" style={{ marginBottom: '20px', gap: '12px' }}>
          <div className="page-card-header" style={{ marginBottom: 0 }}>
            <div>
              <h2 className="page-card-title">Submit new Meta template</h2>
              <p className="page-card-subtitle">
                Submitted directly to Meta Cloud API for review. Variables must be sequential ({"{{1}}"}, {"{{2}}"}).
              </p>
            </div>
          </div>

          <div className="tb-form-grid-2">
            <div className="tb-field">
              <label className="tb-label">Template name (snake_case)</label>
              <input
                type="text"
                required
                className="tb-input"
                placeholder="demo_class_reminder"
                value={newTpl.name}
                onChange={(e) => setNewTpl((prev) => ({ ...prev, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
              />
            </div>
            <div className="tb-form-grid-2">
              <div className="tb-field">
                <label className="tb-label">Category</label>
                <select
                  className="tb-input"
                  value={newTpl.category}
                  onChange={(e) => setNewTpl((prev) => ({ ...prev, category: e.target.value }))}
                >
                  <option value="UTILITY">Utility</option>
                  <option value="MARKETING">Marketing</option>
                  <option value="AUTHENTICATION">Authentication</option>
                </select>
              </div>
              <div className="tb-field">
                <label className="tb-label">Language code</label>
                <input
                  type="text"
                  required
                  className="tb-input"
                  value={newTpl.language}
                  onChange={(e) => setNewTpl((prev) => ({ ...prev, language: e.target.value }))}
                  placeholder="en_US"
                />
              </div>
            </div>
          </div>

          <div className="tb-form-grid-2">
            <div className="tb-field">
              <label className="tb-label">Header text (optional)</label>
              <input
                type="text"
                maxLength={60}
                className="tb-input"
                value={newTpl.headerText}
                onChange={(e) => setNewTpl((prev) => ({ ...prev, headerText: e.target.value }))}
                placeholder="Order Update"
              />
            </div>
            <div className="tb-field">
              <label className="tb-label">Footer text (optional)</label>
              <input
                type="text"
                maxLength={60}
                className="tb-input"
                value={newTpl.footerText}
                onChange={(e) => setNewTpl((prev) => ({ ...prev, footerText: e.target.value }))}
                placeholder="TeamBee Support"
              />
            </div>
          </div>

          <div className="tb-field">
            <label className="tb-label">Body text (up to 1024 chars)</label>
            <textarea
              rows={3}
              required
              maxLength={1024}
              className="tb-textarea"
              placeholder="Hi {{1}}, your booking for {{2}} is confirmed."
              value={newTpl.bodyText}
              onChange={(e) => setNewTpl((prev) => ({ ...prev, bodyText: e.target.value }))}
            />
          </div>

          {createVarIndexes.length > 0 && (
            <div className="tb-form-grid-2">
              {createVarIndexes.map((idx) => (
                <div key={idx} className="tb-field">
                  <label className="tb-label">Required review example for {`{{${idx}}}`}</label>
                  <input
                    type="text"
                    required
                    className="tb-input"
                    value={newTpl.examples[idx] || ''}
                    onChange={(e) =>
                      setNewTpl((prev) => ({
                        ...prev,
                        examples: { ...prev.examples, [idx]: e.target.value },
                      }))
                    }
                    placeholder={`Sample value ${idx}`}
                  />
                </div>
              ))}
            </div>
          )}

          <div>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Submitting to Meta...' : 'Submit template for review'}
            </button>
          </div>
        </form>
      )}

      <div className="page-two-col">
        <div className="page-card">
          <div className="page-card-header">
            <h2 className="page-card-title">Template library ({templates.length})</h2>
            <div style={{ position: 'relative', width: '220px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--tb-text-secondary)' }} />
              <input
                type="text"
                className="tb-input"
                style={{ paddingLeft: '30px', paddingTop: '6px', paddingBottom: '6px', fontSize: '12px' }}
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <p className="tb-hint">Loading templates...</p>
          ) : filtered.length === 0 ? (
            <p className="tb-hint">No templates found. Admins can sync approved templates from Meta.</p>
          ) : (
            <div className="tb-table-wrap">
              <table className="tb-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Language</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tpl) => (
                    <tr
                      key={tpl.id}
                      onClick={() => {
                        setSelected(tpl);
                        setVariables(buildDefaultVariables(tpl));
                      }}
                      style={{
                        cursor: 'pointer',
                        background: selected?.id === tpl.id ? 'var(--tb-green-pill-bg)' : undefined,
                      }}
                    >
                      <td style={{ fontWeight: 600 }}>{tpl.name}</td>
                      <td>{tpl.category}</td>
                      <td>{tpl.language}</td>
                      <td>
                        <span className={`page-pill-badge ${tpl.status === 'APPROVED' ? '' : 'warning'}`}>
                          {tpl.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="page-card">
          <div className="page-card-header">
            <span className="details-section-label">TEMPLATE PREVIEW</span>
            {isAdmin && onNavigateToBroadcasts && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '5px 10px', fontSize: '11.5px' }}
                onClick={onNavigateToBroadcasts}
              >
                Use in broadcast ↗
              </button>
            )}
          </div>

          {selected ? (
            <div className="page-stack" style={{ gap: '14px' }}>
              {variableIndexes.length > 0 && (
                <div className="tb-form-grid-2">
                  {variableIndexes.map((idx) => (
                    <div key={idx} className="tb-field">
                      <label className="tb-label">Sample {`{{${idx}}}`}</label>
                      <input
                        type="text"
                        className="tb-input"
                        value={variables[idx] || ''}
                        onChange={(e) => setVariables((prev) => ({ ...prev, [idx]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="wa-preview-surface">
                <div className="wa-preview-bubble">
                  <div className="wa-preview-header">{(tenant?.name || 'TEAMBEE').toUpperCase()}</div>
                  <div className="wa-preview-body">{renderTemplateBody(selected.bodyText, variables)}</div>
                  <div className="wa-preview-footer">
                    <span>{selected.footerText || `${selected.category} · ${selected.language}`}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="tb-hint">Select a template row to inspect its message body and variable mapping.</p>
          )}
        </div>
      </div>
    </div>
  );
}
