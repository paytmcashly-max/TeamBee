import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Plus, Upload, Check, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/apiClient';
import { getVariableIndexes, parseTemplateButtons, renderTemplateBody } from '../../utils/templateHelpers';

function parseRecipientLines(rawText) {
  const seen = new Set();
  const valid = [];
  let invalidCount = 0;
  let duplicateCount = 0;

  rawText.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/[,\t]/).map((p) => p.trim());
    const cleanPhone = String(parts[0] || '').replace(/\D/g, '');
    if (cleanPhone.length < 8 || cleanPhone.length > 20) {
      invalidCount += 1;
      return;
    }
    if (seen.has(cleanPhone)) {
      duplicateCount += 1;
      return;
    }
    seen.add(cleanPhone);
    valid.push({ phone: cleanPhone, name: parts[1] || '' });
  });

  return { valid, invalidCount, duplicateCount };
}

export default function BroadcastsView() {
  const { tenant } = useAuth();

  const [mode, setMode] = useState('list'); // 'list' | 'create'
  const [broadcasts, setBroadcasts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Campaign Builder Form
  const [campaignName, setCampaignName] = useState('');
  const [audienceSource, setAudienceSource] = useState('contacts'); // 'contacts' | 'csv'
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [csvFilename, setCsvFilename] = useState('');
  const [csvRawText, setCsvRawText] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [variables, setVariables] = useState({});
  const [deliveryMode, setDeliveryMode] = useState('now');

  const loadBroadcastWorkspace = async () => {
    setLoading(true);
    try {
      const [bcData, tplData, chatData] = await Promise.all([
        apiFetch('/api/broadcasts'),
        apiFetch('/api/templates'),
        apiFetch('/api/chats?filter=all&status=ALL&limit=100'),
      ]);
      setBroadcasts(bcData.broadcasts || []);
      const approvedTpls = (tplData.templates || []).filter((t) => t.status === 'APPROVED');
      setTemplates(approvedTpls);
      if (approvedTpls.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(approvedTpls[0].id);
      }

      const uniqueContacts = [];
      const seen = new Set();
      (chatData.chats || []).forEach((chat) => {
        if (chat.contact && !seen.has(chat.contact.id)) {
          seen.add(chat.contact.id);
          uniqueContacts.push(chat.contact);
        }
      });
      setContacts(uniqueContacts);
      setSelectedContactIds(uniqueContacts.map((c) => c.id));
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBroadcastWorkspace();
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  const csvSummary = useMemo(() => parseRecipientLines(csvRawText), [csvRawText]);
  const recipientCount = audienceSource === 'csv' ? csvSummary.valid.length : selectedContactIds.length;
  const variableIndexes = selectedTemplate ? getVariableIndexes(selectedTemplate.bodyText) : [];
  const ctaButtons = selectedTemplate ? parseTemplateButtons(selectedTemplate.buttons) : [];

  const sampleRecipientName = useMemo(() => {
    if (audienceSource === 'csv') return csvSummary.valid[0]?.name || 'Priya Sharma';
    const firstId = selectedContactIds[0];
    return contacts.find((c) => c.id === firstId)?.name || 'Priya Sharma';
  }, [audienceSource, csvSummary, selectedContactIds, contacts]);

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFilename(file.name);
    const content = await file.text();
    const lines = content.split(/\r?\n/);
    const filtered = lines.filter((line, idx) => {
      if (idx === 0 && /phone|mobile|waid/i.test(line)) return false;
      return Boolean(line.trim());
    });
    setCsvRawText(filtered.join('\n'));
  };

  const handleLaunch = async () => {
    if (!campaignName.trim() || !selectedTemplateId || recipientCount === 0) {
      setFeedback({ type: 'error', text: 'Provide a campaign name, approved template, and at least one recipient.' });
      return;
    }

    setLaunching(true);
    setFeedback(null);
    try {
      const payload = {
        name: campaignName.trim(),
        templateId: selectedTemplateId,
        variables,
        ...(audienceSource === 'csv'
          ? { importedRecipients: csvSummary.valid }
          : { contactIds: selectedContactIds }),
      };

      const data = await apiFetch('/api/broadcasts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setFeedback({ type: 'success', text: data.message || 'Broadcast campaign queued for dispatch.' });
      setCampaignName('');
      setMode('list');
      await loadBroadcastWorkspace();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="page-scroll-container" data-node-id="2:8">
      <div className="workspace-page-header" style={{ padding: '20px 0 18px 0' }}>
        <div className="page-header-text">
          {mode === 'create' && (
            <button type="button" className="page-back-link" onClick={() => setMode('list')}>
              <ArrowLeft size={13} />
              <span>All broadcasts</span>
            </button>
          )}
          <h1 className="page-header-title">
            {mode === 'create' ? (campaignName.trim() || 'Create campaign') : 'Broadcast campaigns'}
          </h1>
          <p className="page-header-subtitle">
            {mode === 'create'
              ? 'Review your audience and approved template message before launching.'
              : 'Reach opted-in WhatsApp customers at scale with delivery and read tracking.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {mode === 'list' ? (
            <button type="button" className="btn btn-primary" onClick={() => setMode('create')}>
              <Plus size={15} />
              <span>Create campaign</span>
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => setMode('list')}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className={`tb-alert ${feedback.type}`} style={{ marginBottom: '16px' }}>
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
          >
            ×
          </button>
        </div>
      )}

      {mode === 'list' ? (
        <div className="page-card">
          <div className="page-card-header">
            <div>
              <h2 className="page-card-title">Recent campaigns</h2>
              <p className="page-card-subtitle">{broadcasts.length} total campaigns in this workspace</p>
            </div>
          </div>

          {loading ? (
            <p className="tb-hint">Loading broadcast history...</p>
          ) : broadcasts.length === 0 ? (
            <div style={{ padding: '28px 0', textAlign: 'center' }}>
              <p className="page-card-title" style={{ marginBottom: '6px' }}>No broadcasts launched yet</p>
              <p className="tb-hint" style={{ marginBottom: '14px' }}>
                Launch your first WhatsApp template campaign to reach workspace contacts or CSV leads.
              </p>
              <button type="button" className="btn btn-primary" onClick={() => setMode('create')}>
                Create first campaign
              </button>
            </div>
          ) : (
            <div className="tb-table-wrap">
              <table className="tb-table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Template</th>
                    <th>Status</th>
                    <th>Sent</th>
                    <th>Delivered</th>
                    <th>Read</th>
                    <th>Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {broadcasts.map((bc) => (
                    <tr key={bc.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{bc.name}</div>
                        <div className="tb-hint">{bc.totalCount} recipients</div>
                      </td>
                      <td>{bc.template?.name || 'Template'}</td>
                      <td>
                        <span className={`page-pill-badge ${bc.status === 'FAILED' ? 'warning' : ''}`}>
                          {bc.status}
                        </span>
                      </td>
                      <td>{bc.sentCount || 0}</td>
                      <td>{bc.deliveredCount || 0}</td>
                      <td>{bc.readCount || 0}</td>
                      <td>{bc.failedCount || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="broadcast-stepper">
            <div className="stepper-step">
              <div className="stepper-circle">
                <Check size={14} />
              </div>
              <div>
                <div className="stepper-title">Audience</div>
                <div className="stepper-sub">{recipientCount} contacts selected</div>
              </div>
            </div>
            <div className="stepper-step">
              <div className="stepper-circle">
                <Check size={14} />
              </div>
              <div>
                <div className="stepper-title">Message</div>
                <div className="stepper-sub">{selectedTemplate?.name || 'Pick a template'}</div>
              </div>
            </div>
            <div className="stepper-step">
              <div className="stepper-circle active">3</div>
              <div>
                <div className="stepper-title">Review &amp; send</div>
                <div className="stepper-sub">Ready to launch</div>
              </div>
            </div>
          </div>

          <div className="page-two-col">
            <div className="page-stack">
              <div className="page-card">
                <div className="page-card-header">
                  <div>
                    <h3 className="page-card-title">
                      <span className="page-step-badge">01</span> Your audience
                    </h3>
                    <p className="page-card-subtitle">Select workspace contacts or import a CSV phone list</p>
                  </div>
                  <div className="sandbox-type-pills">
                    <button
                      type="button"
                      className={`sandbox-type-pill ${audienceSource === 'contacts' ? 'active' : ''}`}
                      onClick={() => setAudienceSource('contacts')}
                    >
                      Inbox contacts ({contacts.length})
                    </button>
                    <button
                      type="button"
                      className={`sandbox-type-pill ${audienceSource === 'csv' ? 'active' : ''}`}
                      onClick={() => setAudienceSource('csv')}
                    >
                      CSV / Paste
                    </button>
                  </div>
                </div>

                <div className="tb-field" style={{ marginBottom: '14px' }}>
                  <label className="tb-label">Campaign name</label>
                  <input
                    type="text"
                    className="tb-input"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="Summer collection launch"
                  />
                </div>

                {audienceSource === 'csv' ? (
                  <div className="page-stack" style={{ gap: '10px' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'var(--tb-light-bg)',
                        border: '1px solid var(--tb-border-color)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 500 }}>
                        <Upload size={15} />
                        <span>{csvFilename || 'Upload CSV file (phone,name per row)'}</span>
                      </div>
                      <span className="page-pill-badge">Browse CSV</span>
                      <input type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleCsvUpload} />
                    </label>
                    <textarea
                      rows={4}
                      className="tb-textarea"
                      value={csvRawText}
                      onChange={(e) => setCsvRawText(e.target.value)}
                      placeholder={'919876543210,Priya Sharma\n919811112222,Aarav Patel'}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      maxHeight: '160px',
                      overflowY: 'auto',
                      border: '1px solid var(--tb-border-color)',
                      borderRadius: '8px',
                      padding: '8px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                    }}
                  >
                    {contacts.length === 0 ? (
                      <span className="tb-hint" style={{ padding: '6px' }}>
                        No contacts in inbox yet. Switch to CSV / Paste to add recipients directly.
                      </span>
                    ) : (
                      contacts.map((contact) => {
                        const checked = selectedContactIds.includes(contact.id);
                        return (
                          <button
                            key={contact.id}
                            type="button"
                            className={`sandbox-type-pill ${checked ? 'active' : ''}`}
                            onClick={() =>
                              setSelectedContactIds((prev) =>
                                prev.includes(contact.id)
                                  ? prev.filter((id) => id !== contact.id)
                                  : [...prev, contact.id]
                              )
                            }
                          >
                            {checked ? '✓ ' : ''}{contact.name || `+${contact.waId}`}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                <div className="audience-metrics-row">
                  <div>
                    <div className="audience-metric-num">{recipientCount}</div>
                    <div className="audience-metric-label">Eligible recipients</div>
                  </div>
                  <div>
                    <div className="audience-metric-num">{audienceSource === 'csv' ? csvSummary.invalidCount : 0}</div>
                    <div className="audience-metric-label">Invalid numbers excluded</div>
                  </div>
                  <div>
                    <div className="audience-metric-num">{audienceSource === 'csv' ? csvSummary.duplicateCount : 0}</div>
                    <div className="audience-metric-label">Duplicates removed</div>
                  </div>
                </div>
              </div>

              <div className="page-card">
                <div className="page-card-header">
                  <div>
                    <h3 className="page-card-title">
                      <span className="page-step-badge">02</span> Your message
                    </h3>
                    <p className="page-card-subtitle">Choose an approved Meta template and bind variables</p>
                  </div>
                  {selectedTemplate && <span className="page-pill-badge">✓ Approved</span>}
                </div>

                <div className="tb-field" style={{ marginBottom: '12px' }}>
                  <label className="tb-label">Approved template</label>
                  <select
                    className="tb-select"
                    value={selectedTemplateId}
                    onChange={(e) => {
                      setSelectedTemplateId(e.target.value);
                      setVariables({});
                    }}
                  >
                    {templates.length === 0 && <option value="">No approved templates synced</option>}
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name} ({tpl.category} · {tpl.language})
                      </option>
                    ))}
                  </select>
                </div>

                {variableIndexes.length > 0 && (
                  <div className="tb-form-grid-2">
                    {variableIndexes.map((idx) => (
                      <div key={idx} className="tb-field">
                        <label className="tb-label">Variable · {`{{${idx}}}`}</label>
                        <input
                          type="text"
                          className="tb-input"
                          value={variables[idx] || ''}
                          onChange={(e) => setVariables((prev) => ({ ...prev, [idx]: e.target.value }))}
                          placeholder={idx === 1 ? 'Defaults to recipient name' : `Sample ${idx}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="page-card">
                <div className="page-card-header" style={{ marginBottom: '8px' }}>
                  <h3 className="page-card-title">
                    <span className="page-step-badge">03</span> Delivery
                  </h3>
                  <span className="tb-hint">Dispatched via Meta Cloud API queue</span>
                </div>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      checked={deliveryMode === 'now'}
                      onChange={() => setDeliveryMode('now')}
                    />
                    <span>Send immediately</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="page-stack">
              <div className="page-card">
                <div className="page-card-header">
                  <span className="details-section-label">WHATSAPP PREVIEW</span>
                  <span className="page-pill-badge neutral">
                    <Users size={12} />
                    <span>{sampleRecipientName}</span>
                  </span>
                </div>

                <div className="wa-preview-surface">
                  <div className="wa-preview-bubble">
                    <div className="wa-preview-header">{(tenant?.name || 'TEAMBEE').toUpperCase()}</div>
                    <div className="wa-preview-body">
                      {selectedTemplate
                        ? renderTemplateBody(selectedTemplate.bodyText, {
                            ...variables,
                            ...(variables[1] ? {} : { 1: sampleRecipientName }),
                          })
                        : 'Select an approved template to preview message delivery.'}
                    </div>
                    <div className="wa-preview-footer">
                      <span>{selectedTemplate?.footerText || 'Official WhatsApp message'}</span>
                    </div>
                  </div>
                  {ctaButtons.map((btn, i) => (
                    <div key={i} className="wa-preview-cta">
                      ↗ {typeof btn === 'string' ? btn : btn.text || btn.title}
                    </div>
                  ))}
                </div>
              </div>

              <div className="page-card">
                <h3 className="page-card-title" style={{ marginBottom: '6px' }}>Ready when you are</h3>
                <p className="page-card-subtitle" style={{ marginBottom: '14px' }}>
                  {recipientCount} recipient{recipientCount === 1 ? '' : 's'} · Sends immediately. Delivery receipts and failures stream live after launch.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '11px 16px' }}
                  disabled={launching || recipientCount === 0 || !selectedTemplateId}
                  onClick={handleLaunch}
                >
                  {launching ? 'Launching campaign...' : 'Launch broadcast ↗'}
                </button>
                {tenant?.displayPhoneNumber && (
                  <div className="tb-hint" style={{ textAlign: 'center', marginTop: '8px' }}>
                    Sending from {tenant.displayPhoneNumber}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
