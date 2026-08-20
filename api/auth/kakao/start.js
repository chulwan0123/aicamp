import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE,
  authErrorRedirect,
  authorizeUrl,
  cookie,
  createOauthState,
  hasKakaoConfig,
  isSecureRequest,
  kakaoConfig,
  redirect,
} from '../../_lib/kakaoAuth.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET 요청만 지원해요.' });

  const config = kakaoConfig();
  if (!hasKakaoConfig(config)) return authErrorRedirect(res, 'config');

  const state = createOauthState();
  res.setHeader('Set-Cookie', cookie(OAUTH_STATE_COOKIE, state, {
    maxAge: OAUTH_STATE_MAX_AGE,
    path: '/api/auth/kakao',
    secure: isSecureRequest(req),
  }));
  return redirect(res, authorizeUrl(config, state));
}
