import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeUrl,
  equalState,
  openSession,
  readCookie,
  safeNickname,
  sealSession,
  SESSION_MAX_AGE,
} from '../api/_lib/kakaoAuth.js';

const secret = 'a-secure-test-secret-that-is-longer-than-thirty-two-characters';

test('카카오 로그인은 브라우저를 다시 열어도 30일 동안 유지한다', () => {
  assert.equal(SESSION_MAX_AGE, 60 * 60 * 24 * 30);
});

test('카카오 세션은 암호화해 복원하고 만료 시 거부한다', () => {
  const now = Date.now();
  const token = sealSession({ userId: '42', nickname: '철완', expiresAt: now + 1000 }, secret);
  assert.deepEqual(openSession(token, secret, now), { userId: '42', nickname: '철완', expiresAt: now + 1000 });
  assert.equal(openSession(token, secret, now + 1001), null);
  assert.equal(openSession(`${token}changed`, secret, now), null);
});

test('카카오 인가 주소는 등록 리다이렉트와 state를 포함한다', () => {
  const url = new URL(authorizeUrl({
    restApiKey: 'rest-key',
    redirectUri: 'https://aicamp-sigma.vercel.app/api/auth/kakao/callback',
  }, 'state-value'));
  assert.equal(url.origin, 'https://kauth.kakao.com');
  assert.equal(url.searchParams.get('client_id'), 'rest-key');
  assert.equal(url.searchParams.get('state'), 'state-value');
  assert.equal(url.searchParams.get('scope'), 'profile_nickname');
});

test('쿠키와 사용자 표시값을 안전하게 정리한다', () => {
  assert.equal(readCookie({ headers: { cookie: 'a=1; plus_silver_session=sealed%20value' } }, 'plus_silver_session'), 'sealed value');
  assert.equal(safeNickname('  긴   이름  '), '긴 이름');
  assert.equal(safeNickname(''), '플러스실버 회원');
  assert.equal(equalState('same-state', 'same-state'), true);
  assert.equal(equalState('same-state', 'other-state'), false);
});
