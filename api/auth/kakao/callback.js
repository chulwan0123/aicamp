import {
  AUTH_COOKIE,
  OAUTH_STATE_COOKIE,
  SESSION_MAX_AGE,
  authErrorRedirect,
  clearCookie,
  cookie,
  equalState,
  hasKakaoConfig,
  isSecureRequest,
  kakaoConfig,
  readCookie,
  redirect,
  safeNickname,
  sealSession,
} from '../../_lib/kakaoAuth.js';

async function exchangeCode(config, code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.restApiKey,
    redirect_uri: config.redirectUri,
    code,
    client_secret: config.clientSecret,
  });
  const response = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
  });
  if (!response.ok) throw new Error(`token:${response.status}`);
  const tokens = await response.json();
  if (!tokens?.access_token) throw new Error('token:missing');
  return tokens;
}

async function retrieveUser(accessToken) {
  const response = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`user:${response.status}`);
  const user = await response.json();
  if (!user?.id) throw new Error('user:missing');
  return user;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET 요청만 지원해요.' });

  const config = kakaoConfig();
  const secure = isSecureRequest(req);
  const clearState = clearCookie(OAUTH_STATE_COOKIE, { path: '/api/auth/kakao', secure });
  if (!hasKakaoConfig(config)) {
    res.setHeader('Set-Cookie', clearState);
    return authErrorRedirect(res, 'config');
  }

  const expectedState = readCookie(req, OAUTH_STATE_COOKIE);
  const receivedState = String(req.query?.state || '');
  if (req.query?.error) {
    res.setHeader('Set-Cookie', clearState);
    return authErrorRedirect(res, 'cancelled');
  }
  if (!req.query?.code || !equalState(expectedState, receivedState)) {
    res.setHeader('Set-Cookie', clearState);
    return authErrorRedirect(res, 'state');
  }

  try {
    const tokens = await exchangeCode(config, String(req.query.code));
    const user = await retrieveUser(tokens.access_token);
    const now = Date.now();
    const session = sealSession({
      userId: String(user.id),
      nickname: safeNickname(user.kakao_account?.profile?.nickname),
      accessToken: tokens.access_token,
      accessExpiresAt: now + (Number(tokens.expires_in) || 0) * 1000,
      issuedAt: now,
      expiresAt: now + SESSION_MAX_AGE * 1000,
    }, config.sessionSecret);
    res.setHeader('Set-Cookie', [
      clearState,
      cookie(AUTH_COOKIE, session, { maxAge: SESSION_MAX_AGE, secure }),
    ]);
    return redirect(res, '/#home');
  } catch (error) {
    console.error('[plus-silver-auth] 카카오 로그인 실패', error instanceof Error ? error.message : 'unknown');
    res.setHeader('Set-Cookie', clearState);
    return authErrorRedirect(res, 'failed');
  }
}
