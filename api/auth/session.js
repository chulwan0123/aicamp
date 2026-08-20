import {
  AUTH_COOKIE,
  clearCookie,
  isSecureRequest,
  kakaoConfig,
  openSession,
  readCookie,
} from '../_lib/kakaoAuth.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET 요청만 지원해요.' });

  const config = kakaoConfig();
  const session = openSession(readCookie(req, AUTH_COOKIE), config.sessionSecret);
  if (!session) {
    res.setHeader('Set-Cookie', clearCookie(AUTH_COOKIE, { secure: isSecureRequest(req) }));
    return res.status(200).json({ authenticated: false });
  }
  return res.status(200).json({
    authenticated: true,
    user: {
      nickname: session.nickname,
      provider: 'kakao',
    },
  });
}
