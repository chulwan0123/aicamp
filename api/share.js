import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { buildScenarios } from './_lib/scenarios.js';
import { assemble } from './_lib/assemble.js';

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

function shareValue(session) {
  const advice = session?.advice;
  if (!advice?.details || !advice?.recommended || !advice?.profile) return session;
  return {
    _shareSnapshotVersion: 1,
    property: session.property,
    properties: session.properties,
    subject: session.subject,
    answers: session.answers,
    refinements: session.refinements,
    draft: {
      profile: advice.profile,
      cashflowSummary: advice.cashflow?.summary,
      recommendedId: advice.recommended.id,
      label: advice.recommended.label,
      headline: advice.recommended.headline,
      why: advice.recommended.why,
      tradeoff: advice.recommended.tradeoff,
      cautions: advice.recommended.cautions,
      actionPlan: advice.recommended.actionPlan,
      alternatives: (advice.alternatives || []).map(({ id, oneLiner }) => ({ id, oneLiner })),
      excluded: (advice.excluded || []).map(({ id, reason }) => ({ id, reason })),
      familyNote: advice.familyNote,
    },
  };
}

function restoreValue(value) {
  if (value?._shareSnapshotVersion !== 1) return value;
  const properties = Array.isArray(value.properties) && value.properties.length ? value.properties : [value.property];
  const subject = { ...value.subject, refinements: value.refinements || value.subject?.refinements || {} };
  const computed = buildScenarios({ property: value.property, properties, subject });
  return {
    property: value.property,
    properties,
    subject: value.subject,
    answers: value.answers || {},
    refinements: value.refinements || {},
    advice: assemble({ computed, draft: value.draft, property: value.property, subject }),
    chatHistory: [],
  };
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const plaintext = zlib.brotliCompressSync(
    Buffer.from(JSON.stringify({ value, exp: Date.now() + MAX_AGE_MS }), 'utf8'),
    { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 7 } },
  );
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v2.${encode(iv)}.${encode(tag)}.${encode(ciphertext)}`;
}

function decrypt(token) {
  const parts = String(token || '').split('.');
  const compressed = parts[0] === 'v2';
  if ((compressed && parts.length !== 4) || (!compressed && parts.length !== 3)) throw new Error('공유 링크 형식이 올바르지 않습니다.');
  const encoded = compressed ? parts.slice(1) : parts;
  const [iv, tag, ciphertext] = encoded.map((part) => Buffer.from(part, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const plaintext = compressed ? zlib.brotliDecompressSync(decrypted) : decrypted;
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
      res.status(200).json({ token: encrypt(shareValue(body.session)), expiresIn: Math.floor(MAX_AGE_MS / 1000) });
    } catch (error) {
      res.status(400).json({ error: String(error.message || error) });
    }
    return;
  }

  if (req.method === 'GET') {
    try {
      res.status(200).json({ session: restoreValue(decrypt(req.query?.token)) });
    } catch (error) {
      res.status(400).json({ error: String(error.message || error) });
    }
    return;
  }

  res.status(405).json({ error: 'GET 또는 POST만 지원합니다.' });
}
