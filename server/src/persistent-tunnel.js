const { spawn } = require('child_process');

function startTunnel() {
  console.log('🚀 Starting persistent Pinggy tunnel with 10s TCP KeepAlive...');

  const ssh = spawn('ssh', [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=10',
    '-o', 'ServerAliveCountMax=120',
    '-o', 'TCPKeepAlive=yes',
    '-p', '443',
    '-R0:localhost:5000',
    'a.pinggy.io'
  ]);

  ssh.stdout.on('data', (data) => {
    const text = data.toString();
    const urls = text.match(/https:\/\/[^\s]+/g);
    if (urls) {
      urls.forEach(u => {
        if (u.includes('pinggy')) {
          console.log('================================================================');
          console.log(`🌐 LIVE WEBHOOK URL: ${u}/webhook`);
          console.log('================================================================');
        }
      });
    }
  });

  ssh.stderr.on('data', (data) => {
    const text = data.toString();
    if (!text.includes('Pseudo-terminal')) {
      console.log('[Tunnel]:', text.trim());
    }
  });

  ssh.on('close', (code) => {
    console.warn(`[Tunnel Closed]: Code ${code}. Reconnecting in 3s...`);
    setTimeout(startTunnel, 3000);
  });
}

startTunnel();
