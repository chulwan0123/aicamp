import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import adviseHandler from '../api/advise.js';
import chatHandler, { answerUsesLockedMoney } from '../api/chat.js';

const sample = JSON.parse(fs.readFileSync(new URL('../docs/샘플-payload.json', import.meta.url), 'utf8'));
const response = () => ({
  code: 200, body: null, headers: {},
  status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; },
  setHeader(name, value) { this.headers[name] = value; },
});

test('API 키가 없어도 현재 분석값으로 동적 채팅 답변을 만든다', async () => {
  const originalMock = process.env.USE_MOCK;
  process.env.USE_MOCK = 'true';
  try {
    const adviseRes = response();
    await adviseHandler({ method: 'POST', headers: {}, socket: { remoteAddress: 'chat-test' }, body: sample }, adviseRes);
    const chatRes = response();
    await chatHandler({
      method: 'POST',
      body: {
        message: '앞으로 보유세는 얼마나 나오나요?',
        session: { property: sample.property, properties: [sample.property], subject: sample.subject, advice: adviseRes.body },
      },
    }, chatRes);
    assert.equal(chatRes.code, 200);
    assert.equal(chatRes.body._source, 'rules');
    assert.match(chatRes.body.answer, /2026년 627만 9,902원/);
    assert.match(chatRes.body.answer, /입법 미확정|확정된다는 가정/);
    const session = { property: sample.property, properties: [sample.property], subject: sample.subject, advice: adviseRes.body };
    assert.equal(answerUsesLockedMoney(chatRes.body.answer, session), true);
    assert.equal(answerUsesLockedMoney('월 999만원을 받을 수 있어요.', session), false);
  } finally {
    if (originalMock === undefined) delete process.env.USE_MOCK;
    else process.env.USE_MOCK = originalMock;
  }
});

test('분석 결과 없는 채팅 요청은 거절한다', async () => {
  const res = response();
  await chatHandler({ method: 'POST', body: { message: '알려줘', session: {} } }, res);
  assert.equal(res.code, 400);
  assert.match(res.body.error, /분석 결과/);
});

test('AI가 계산 결과에 없는 금액을 말하면 규칙 답변으로 대체한다', async () => {
  const originalMock = process.env.USE_MOCK;
  const originalKey = process.env.OPENAI_API_KEY;
  const originalFetch = global.fetch;
  process.env.USE_MOCK = 'true';
  const adviseRes = response();
  await adviseHandler({ method: 'POST', headers: {}, socket: { remoteAddress: 'chat-lock-advice' }, body: sample }, adviseRes);
  const session = { property: sample.property, properties: [sample.property], subject: sample.subject, advice: adviseRes.body };

  try {
    process.env.USE_MOCK = 'false';
    process.env.OPENAI_API_KEY = 'test-key-never-sent';
    global.fetch = async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ choices: [{ message: { content: '월 999만원을 받을 수 있어요.' } }] }),
    });
    const res = response();
    await chatHandler({ method: 'POST', headers: {}, socket: { remoteAddress: 'chat-lock-test' }, body: { message: '얼마를 받나요?', session } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.body._source, 'rules');
    assert.equal(res.body._fallbackReason, 'unlocked-money');
    assert.doesNotMatch(res.body.answer, /999만원/);
  } finally {
    global.fetch = originalFetch;
    if (originalMock === undefined) delete process.env.USE_MOCK;
    else process.env.USE_MOCK = originalMock;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});
