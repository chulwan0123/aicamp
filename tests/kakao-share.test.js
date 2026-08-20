import test from 'node:test';
import assert from 'node:assert/strict';
import { shareResult } from '../js/kakao-share.js';

test('설정된 카카오 SDK로 암호화 결과 링크를 보낸다', async (t) => {
  let initializedWith;
  let template;
  const Kakao = {
    initialized: false,
    isInitialized() { return this.initialized; },
    init(key) { initializedWith = key; this.initialized = true; },
    Share: { sendDefault(value) { template = value; } },
  };
  const original = {
    window: globalThis.window,
    document: globalThis.document,
    location: globalThis.location,
    fetch: globalThis.fetch,
  };
  t.after(() => Object.assign(globalThis, original));
  globalThis.window = { Kakao };
  globalThis.document = { baseURI: 'https://silver.example/', querySelector: () => null, head: { append() {} } };
  globalThis.location = { origin: 'https://silver.example', pathname: '/' };
  globalThis.fetch = async (url) => {
    if (url === './api/share') return { ok: true, json: async () => ({ token: 'v2.iv.tag.ciphertext' }) };
    if (url === './api/client-config') return { ok: true, json: async () => ({ kakao: { configured: true, javascriptKey: 'public-js-key' } }) };
    throw new Error(`unexpected request: ${url}`);
  };

  const result = await shareResult({ advice: { familyNote: '가족과 결과를 확인해 보세요.' } });
  assert.equal(result.method, 'kakao');
  assert.equal(initializedWith, 'public-js-key');
  assert.equal(template.objectType, 'feed');
  assert.equal(template.buttonTitle, '분석 결과 확인하기');
  assert.match(template.content.link.webUrl, /^https:\/\/silver\.example\/\?r=v2\.iv\.tag\.ciphertext#result$/);
  assert.equal('mobileWebUrl' in template.content.link, false);
});
