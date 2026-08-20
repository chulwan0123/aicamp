import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { clientConfig } from '../api/client-config.js';

function response() {
  return { code: 200, body: null, headers: {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, setHeader(name, value) { this.headers[name] = value; } };
}

test('카카오 키가 없으면 클라이언트 설정은 미연결 상태만 반환한다', () => {
  const config = clientConfig({});
  assert.equal(config.kakao.configured, false);
  assert.equal('javascriptKey' in config.kakao, false);
  assert.match(config.kakao.sdkUrl, /^https:\/\/t1\.kakaocdn\.net\/kakao_js_sdk\/2\.8\.2\//);
  assert.match(config.kakao.integrity, /^sha384-/);
});

test('카카오 JavaScript 키는 설정된 경우에만 SDK 초기화용으로 반환한다', () => {
  const config = clientConfig({ KAKAO_JAVASCRIPT_KEY: 'public-js-key' });
  assert.equal(config.kakao.configured, true);
  assert.equal(config.kakao.javascriptKey, 'public-js-key');
});

test('클라이언트 설정 API는 GET만 허용하고 캐시하지 않는다', () => {
  const get = response();
  handler({ method: 'GET' }, get);
  assert.equal(get.code, 200);
  assert.equal(get.headers['Cache-Control'], 'no-store');

  const post = response();
  handler({ method: 'POST' }, post);
  assert.equal(post.code, 405);
});

test('헬스 체크는 같은 함수에서 기존 응답 계약을 유지한다', () => {
  const health = response();
  handler({ method: 'GET', query: { mode: 'health' } }, health);
  assert.deepEqual(health.body, { ok: true, service: 'silver', engine: 'plushome-v2' });
  assert.equal(health.headers['Cache-Control'], 'no-store');
});
