import React, { useState, useEffect } from 'react';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

// Inbound media lives behind Meta's expiring URLs, so it is streamed through
// the authenticated backend proxy. The JWT travels in a header, so the binary
// is fetched as a blob and rendered from an object URL.
export default React.memo(function AuthedMedia({ messageId, kind, token, filename }) {
  const [objectUrl, setObjectUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let revoked = false;
    let createdUrl = null;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/messages/media/${messageId}`, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('media fetch failed');
        const blob = await res.blob();
        createdUrl = URL.createObjectURL(blob);
        if (!revoked) setObjectUrl(createdUrl);
      } catch (err) {
        if (!revoked) setFailed(true);
      }
    })();
    return () => {
      revoked = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [messageId, token]);

  if (failed) {
    return (
      <div className="media-placeholder">Media unavailable</div>
    );
  }
  if (!objectUrl) {
    return (
      <div className="media-placeholder">Loading media…</div>
    );
  }
  if (kind === 'IMAGE') {
    return <img src={objectUrl} alt="WhatsApp Attachment" loading="lazy" decoding="async" className="media-img" />;
  }
  if (kind === 'AUDIO') {
    return <audio controls src={objectUrl} className="media-audio" />;
  }
  if (kind === 'VIDEO') {
    return <video controls preload="metadata" src={objectUrl} className="media-video" />;
  }
  return (
    <a href={objectUrl} target="_blank" rel="noreferrer" className="media-doc">
      {filename || 'Open document'}
    </a>
  );
});

