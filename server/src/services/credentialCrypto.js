const crypto = require('crypto');

const PREFIX = 'enc:v1:';

function hashSecret(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function getKey() {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw) return null;
  return crypto.createHash('sha256').update(raw).digest();
}

function encryptSecret(value) {
  if (typeof value !== 'string' || !value || value.startsWith(PREFIX)) return value;
  const key = getKey();
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CREDENTIAL_ENCRYPTION_KEY is required to store tenant credentials');
    }
    return value;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function decryptSecret(value) {
  if (typeof value !== 'string' || !value.startsWith(PREFIX)) return value;
  const key = getKey();
  if (!key) throw new Error('CREDENTIAL_ENCRYPTION_KEY is required to decrypt tenant credentials');
  const parts = value.slice(PREFIX.length).split('.');
  if (parts.length !== 3) throw new Error('Invalid encrypted credential format');
  const [iv, tag, ciphertext] = parts.map((part) => Buffer.from(part, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = { encryptSecret, decryptSecret, hashSecret };
