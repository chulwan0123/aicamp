import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import handler from '../api/advise.js';

const sample = JSON.parse(fs.readFileSync(new URL('../docs/샘플-payload.json', import.meta.url), 'utf8'));

function response() {
  return { code: 200, body: null, headers: {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, setHeader(name, value) { this.headers[name] = value; } };
}

test('AI를 사용하지 못해도 정적 목업이 아니라 현재 계산값으로 응답한다', async () => {
  process.env.USE_MOCK = 'true';
  const res = response();
  await handler({ method: 'POST', headers: {}, socket: { remoteAddress: 'api-test-1' }, body: sample }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body._source, 'rules');
  assert.equal(res.body.details.taxes.holding[0].total, 6_279_902);
  assert.equal(res.body.details.taxes.sale2026.capitalGainsWithLocal, 176_139_720);
  assert.ok(res.body.recommended.id);
});

test('필수 숫자가 빠진 요청은 다른 주택 목업으로 대체하지 않고 거절한다', async () => {
  const invalid = structuredClone(sample);
  delete invalid.property.officialPrice;
  const res = response();
  await handler({ method: 'POST', headers: {}, socket: { remoteAddress: 'api-test-2' }, body: invalid }, res);
  assert.equal(res.code, 400);
  assert.match(res.body.error, /공시가격/);
});
