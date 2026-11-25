import React, { useMemo } from 'react';
import { Upload, Check, Users } from 'lucide-react';
import { getVariableIndexes, parseTemplateButtons, renderTemplateBody } from '../../utils/templateHelpers';

export function parseRecipientLines(rawText) {
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

export default function BroadcastCampaignBuilder({
  tenant,
  templates,
  contacts,
  campaignName,
  setCampaignName,
  audienceSource,
  setAudienceSource,
  selectedContactIds,
  setSelectedContactIds,
  csvFilename,
  csvRawText,
  setCsvRawText,
  onCsvUpload,
  selectedTemplateId,
  setSelectedTemplateId,
  variables,
  setVariables,
  deliveryMode,
  setDeliveryMode,
  launching,
  onLaunch,
}) {
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

  return (
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
                  <input type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={onCsvUpload} />
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
              onClick={() => onLaunch(csvSummary)}
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
  );
}
