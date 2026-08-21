import test from 'node:test';
import assert from 'node:assert/strict';
import { shareResult } from '../js/kakao-share.js';

test('설정된 카카오 SDK로 암호화 결과 링크를 보낸다', async (t) => {
  let initializedWith;
  let template;
  let shareRequests = 0;
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
    if (url === './api/share') {
      shareRequests += 1;
      return { ok: true, json: async () => ({ token: 'v2.iv.tag.ciphertext' }) };
    }
    if (url === './api/client-config') return {
      ok: true,
      json: async () => ({ kakao: {
        configured: true,
        javascriptKey: 'public-js-key',
        appUrl: 'https://hanwha-ai-camp-silver.vercel.app',
      } }),
    };
    throw new Error(`unexpected request: ${url}`);
  };

  const session = { advice: { familyNote: '가족과 결과를 확인해 보세요.' } };
  const result = await shareResult(session);
  assert.equal(result.method, 'kakao');
  assert.equal(initializedWith, 'public-js-key');
  assert.equal(template.objectType, 'feed');
  assert.equal(template.content.title, '부모님 노후 준비 결과가 도착했어요');
  assert.equal(template.content.description, '부동산과 생활비를 바탕으로 정리한 추천과 다음 단계를 함께 확인해 보세요.');
  assert.equal(template.buttonTitle, '결과 함께 보기');
  assert.equal(template.content.imageUrl, 'https://hanwha-ai-camp-silver.vercel.app/assets/og-silver-share.png');
  assert.equal(template.content.imageWidth, 1200);
  assert.equal(template.content.imageHeight, 630);
  assert.match(template.content.link.webUrl, /^https:\/\/hanwha-ai-camp-silver\.vercel\.app\/\?r=v2\.iv\.tag\.ciphertext#result$/);
  assert.equal(template.content.link.mobileWebUrl, template.content.link.webUrl);

  await shareResult(session, { purpose: 'invite', hash: '#inheritance' });
  assert.equal(template.content.title, '부모님, 함께 확인해 주세요');
  assert.equal(template.content.description, '우리 가족의 노후 준비 결과와 추천 내용을 안전한 링크에서 확인해 보세요.');
  assert.equal(template.buttonTitle, '초대 결과 보기');
  assert.match(template.content.link.webUrl, /#inheritance$/);
  assert.equal(shareRequests, 1);
});

test('카카오와 네이티브 공유가 실패하면 링크 복사로 이어진다', async (t) => {
  const { shareResult: isolatedShareResult } = await import('../js/kakao-share.js?fallback-test');
  let copied = '';
  const original = {
    window: globalThis.window,
    document: globalThis.document,
    location: globalThis.location,
    fetch: globalThis.fetch,
  };
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  t.after(() => {
    Object.assign(globalThis, original);
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    else delete globalThis.navigator;
  });
  globalThis.window = {
    Kakao: {
      isInitialized: () => true,
      Share: { sendDefault() { throw new Error('webview blocked'); } },
    },
  };
  globalThis.document = { baseURI: 'https://silver.example/', querySelector: () => null, head: { append() {} } };
  globalThis.location = { origin: 'https://silver.example', pathname: '/' };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      share: async () => { throw new Error('native blocked'); },
      clipboard: { writeText: async (value) => { copied = value; } },
    },
  });
  globalThis.fetch = async (url) => {
    if (url === './api/share') return { ok: true, json: async () => ({ token: 'fallback-token' }) };
    if (url === './api/client-config') return { ok: true, json: async () => ({ kakao: { configured: true, javascriptKey: 'key' } }) };
    throw new Error(`unexpected request: ${url}`);
  };

  const result = await isolatedShareResult({ advice: {} }, { hash: '#tax' });
  assert.equal(result.method, 'clipboard');
  assert.match(copied, /\?r=fallback-token#tax$/);
});
