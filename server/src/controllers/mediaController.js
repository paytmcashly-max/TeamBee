const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const prisma = require('../db/prisma');
const { decryptSecret } = require('../services/credentialCrypto');
const storageService = require('../services/storageService');

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const META_GRAPH_URL = 'https://graph.facebook.com';
const API_VERSION = process.env.META_API_VERSION || 'v20.0';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/aac',
  'video/mp4',
  'video/webm',
  'text/csv',
  'text/plain',
]);

class MediaController {
  /**
   * POST /api/media/upload
   * Accepts base64 encoded file payload: { filename, mimeType, dataBase64 }
   */
  static async uploadFile(req, res) {
    try {
      const { filename, mimeType, dataBase64 } = req.body;

      if (!filename || typeof filename !== 'string' || !mimeType || !dataBase64) {
        return res.status(400).json({
          success: false,
          error: 'Filename, mimeType, and dataBase64 are required',
        });
      }

      const normalizedMime = mimeType.toLowerCase().trim();
      if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
        return res.status(400).json({
          success: false,
          error: `File type ${mimeType} is not supported. Please upload an image, document, audio, or video file.`,
        });
      }

      // Clean base64 string
      const cleanBase64 = dataBase64.replace(/^data:([A-Za-z-+/]+);base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');

      // Max size: 20MB
      if (buffer.length > 20 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          error: 'File size exceeds maximum permitted limit (20MB)',
        });
      }

      const ext = path.extname(filename).toLowerCase().slice(0, 10) || '.bin';
      const safeRandomName = `${crypto.randomUUID()}${ext}`;
      const destination = path.join(UPLOADS_DIR, safeRandomName);

      let fileUrl = `/api/media/file/${safeRandomName}`;

      if (storageService.isConfigured()) {
        const r2Res = await storageService.uploadBuffer({
          buffer,
          filename,
          mimeType: normalizedMime,
          tenantSlug: req.tenant?.slug || 'default',
        });
        fileUrl = r2Res.url;
      } else {
        fs.writeFileSync(destination, buffer);
      }

      return res.status(201).json({
        success: true,
        url: fileUrl,
        filename: path.basename(filename).slice(0, 150),
        mimeType: normalizedMime,
        size: buffer.length,
      });
    } catch (error) {
      console.error('[Media Upload Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to process file upload' });
    }
  }

  /**
   * GET /api/media/file/:filename
   * Serves uploaded file from local storage
   */
  static async getFile(req, res) {
    try {
      const filename = path.basename(String(req.params.filename || ''));
      if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
        return res.status(400).json({ success: false, error: 'Invalid filename' });
      }
      const resolvedUploadsDir = path.resolve(UPLOADS_DIR);
      const filePath = path.resolve(resolvedUploadsDir, filename);
      if (!filePath.startsWith(`${resolvedUploadsDir}${path.sep}`)) {
        return res.status(403).json({ success: false, error: 'Forbidden file path' });
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'File not found' });
      }

      const ext = path.extname(filename).toLowerCase();
      const mimeMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.pdf': 'application/pdf',
        '.mp3': 'audio/mpeg',
        '.ogg': 'audio/ogg',
        '.wav': 'audio/wav',
        '.mp4': 'video/mp4',
        '.csv': 'text/csv',
      };
      const mimeType = mimeMap[ext];
      if (!mimeType) {
        return res.status(403).json({ success: false, error: 'Unsupported media format' });
      }

      res.setHeader('Content-Type', mimeType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'");
      if (ext === '.csv') {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      }
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      console.error('[Serve File Error]:', error);
      return res.status(500).json({ success: false, error: 'Failed to serve media file' });
    }
  }

  /**
   * GET /api/media/whatsapp/:mediaId
   * Proxies Meta Cloud API media binary with tenant authorization
   */
  static async getWhatsAppMedia(req, res) {
    try {
      const { mediaId } = req.params;
      const runDb = typeof req.db === 'function' ? req.db : (fn) => fn(prisma);
      const tenant = await runDb((db) =>
        db.tenant.findUnique({
          where: { id: req.tenantId },
        })
      );

      if (!tenant) {
        return res.status(404).json({ success: false, error: 'Tenant not found' });
      }

      const accessToken = decryptSecret(tenant.accessToken);
      const isLiveToken = accessToken && accessToken.length > 30 && !accessToken.startsWith('MOCK');

      if (!isLiveToken) {
        const safeMediaId = String(mediaId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'sandbox';
        // Fallback for sandbox/development mode: return a clean placeholder image
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        return res.send(`
          <svg width="400" height="250" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#152e2b"/>
            <text x="50%" y="45%" fill="#6bc398" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">
              WhatsApp Media Sandbox
            </text>
            <text x="50%" y="60%" fill="#9eb0a8" font-family="sans-serif" font-size="12" text-anchor="middle">
              Media ID: ${safeMediaId}
            </text>
          </svg>
        `);
      }

      // Fetch temporary media download URL from Meta Graph API
      const metaRes = await axios.get(`${META_GRAPH_URL}/${API_VERSION}/${mediaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });

      const mediaDownloadUrl = metaRes.data?.url;
      const mediaMimeType = metaRes.data?.mime_type || 'application/octet-stream';

      if (!mediaDownloadUrl) {
        return res.status(404).json({ success: false, error: 'Meta media URL not found' });
      }

      // Download binary stream from Meta CDN with Authorization header
      const streamRes = await axios.get(mediaDownloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: 'stream',
        timeout: 15000,
      });

      res.setHeader('Content-Type', mediaMimeType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return streamRes.data.pipe(res);
    } catch (error) {
      console.error('[WhatsApp Media Proxy Error]:', error.message);
      return res.status(502).json({ success: false, error: 'Failed to retrieve media from Meta Cloud API' });
    }
  }
}

module.exports = MediaController;
