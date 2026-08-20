import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import handler from '../api/share.js';
import { buildScenarios } from '../api/_lib/scenarios.js';
import { createFallbackDraft } from '../api/_lib/fallback.js';
import { assemble } from '../api/_lib/assemble.js';

process.env.SHARE_SECRET = 'test-only-share-secret-that-is-long-enough-1234';

function response() {
  return { code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, setHeader() {} };
}

test('공유 결과는 평문 Base64가 아닌 인증 암호화 토큰으로 왕복한다', async () => {
  const session = { property: { marketPrice: 4_700_000_000 }, advice: { recommended: { id: 'DOWNSIZE' } } };
  const create = response();
  await handler({ method: 'POST', body: { session } }, create);
  assert.equal(create.code, 200);
  assert.equal(create.body.token.split('.').length, 4);
  assert.match(create.body.token, /^v2\./);
  assert.equal(create.body.token.includes('4700000000'), false);

  const read = response();
  await handler({ method: 'GET', query: { token: create.body.token } }, read);
  assert.equal(read.code, 200);
  assert.deepEqual(read.body.session, session);
});

test('변조된 공유 토큰은 거절한다', async () => {
  const read = response();
  await handler({ method: 'GET', query: { token: 'wrong.token.value' } }, read);
  assert.equal(read.code, 400);
});

test('반복 구조가 많은 결과는 암호화 전에 압축해 공유 링크 길이를 줄인다', async () => {
  const repeated = Array.from({ length: 60 }, (_, index) => ({ index, explanation: '현재 계산값과 산식을 가족에게 자세히 설명합니다.'.repeat(6) }));
  const session = { property: { marketPrice: 4_700_000_000 }, advice: { evidence: repeated } };
  const plainBytes = Buffer.byteLength(JSON.stringify(session));
  const create = response();
  await handler({ method: 'POST', body: { session } }, create);
  assert.equal(create.code, 200);
  assert.ok(create.body.token.length < plainBytes / 2);

  const read = response();
  await handler({ method: 'GET', query: { token: create.body.token } }, read);
  assert.deepEqual(read.body.session, session);
});

test('전체 분석 결과는 짧은 스냅샷으로 공유하고 수신 시 같은 화면 데이터로 복원한다', async () => {
  const input = JSON.parse(fs.readFileSync(new URL('../docs/샘플-payload.json', import.meta.url), 'utf8'));
  const computed = buildScenarios({ property: input.property, properties: [input.property], subject: input.subject });
  const draft = createFallbackDraft({ computed, answers: input.answers });
  const advice = assemble({ computed, draft, property: input.property, subject: input.subject });
  const session = { ...input, properties: [input.property], refinements: {}, advice, chatHistory: [] };
  const create = response();
  await handler({ method: 'POST', body: { session } }, create);
  assert.equal(create.code, 200);
  assert.ok(create.body.token.length < 3000);

  const read = response();
  await handler({ method: 'GET', query: { token: create.body.token } }, read);
  assert.equal(read.code, 200);
  assert.deepEqual(read.body.session.advice, advice);
  assert.deepEqual(read.body.session.properties, session.properties);
});
