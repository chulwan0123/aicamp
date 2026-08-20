import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { validateConsultation } from '../api/consultations.js';

const valid = {
  name: '김민지', phone: '010-1234-5678', preferredTime: '평일 오후 2시 이후',
  note: '보유세와 주택연금 상담', resultToken: 'one.two.three', consent: true,
};

function response() {
  return { code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, setHeader() {} };
}

test('전문가 상담 입력은 연락처·결과 토큰·동의를 검증한다', () => {
  assert.equal(validateConsultation(valid).phone, '01012345678');
  assert.throws(() => validateConsultation({ ...valid, phone: '1234' }), /연락처/);
  assert.throws(() => validateConsultation({ ...valid, consent: false }), /동의/);
  assert.throws(() => validateConsultation({ ...valid, resultToken: '' }), /분석 결과/);
});

test('로컬 mock에서는 개인정보를 저장하지 않고 접수 식별자만 반환한다', async () => {
  process.env.USE_MOCK = 'true';
  delete process.env.CONSULTATION_WEBHOOK_URL;
  const res = response();
  await handler({ method: 'POST', headers: {}, socket: { remoteAddress: 'consult-test-1' }, body: valid }, res);
  assert.equal(res.code, 202);
  assert.match(res.body.id, /^SC-/);
  assert.equal(res.body.preview, true);
  assert.equal('phone' in res.body, false);
});

test('잘못된 상담 요청은 외부 채널 호출 전에 거절한다', async () => {
  const res = response();
  await handler({ method: 'POST', headers: {}, socket: { remoteAddress: 'consult-test-2' }, body: { ...valid, consent: false } }, res);
  assert.equal(res.code, 400);
});
