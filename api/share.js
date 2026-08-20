import crypto from 'node:crypto';

const MAX_BODY_BYTES = 64 * 1024;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function key() {
  const secret = process.env.SHARE_SECRET;
  if (!secret || secret.length < 32) throw new Error('SHARE_SECRET 설정이 필요합니다.');
  return crypto.createHash('sha256').update(secret).digest();
}

function encode(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const plaintext = Buffer.from(JSON.stringify({ value, exp: Date.now() + MAX_AGE_MS }), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${encode(iv)}.${encode(tag)}.${encode(ciphertext)}`;
}

function decrypt(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('공유 링크 형식이 올바르지 않습니다.');
  const [iv, tag, ciphertext] = parts.map((part) => Buffer.from(part, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const payload = JSON.parse(plaintext.toString('utf8'));
  if (!payload.exp || Date.now() > payload.exp) throw new Error('공유 링크가 만료되었습니다.');
  return payload.value;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'POST') {
    try {
      const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
      if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) throw new Error('공유 데이터가 너무 큽니다.');
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!body.session || typeof body.session !== 'object' || Array.isArray(body.session)) throw new Error('공유할 결과가 없습니다.');
      res.status(200).json({ token: encrypt(body.session), expiresIn: Math.floor(MAX_AGE_MS / 1000) });
    } catch (error) {
      res.status(400).json({ error: String(error.message || error) });
    }
    return;
  }

  if (req.method === 'GET') {
    try {
      res.status(200).json({ session: decrypt(req.query?.token) });
    } catch (error) {
      res.status(400).json({ error: String(error.message || error) });
    }
    return;
  }

  res.status(405).json({ error: 'GET 또는 POST만 지원합니다.' });
}
