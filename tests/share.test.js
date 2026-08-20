import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/share.js';

process.env.SHARE_SECRET = 'test-only-share-secret-that-is-long-enough-1234';

function response() {
  return { code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, setHeader() {} };
}

test('공유 결과는 평문 Base64가 아닌 인증 암호화 토큰으로 왕복한다', async () => {
  const session = { property: { marketPrice: 4_700_000_000 }, advice: { recommended: { id: 'DOWNSIZE' } } };
  const create = response();
  await handler({ method: 'POST', body: { session } }, create);
  assert.equal(create.code, 200);
  assert.equal(create.body.token.split('.').length, 3);
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
