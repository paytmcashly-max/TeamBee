// Transactional email, provider-agnostic. Dormant until configured:
// with RESEND_API_KEY set, mail flows through Resend's HTTP API (no SDK
// dependency); without it, sends report EMAIL_NOT_CONFIGURED and the
// calling feature degrades gracefully (e.g. password reset answers with
// the same generic message either way, so nothing leaks).
const axios = require('axios');

function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

function fromAddress() {
  return process.env.EMAIL_FROM || 'TeamBee <onboarding@resend.dev>';
}

async function sendEmail({ to, subject, html, text }) {
  if (!emailConfigured()) {
    console.log(`[Email] NOT CONFIGURED — would have sent "${subject}" to ${to}`);
    return { success: false, code: 'EMAIL_NOT_CONFIGURED' };
  }
  try {
    const response = await axios.post(
      'https://api.resend.com/emails',
      { from: fromAddress(), to, subject, html, text },
      {
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );
    return { success: true, id: response.data?.id };
  } catch (err) {
    console.error('[Email] send failed:', err.response?.data || err.message);
    return { success: false, code: 'EMAIL_SEND_FAILED', error: err.response?.data?.message || err.message };
  }
}

function appBaseUrl() {
  const clientUrl = (process.env.CLIENT_URL || '').split(',')[0].trim();
  return (clientUrl || 'https://teambee-frontend.onrender.com').replace(/\/+$/, '');
}

module.exports = { sendEmail, emailConfigured, appBaseUrl };
