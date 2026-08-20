import {
  AUTH_COOKIE,
  clearCookie,
  isSecureRequest,
  kakaoConfig,
  openSession,
  readCookie,
} from '../_lib/kakaoAuth.js';

async function revokeKakaoToken(accessToken) {
  if (!accessToken) return;
  const response = await fetch('https://kapi.kakao.com/v1/user/logout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
  });
  if (!response.ok && response.status !== 401) throw new Error(`logout:${response.status}`);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 지원해요.' });

  const config = kakaoConfig();
  const session = openSession(readCookie(req, AUTH_COOKIE), config.sessionSecret);
  try {
    if (session?.accessToken && session.accessExpiresAt > Date.now()) {
      await revokeKakaoToken(session.accessToken);
    }
  } catch (error) {
    console.warn('[plus-silver-auth] 카카오 토큰 로그아웃 실패', error instanceof Error ? error.message : 'unknown');
  }

  res.setHeader('Set-Cookie', clearCookie(AUTH_COOKIE, { secure: isSecureRequest(req) }));
  return res.status(200).json({ ok: true });
}
