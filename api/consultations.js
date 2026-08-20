import crypto from 'node:crypto';

const MAX_BODY_BYTES = 16 * 1024;
const TIMEOUT_MS = 10_000;
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;
const requestWindows = new Map();

const clean = (value, max) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);

function clientIp(req) {
  return String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function rateLimited(req) {
  const key = clientIp(req);
  const now = Date.now();
  const recent = (requestWindows.get(key) || []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  requestWindows.set(key, recent);
  return recent.length > MAX_REQUESTS_PER_WINDOW;
}

export function validateConsultation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('상담 신청 정보가 올바르지 않습니다.');
  const name = clean(value.name, 40);
  const phone = clean(value.phone, 30).replace(/[^0-9]/g, '');
  const preferredTime = clean(value.preferredTime, 80);
  const note = clean(value.note, 500);
  const resultToken = clean(value.resultToken, 16_000);
  if (name.length < 2) throw new TypeError('신청자 이름을 확인해 주세요.');
  if (phone.length < 9 || phone.length > 11) throw new TypeError('연락처를 확인해 주세요.');
  if (!preferredTime) throw new TypeError('연락받기 편한 시간을 입력해 주세요.');
  const tokenParts = resultToken.split('.');
  if (!resultToken || !([3, 4].includes(tokenParts.length))) throw new TypeError('상담에 연결할 분석 결과가 없습니다.');
  if (value.consent !== true) throw new TypeError('상담을 위한 개인정보 수집·이용 동의가 필요합니다.');
  return { name, phone, preferredTime, note, resultToken };
}

function requestId() {
  return `SC-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

async function deliver(payload) {
  const endpoint = process.env.CONSULTATION_WEBHOOK_URL;
  if (!endpoint) {
    if (String(process.env.USE_MOCK).toLowerCase() === 'true') return { preview: true };
    throw new Error('상담 접수 채널이 아직 설정되지 않았습니다.');
  }
  let url;
  try { url = new URL(endpoint); }
  catch { throw new Error('상담 접수 채널 주소가 올바르지 않습니다.'); }
  if (url.protocol !== 'https:') throw new Error('상담 접수 채널은 HTTPS 주소여야 합니다.');

  const body = JSON.stringify(payload);
  const secret = process.env.CONSULTATION_WEBHOOK_SECRET;
  const signature = secret
    ? crypto.createHmac('sha256', secret).update(body).digest('hex')
    : null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(signature ? { 'X-Silver-Signature': `sha256=${signature}` } : {}),
      },
      body,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`상담 접수 채널 응답 오류 (${response.status})`);
    return { preview: false };
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 지원해요.' });
  if (rateLimited(req)) return res.status(429).json({ error: '상담 신청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' });

  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) throw new TypeError('상담 신청 정보가 너무 큽니다.');
    const value = validateConsultation(typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}));
    const id = requestId();
    const submittedAt = new Date().toISOString();
    const result = await deliver({
      type: 'silver.consultation.requested',
      id,
      submittedAt,
      applicant: { name: value.name, phone: value.phone, preferredTime: value.preferredTime, note: value.note },
      result: { token: value.resultToken, expiresInDays: 7 },
    });
    return res.status(202).json({ id, submittedAt, preview: result.preview });
  } catch (error) {
    const status = error instanceof TypeError ? 400 : 503;
    console.error('[consultations] 상담 접수 실패', error);
    return res.status(status).json({ error: String(error.message || error) });
  }
}
