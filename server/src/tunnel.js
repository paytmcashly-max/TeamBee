const localtunnel = require('localtunnel');

const PORT = process.env.PORT || 5000;
const SUBDOMAIN = process.env.TUNNEL_SUBDOMAIN || 'chatflow-teambee-2026';

async function startTunnel() {
  console.log(`🌐 Initiating public HTTPS tunnel for Meta Webhook on port ${PORT}...`);
  try {
    const tunnel = await localtunnel({
      port: PORT,
      subdomain: SUBDOMAIN,
    });

     console.log('================================================================');
     console.log(`✅ PUBLIC META WEBHOOK URL: ${tunnel.url}/webhook`);
     console.log('Configure the tenant webhook verification token in the database or META_WEBHOOK_VERIFY_TOKEN.');
    console.log('================================================================');

    tunnel.on('close', () => {
      console.warn('⚠️ Tunnel closed. Reconnecting in 3 seconds...');
      setTimeout(startTunnel, 3000);
    });

    tunnel.on('error', (err) => {
      console.error('Tunnel error:', err);
      tunnel.close();
    });
  } catch (err) {
    console.error('Failed to start localtunnel:', err.message);
    console.log('Retrying in 5 seconds with random subdomain...');
    setTimeout(async () => {
      try {
        const fallbackTunnel = await localtunnel({ port: PORT });
        console.log(`✅ FALLBACK PUBLIC WEBHOOK URL: ${fallbackTunnel.url}/webhook`);
      } catch (e) {
        console.error('Fallback tunnel error:', e.message);
      }
    }, 5000);
  }
}

startTunnel();
