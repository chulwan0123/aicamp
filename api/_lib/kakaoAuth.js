import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export const AUTH_COOKIE = 'plus_silver_session';
export const OAUTH_STATE_COOKIE = 'plus_silver_kakao_state';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
export const OAUTH_STATE_MAX_AGE = 60 * 10;

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function sessionKey(secret) {
  const value = String(secret || '').trim();
  if (value.length < 32) throw new Error('AUTH_SESSION_SECRET 설정이 필요해요.');
  return createHash('sha256').update(value).digest();
}

export function sealSession(payload, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', sessionKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${base64url(iv)}.${base64url(tag)}.${base64url(encrypted)}`;
}

export function openSession(token, secret, now = Date.now()) {
  try {
    const [ivText, tagText, encryptedText] = String(token || '').split('.');
    if (!ivText || !tagText || !encryptedText) return null;
    const decipher = createDecipheriv(
      'aes-256-gcm',
      sessionKey(secret),
      Buffer.from(ivText, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedText, 'base64url')),
      decipher.final(),
    ]);
    const payload = JSON.parse(decrypted.toString('utf8'));
    if (!payload?.userId || !Number.isFinite(payload?.expiresAt) || payload.expiresAt <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readCookie(req, name) {
  const source = String(req?.headers?.cookie || '');
  for (const item of source.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    const key = item.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      return '';
    }
  }
  return '';
}

export function isSecureRequest(req) {
  const forwarded = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  return forwarded === 'https' || Boolean(process.env.VERCEL);
}

export function cookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path || '/'}`, 'HttpOnly', 'SameSite=Lax'];
  if (options.secure) parts.push('Secure');
  if (Number.isFinite(options.maxAge)) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  return parts.join('; ');
}

export function clearCookie(name, options = {}) {
  return cookie(name, '', { ...options, maxAge: 0 });
}

export function createOauthState() {
  return randomBytes(32).toString('base64url');
}

export function equalState(left, right) {
  const first = Buffer.from(String(left || ''));
  const second = Buffer.from(String(right || ''));
  return first.length > 0 && first.length === second.length && timingSafeEqual(first, second);
}

export function kakaoConfig(env = process.env) {
  return {
    restApiKey: String(env.KAKAO_REST_API_KEY || '').trim(),
    clientSecret: String(env.KAKAO_CLIENT_SECRET || '').trim(),
    redirectUri: String(env.KAKAO_REDIRECT_URI || '').trim(),
    sessionSecret: String(env.AUTH_SESSION_SECRET || '').trim(),
  };
}

export function hasKakaoConfig(config) {
  return Boolean(config.restApiKey && config.clientSecret && config.redirectUri && config.sessionSecret);
}

export function authorizeUrl(config, state) {
  const url = new URL('https://kauth.kakao.com/oauth/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.restApiKey);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'profile_nickname');
  return url.toString();
}

export function safeNickname(value) {
  const nickname = String(value || '').replace(/\s+/g, ' ').trim();
  return nickname ? nickname.slice(0, 20) : '플러스실버 회원';
}

export function redirect(res, destination) {
  res.setHeader('Location', destination);
  return res.status(302).send('');
}

export function authErrorRedirect(res, code) {
  return redirect(res, `/?auth=${encodeURIComponent(code)}#start`);
}
