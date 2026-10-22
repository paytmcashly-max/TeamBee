/**
 * Render Deployment Automation Script
 * Deploys TeamBee Backend and Frontend to Render and synchronizes Environment Variables
 */
const https = require('https');

const API_KEY = process.env.RENDER_API_KEY || 'rnd_VOzazcTOYntLPUb9D5hcGVer0q4g';
const GITHUB_REPO = 'https://github.com/paytmcashly-max/TeamBee';
const BRANCH = 'main';

const BACKEND_ENV_VARS = [
  { key: 'PORT', value: '5000' },
  { key: 'NODE_ENV', value: 'production' },
  { key: 'DATABASE_URL', value: 'postgresql://neondb_owner:npg_rXNdsvW4hH2g@ep-weathered-meadow-akt3lhh6.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require' },
  { key: 'JWT_SECRET', value: 'chatflow_super_secret_jwt_key_2026_indian_smb' },
  { key: 'CREDENTIAL_ENCRYPTION_KEY', value: 'teambee_credential_encryption_key_secure_2026_prod' },
  { key: 'META_API_VERSION', value: 'v20.0' },
  { key: 'META_ACCESS_TOKEN', value: 'EAAUzCgD1Xc0BSoz5wHEPaIHhQqNB1ABsHmZAPrTvRZAkVgzTvOyqCAbIZBUPVU9rFfbTy9yKrqoAOCLmhC0fAFuZCANDg83hVTqi5BjBZAMZBEpZCaS03j5rkx2IgxWQsAUnqUp7hYzSqDZB7qyMJqqf81aXTDBlKIEzSFzPtfW4nrPuHpe9GnB6ZBLi5YLOS3hwQvQZDZD' },
  { key: 'META_APP_SECRET', value: 'e67f26c4721cb2e3292c6118f73ddaf2' },
  { key: 'META_WEBHOOK_VERIFY_TOKEN', value: 'chatflow_whatsapp_webhook_secret_2026' },
  { key: 'CORS_ORIGINS', value: '*' },
  { key: 'CLIENT_URL', value: '*' }
];

function apiRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.render.com',
      port: 443,
      path: '/v1' + path,
      method: method,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject({ status: res.statusCode, error: parsed });
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ raw: body });
          } else {
            reject({ status: res.statusCode, raw: body });
          }
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function main() {
  console.log('=====================================================');
  console.log('🚀 TeamBee Render Automated Deployment Engine');
  console.log('=====================================================\n');

  // 1. Fetch Owner / Workspace
  console.log('📡 Fetching Render workspace owners...');
  const owners = await apiRequest('/owners');
  if (!owners || owners.length === 0) {
    throw new Error('No Render owners/workspaces found for this API key.');
  }
  const owner = owners[0].owner;
  console.log(`✅ Logged in as: ${owner.name} (${owner.email || owner.id}) [Owner ID: ${owner.id}]\n`);

  // 2. Fetch Existing Services
  console.log('📡 Fetching existing Render services...');
  const existingServicesRes = await apiRequest('/services?limit=100');
  const existingServices = (existingServicesRes || []).map((s) => s.service || s);
  console.log(`📋 Found ${existingServices.length} existing service(s) on Render:`);
  existingServices.forEach((s) => {
    console.log(`   - [${s.type}] ${s.name} (ID: ${s.id}, Repo: ${s.repo || 'none'}, URL: ${s.serviceDetails?.url || 'n/a'})`);
  });

  let backendService = existingServices.find(
    (s) => s.name === 'teambee-backend' || s.name === 'teambee-server' || s.name.includes('backend')
  );
  let frontendService = existingServices.find(
    (s) => s.name === 'teambee-frontend' || s.name === 'teambee-client' || s.name.includes('frontend')
  );



  // 3. Create or Update Backend Web Service
  if (!backendService) {
    console.log('📦 Creating Backend Web Service (Node.js)...');
    try {
      backendService = await apiRequest('/services', 'POST', {
        type: 'web_service',
        name: 'teambee-backend',
        ownerId: owner.id,
        repo: GITHUB_REPO,
        branch: BRANCH,
        autoDeploy: 'yes',
        rootDir: 'server',
        serviceDetails: {
          env: 'node',
          plan: 'free',
          region: 'oregon',
          buildCommand: 'npm install && npx prisma generate',
          startCommand: 'npm start',
          healthCheckPath: '/health'
        },
        envVars: BACKEND_ENV_VARS
      });
      console.log(`✅ Backend Web Service created! ID: ${backendService.id}`);
    } catch (err) {
      if (err.error?.message?.includes('unfetchable')) {
        console.error('\n⚠️ GITHUB PERMISSION ERROR:');
        console.error('Render cannot access "https://github.com/paytmcashly-max/TeamBee" because the repo is Private and Render does not have permission yet.');
        console.error('\nQuick Fixes:');
        console.error('1) Make repo Public:  gh repo edit paytmcashly-max/TeamBee --visibility public --accept-visibility-change-consequences');
        console.error('2) OR Grant Render App access: https://github.com/apps/render/installations/new');
        throw err;
      }
      console.error('❌ Failed to create backend with plan "free", trying "starter"...', err);
      backendService = await apiRequest('/services', 'POST', {
        type: 'web_service',
        name: 'teambee-backend',
        ownerId: owner.id,
        repo: GITHUB_REPO,
        branch: BRANCH,
        autoDeploy: 'yes',
        rootDir: 'server',
        serviceDetails: {
          env: 'node',
          plan: 'starter',
          region: 'oregon',
          buildCommand: 'npm install && npx prisma generate',
          startCommand: 'npm start',
          healthCheckPath: '/health'
        },
        envVars: BACKEND_ENV_VARS
      });
      console.log(`✅ Backend Web Service created! ID: ${backendService.id}`);
    }
  } else {
    console.log(`ℹ️ Backend service exists: ${backendService.name} (${backendService.id})`);
    console.log('⚙️ Updating Backend environment variables in Render...');
    await apiRequest(`/services/${backendService.id}/env-vars`, 'PUT', BACKEND_ENV_VARS);
    console.log('✅ Backend environment variables synchronized!');
  }

  const backendUrl =
    backendService.serviceDetails?.url ||
    `https://${backendService.slug || backendService.name}.onrender.com`;
  console.log(`🌐 Backend URL: ${backendUrl}\n`);

  // 4. Create or Update Frontend Static Site
  const frontendEnvVars = [{ key: 'VITE_API_URL', value: backendUrl }];

  if (!frontendService) {
    console.log('📦 Creating Frontend Static Site (Vite React)...');
    frontendService = await apiRequest('/services', 'POST', {
      type: 'static_site',
      name: 'teambee-frontend',
      ownerId: owner.id,
      repo: GITHUB_REPO,
      branch: BRANCH,
      autoDeploy: 'yes',
      rootDir: 'client',
      serviceDetails: {
        buildCommand: 'npm install && npm run build',
        publishPath: 'dist',
        pullRequestPreviewsEnabled: 'no'
      },
      envVars: frontendEnvVars
    });
    console.log(`✅ Frontend Static Site created! ID: ${frontendService.id}`);
  } else {
    console.log(`ℹ️ Frontend service exists: ${frontendService.name} (${frontendService.id})`);
    console.log('⚙️ Updating Frontend environment variables (VITE_API_URL)...');
    await apiRequest(`/services/${frontendService.id}/env-vars`, 'PUT', frontendEnvVars);
    console.log('✅ Frontend environment variables synchronized!');
  }

  const frontendUrl =
    frontendService.serviceDetails?.url ||
    `https://${frontendService.slug || frontendService.name}.onrender.com`;
  console.log(`🌐 Frontend URL: ${frontendUrl}\n`);

  // 5. Update Backend CORS to include the exact Frontend URL
  console.log('🔒 Locking Backend CORS to Frontend URL & Wildcard...');
  const updatedBackendEnvs = BACKEND_ENV_VARS.map((v) => {
    if (v.key === 'CORS_ORIGINS' || v.key === 'CLIENT_URL') {
      return { key: v.key, value: `${frontendUrl},*` };
    }
    return v;
  });
  await apiRequest(`/services/${backendService.id}/env-vars`, 'PUT', updatedBackendEnvs);

  // 6. Trigger Deployments
  console.log('\n🚀 Triggering live deployment for Backend...');
  const backendDeploy = await apiRequest(`/services/${backendService.id}/deploys`, 'POST', {
    clearCache: 'clear'
  });
  console.log(`✅ Backend deployment triggered! Deploy ID: ${backendDeploy.id}`);

  console.log('🚀 Triggering live deployment for Frontend...');
  const frontendDeploy = await apiRequest(`/services/${frontendService.id}/deploys`, 'POST', {
    clearCache: 'clear'
  });
  console.log(`✅ Frontend deployment triggered! Deploy ID: ${frontendDeploy.id}`);

  console.log('\n=====================================================');
  console.log('🎉 DEPLOYMENT LAUNCHED SUCCESSFULLY ON RENDER!');
  console.log('=====================================================');
  console.log(`Backend API Service:    ${backendUrl}`);
  console.log(`Frontend Web Client:   ${frontendUrl}`);
  console.log(`Render Dashboard:      https://dashboard.render.com`);
  console.log('=====================================================\n');
}

main().catch((err) => {
  console.error('\n❌ Deployment failed:');
  console.error(JSON.stringify(err, null, 2));
  process.exit(1);
});
