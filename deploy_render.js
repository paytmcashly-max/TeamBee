/**
 * Render Deployment Automation Script
 * Deploys TeamBee Backend and Frontend to Render and synchronizes Environment Variables
 */
const https = require('https');

require('dotenv').config({ path: require('path').resolve(__dirname, 'server/.env') });

const API_KEY = process.env.RENDER_API_KEY;
const GITHUB_REPO = process.env.GITHUB_REPO || 'https://github.com/paytmcashly-max/TeamBee';
const BRANCH = process.env.RENDER_BRANCH || 'main';

const BACKEND_ENV_VARS = [
  { key: 'PORT', value: process.env.PORT || '5000' },
  { key: 'NODE_ENV', value: 'production' },
  { key: 'TRUST_PROXY', value: 'true' },
  { key: 'COOKIE_SAME_SITE', value: 'none' },
  { key: 'COOKIE_SECURE', value: 'true' },
  { key: 'META_ALLOW_MOCK', value: process.env.META_ALLOW_MOCK || 'false' },
  ...(process.env.DATABASE_URL ? [{ key: 'DATABASE_URL', value: process.env.DATABASE_URL }] : []),
  ...(process.env.JWT_SECRET ? [{ key: 'JWT_SECRET', value: process.env.JWT_SECRET }] : []),
  ...(process.env.CREDENTIAL_ENCRYPTION_KEY ? [{ key: 'CREDENTIAL_ENCRYPTION_KEY', value: process.env.CREDENTIAL_ENCRYPTION_KEY }] : []),
  ...(process.env.META_API_VERSION ? [{ key: 'META_API_VERSION', value: process.env.META_API_VERSION }] : [{ key: 'META_API_VERSION', value: 'v20.0' }]),
  ...(process.env.META_ACCESS_TOKEN ? [{ key: 'META_ACCESS_TOKEN', value: process.env.META_ACCESS_TOKEN }] : []),
  ...(process.env.META_APP_SECRET ? [{ key: 'META_APP_SECRET', value: process.env.META_APP_SECRET }] : []),
  ...(process.env.META_WEBHOOK_VERIFY_TOKEN ? [{ key: 'META_WEBHOOK_VERIFY_TOKEN', value: process.env.META_WEBHOOK_VERIFY_TOKEN }] : []),
  { key: 'CORS_ORIGINS', value: process.env.CORS_ORIGINS || 'https://teambee-frontend.onrender.com' },
  { key: 'CLIENT_URL', value: process.env.CLIENT_URL || 'https://teambee-frontend.onrender.com' },
  ...(process.env.R2_ACCOUNT_ID ? [{ key: 'R2_ACCOUNT_ID', value: process.env.R2_ACCOUNT_ID }] : []),
  ...(process.env.R2_ACCESS_KEY_ID ? [{ key: 'R2_ACCESS_KEY_ID', value: process.env.R2_ACCESS_KEY_ID }] : []),
  ...(process.env.R2_SECRET_ACCESS_KEY ? [{ key: 'R2_SECRET_ACCESS_KEY', value: process.env.R2_SECRET_ACCESS_KEY }] : []),
  ...(process.env.R2_BUCKET_NAME ? [{ key: 'R2_BUCKET_NAME', value: process.env.R2_BUCKET_NAME }] : []),
  ...(process.env.R2_PUBLIC_DOMAIN ? [{ key: 'R2_PUBLIC_DOMAIN', value: process.env.R2_PUBLIC_DOMAIN }] : []),
];

async function apiRequest(path, method = 'GET', data = null) {
  const options = {
    method: method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  };
  if (data) {
    options.body = JSON.stringify(data);
  }

  const res = await fetch(`https://api.render.com/v1${path}`, options);
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (e) {
    parsed = { raw: text };
  }

  if (res.ok) {
    return parsed;
  } else {
    throw { status: res.status, error: parsed };
  }
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
          healthCheckPath: '/health',
          envSpecificDetails: {
            buildCommand: 'npm ci --include=dev && npx prisma generate',
            startCommand: 'npm start'
          }
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
      console.error('⚠️ Note: plan "free" gave:', err.error?.message || err.message || err);
      console.log('🔄 Trying with plan "starter"...');
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
          healthCheckPath: '/health',
          envSpecificDetails: {
            buildCommand: 'npm ci --include=dev && npx prisma generate',
            startCommand: 'npm start'
          }
        },
        envVars: BACKEND_ENV_VARS
      });
      console.log(`✅ Backend Web Service created! ID: ${backendService.id}`);
    }
  } else {
    console.log(`ℹ️ Backend service exists: ${backendService.name} (${backendService.id})`);
    console.log('⚙️ Synchronizing Backend build command & environment variables in Render...');
    await apiRequest(`/services/${backendService.id}`, 'PATCH', {
      branch: BRANCH,
      serviceDetails: {
        envSpecificDetails: {
          buildCommand: 'npm ci --include=dev && npx prisma generate',
          startCommand: 'npm start',
        },
      },
    }).catch(() => {});
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

  // 5. Update Backend CORS to exact Frontend origin (no wildcard)
  console.log('🔒 Locking Backend CORS to exact Frontend origin...');
  const updatedBackendEnvs = BACKEND_ENV_VARS.map((v) => {
    if (v.key === 'CORS_ORIGINS' || v.key === 'CLIENT_URL') {
      return { key: v.key, value: frontendUrl };
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
