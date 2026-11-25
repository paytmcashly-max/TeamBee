const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');

const META_GRAPH_URL = 'https://graph.facebook.com';
const API_VERSION = process.env.META_API_VERSION || 'v20.0';

const MIME_EXTENSION_MAP = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/aac': 'aac',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'text/csv': 'csv',
  'text/plain': 'txt',
};

const EXTENSION_MIME_MAP = Object.entries(MIME_EXTENSION_MAP).reduce((acc, [mime, ext]) => {
  if (!acc[`.${ext}`]) acc[`.${ext}`] = mime;
  return acc;
}, { '.jpeg': 'image/jpeg' });

function isAllowedMetaMediaUrl(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || ''));
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'fbcdn.net' ||
      host.endsWith('.fbcdn.net') ||
      host === 'fbsbx.com' ||
      host.endsWith('.fbsbx.com') ||
      host === 'facebook.com' ||
      host.endsWith('.facebook.com') ||
      host === 'whatsapp.net' ||
      host.endsWith('.whatsapp.net')
    );
  } catch {
    return false;
  }
}

class StorageService {
  constructor() {
    this.client = null;
    this.mockUploader = null;
    this.init();
  }

  init() {
    this.accountId = process.env.R2_ACCOUNT_ID;
    this.accessKeyId = process.env.R2_ACCESS_KEY_ID;
    this.secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    this.bucketName = process.env.R2_BUCKET_NAME;
    this.publicDomain = (process.env.R2_PUBLIC_DOMAIN || '').replace(/\/+$/, '');

    this.validateConfig();

    if (this.isConfigured()) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${this.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey,
        },
      });
    }
  }

  isConfigured() {
    return Boolean(
      this.accountId &&
      this.accessKeyId &&
      this.secretAccessKey &&
      this.bucketName &&
      this.publicDomain
    );
  }

  validateConfig() {
    const missing = [];
    if (!this.accountId) missing.push('R2_ACCOUNT_ID');
    if (!this.accessKeyId) missing.push('R2_ACCESS_KEY_ID');
    if (!this.secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
    if (!this.bucketName) missing.push('R2_BUCKET_NAME');
    if (!this.publicDomain) missing.push('R2_PUBLIC_DOMAIN');

    if (missing.length > 0) {
      console.warn(
        `[StorageService]: Notice: Cloudflare R2 is inactive. Missing keys: ${missing.join(', ')}. Media will use local storage until R2 environment variables are configured.`
      );
    } else {
      console.log(`[StorageService]: Cloudflare R2 storage initialized for bucket: ${this.bucketName}`);
    }
  }

  /**
   * Inject mock uploader for unit testing / fixtures
   */
  setMockUploader(mockFn) {
    this.mockUploader = mockFn;
  }

  clearMockUploader() {
    this.mockUploader = null;
  }

  /**
   * Upload buffer directly to Cloudflare R2
   */
  async uploadBuffer({ buffer, filename, mimeType, tenantSlug = 'default' }) {
    if (this.mockUploader) {
      return this.mockUploader({ buffer, filename, mimeType, tenantSlug });
    }

    if (!this.isConfigured()) {
      throw new Error('[StorageService]: Cloudflare R2 is not configured.');
    }

    const safeSlug = (tenantSlug || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const ext = MIME_EXTENSION_MAP[mimeType] || path.extname(filename).replace('.', '') || 'bin';
    const cleanBasename = path.basename(filename, path.extname(filename)).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uuid = crypto.randomUUID();
    const key = `tenants/${safeSlug}/${year}/${month}/${uuid}-${cleanBasename}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType || 'application/octet-stream',
      CacheControl: 'public, max-age=31536000, immutable',
    });

    await this.client.send(command);

    const publicUrl = `${this.publicDomain}/${key}`;
    return {
      url: publicUrl,
      key,
      size: buffer.length,
      mimeType,
    };
  }

  /**
   * Eager Ingestion: Download binary from Meta Graph API and upload to Cloudflare R2
   */
  async streamFromMetaAndUpload({ mediaId, accessToken, mimeType, tenantSlug = 'default', originalFilename = null }) {
    if (this.mockUploader) {
      return this.mockUploader({ mediaId, accessToken, mimeType, tenantSlug, originalFilename });
    }

    if (!this.isConfigured()) {
      return null;
    }

    if (!mediaId) {
      throw new Error('[StorageService]: mediaId is required to stream from Meta.');
    }
    if (!accessToken) {
      throw new Error('[StorageService]: Meta accessToken is required.');
    }

    // 1. Query Meta Graph API for direct media download URL
    const metaRes = await axios.get(`${META_GRAPH_URL}/${API_VERSION}/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 10000,
    });

    const downloadUrl = metaRes.data?.url;
    const resolvedMime = metaRes.data?.mime_type || mimeType || 'application/octet-stream';
    if (!downloadUrl || !isAllowedMetaMediaUrl(downloadUrl)) {
      throw new Error(`[StorageService]: Meta returned a missing or invalid media URL for ${mediaId}`);
    }

    // 2. Stream the binary directly from Meta CDN
    const binaryRes = await axios.get(downloadUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      responseType: 'arraybuffer',
      maxRedirects: 2,
      timeout: 30000,
    });

    const buffer = Buffer.from(binaryRes.data);
    const ext = MIME_EXTENSION_MAP[resolvedMime] || 'bin';
    const filename = originalFilename || `meta_${mediaId}.${ext}`;

    // 3. Upload to Cloudflare R2
    return this.uploadBuffer({
      buffer,
      filename,
      mimeType: resolvedMime,
      tenantSlug,
    });
  }
}

const storageService = new StorageService();
storageService.MIME_EXTENSION_MAP = MIME_EXTENSION_MAP;
storageService.EXTENSION_MIME_MAP = EXTENSION_MIME_MAP;
storageService.isAllowedMetaMediaUrl = isAllowedMetaMediaUrl;
module.exports = storageService;
