/**
 * Request URL helpers resilient behind TLS-terminating reverse proxies (e.g. Render, Nginx).
 */
function getExternalBaseUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const rawProto = typeof forwardedProto === 'string' && forwardedProto.trim()
    ? forwardedProto.split(',')[0].trim().toLowerCase()
    : String(req.protocol || 'http').toLowerCase();
  const protocol = rawProto === 'https' ? 'https' : 'http';
  const rawHost = typeof req.get === 'function' ? req.get('host') : req.headers?.host;
  const safeHost = String(rawHost || 'localhost').replace(/[^a-zA-Z0-9.:-]/g, '');
  return `${protocol}://${safeHost}`;
}

module.exports = {
  getExternalBaseUrl,
};
