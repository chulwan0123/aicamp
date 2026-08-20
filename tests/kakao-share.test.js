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
  assert.equal(template.content.title, '부모님 노후 준비 결과가 도착했어요');
  assert.equal(template.content.description, '부동산과 생활비를 바탕으로 정리한 추천과 다음 단계를 함께 확인해 보세요.');
  assert.equal(template.buttonTitle, '결과 함께 보기');
  assert.equal(template.content.imageUrl, 'https://silver.example/assets/og-silver-share.png');
  assert.equal(template.content.imageWidth, 1200);
  assert.equal(template.content.imageHeight, 630);
  assert.match(template.content.link.webUrl, /^https:\/\/silver\.example\/\?r=v2\.iv\.tag\.ciphertext#result$/);
  assert.equal(template.content.link.mobileWebUrl, template.content.link.webUrl);

  await shareResult({ advice: {} }, { purpose: 'invite' });
  assert.equal(template.content.title, '부모님, 함께 확인해 주세요');
  assert.equal(template.content.description, '우리 가족의 노후 준비 결과와 추천 내용을 안전한 링크에서 확인해 보세요.');
  assert.equal(template.buttonTitle, '초대 결과 보기');
});
