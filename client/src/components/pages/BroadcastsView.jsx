import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/apiClient';
import BroadcastCampaignBuilder, { parseRecipientLines } from './BroadcastCampaignBuilder';

export default function BroadcastsView() {
  const { tenant } = useAuth();

  const [mode, setMode] = useState('list'); // 'list' | 'create'
  const [broadcasts, setBroadcasts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [campaignName, setCampaignName] = useState('');
  const [audienceSource, setAudienceSource] = useState('contacts');
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

  const handleLaunch = async (csvSummaryOverride) => {
    const csvSummary = csvSummaryOverride || parseRecipientLines(csvRawText);
    const count = audienceSource === 'csv' ? csvSummary.valid.length : selectedContactIds.length;
    if (!campaignName.trim() || !selectedTemplateId || count === 0) {
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
        <BroadcastCampaignBuilder
          tenant={tenant}
          templates={templates}
          contacts={contacts}
          campaignName={campaignName}
          setCampaignName={setCampaignName}
          audienceSource={audienceSource}
          setAudienceSource={setAudienceSource}
          selectedContactIds={selectedContactIds}
          setSelectedContactIds={setSelectedContactIds}
          csvFilename={csvFilename}
          csvRawText={csvRawText}
          setCsvRawText={setCsvRawText}
          onCsvUpload={handleCsvUpload}
          selectedTemplateId={selectedTemplateId}
          setSelectedTemplateId={setSelectedTemplateId}
          variables={variables}
          setVariables={setVariables}
          deliveryMode={deliveryMode}
          setDeliveryMode={setDeliveryMode}
          launching={launching}
          onLaunch={handleLaunch}
        />
      )}
    </div>
  );
}
