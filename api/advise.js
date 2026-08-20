/**
 * AI 세무 진단.
 *
 * 구조: 규칙 엔진이 계산하고, AI 가 판단한다.
 *   1) scenarios.js 가 모든 금액을 결정적으로 계산 (산식·법령 근거 포함)
 *   2) LLM 은 성향 점수·추천안 선정·설명 문장만 생성 (금액 생성 금지)
 *   3) verify 가 판단의 정합성을 확인, 실패 시 1회 재시도
 *   4) assemble 이 계산값 + 문장을 합쳐 최종 리포트를 만든다
 *
 * API 키는 이 함수 안에서만 쓰이며 클라이언트 번들에 포함되지 않는다.
 * 어떤 실패든 리포트가 나가도록 폴백을 둔다.
 */
import { buildScenarios } from './_lib/scenarios.js';
import { SYSTEM_PROMPT, buildRepairPrompt } from './_lib/prompt.js';
import { verify } from './_lib/verify.js';
import { assemble } from './_lib/assemble.js';
import { createFallbackDraft } from './_lib/fallback.js';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-5.6-terra';
const MAX_TOKENS = 4000;
const REASONING_MAX_TOKENS = 12000;
const TIMEOUT_MS = 50_000;
const MAX_BODY_BYTES = 64 * 1024;
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const requestWindows = new Map();

const isMockMode = () => String(process.env.USE_MOCK).toLowerCase() === 'true';

function clientIp(req) {
  return String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function rateLimited(req) {
  const key = clientIp(req);
  const now = Date.now();
  const recent = (requestWindows.get(key) || []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  requestWindows.set(key, recent);
  return recent.length > MAX_REQUESTS_PER_WINDOW;
}

function finitePositive(value, label, { allowZero = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
    throw new TypeError(`${label} 값이 올바르지 않습니다.`);
  }
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('요청 본문이 올바르지 않습니다.');
  const { property, subject, answers = {} } = payload;
  if (!property || !subject) throw new TypeError('부동산과 부모님 정보가 필요합니다.');
  finitePositive(property.officialPrice, '공시가격');
  finitePositive(property.marketPrice, '실거래가');
  finitePositive(property.areaM2, '전용면적');
  finitePositive(subject.age, '아버지 연령');
  finitePositive(subject.spouseAge, '어머니 연령');
  finitePositive(subject.holdingYears, '보유기간', { allowZero: true });
  if (subject.residencyYears !== undefined && subject.residencyYears !== null) finitePositive(subject.residencyYears, '거주기간', { allowZero: true });
  finitePositive(subject.monthlyIncome, '월 소득', { allowZero: true });
  finitePositive(subject.targetExpense, '필요 생활비');
  finitePositive(subject.acquisitionPrice || property.acquisitionPrice, '취득가액');
  if (!Number.isInteger(subject.houseCount) || subject.houseCount < 1 || subject.houseCount > 3) throw new TypeError('주택 수는 1~3채여야 합니다.');
  if (!['SINGLE', 'JOINT_50_50'].includes(subject.ownership)) throw new TypeError('명의 정보가 올바르지 않습니다.');
  if (typeof property.isCapitalArea !== 'boolean') throw new TypeError('현재 주택의 수도권 여부가 필요합니다.');
  if (typeof subject.wishRegionIsCapitalArea !== 'boolean') throw new TypeError('희망 지역의 수도권 여부가 필요합니다.');
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) throw new TypeError('성향 응답이 올바르지 않습니다.');
  return { property, subject, answers, refinements: payload.refinements || {} };
}

function fallbackAdvice({ computed, answers, property, subject, reason }) {
  const draft = createFallbackDraft({ computed, answers });
  return {
    ...assemble({ computed, draft, property, subject }),
    _source: 'rules',
    ...(reason ? { _fallbackReason: reason } : {}),
  };
}

/** o 시리즈·gpt-5 계열은 max_tokens 대신 max_completion_tokens 를 쓰고 temperature 를 받지 않는다. */
const isReasoningModel = (model) => /^(o\d|gpt-5)/.test(model);

/** 모델이 거부한 파라미터. 함수 인스턴스가 사는 동안 기억해 같은 실수를 반복하지 않는다. */
const dropped = new Set();

function stripFence(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

function buildBody(model, messages) {
  const base = { model, messages, response_format: { type: 'json_object' } };
  return isReasoningModel(model)
    ? { ...base, max_completion_tokens: REASONING_MAX_TOKENS }
    : { ...base, temperature: 0, max_tokens: MAX_TOKENS };
}

async function callOpenAI(messages, attempt = 0) {
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const body = buildBody(model, messages);
  for (const param of dropped) delete body[param];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = await response.text();
    const rejected = detail.match(/"param":\s*"([\w.]+)"/)?.[1]
      || ['temperature', 'max_tokens', 'max_completion_tokens', 'response_format'].find((n) => detail.includes(n));
    if (response.status === 400 && rejected && rejected in body && attempt < 3) {
      console.warn(`[advise] ${model} 이 '${rejected}' 를 거부 — 제외하고 재시도합니다.`);
      dropped.add(rejected);
      return callOpenAI(messages, attempt + 1);
    }
    throw new Error(`OpenAI ${response.status}: ${detail.slice(0, 400)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`OpenAI 응답에 content 가 없습니다 (finish_reason: ${data?.choices?.[0]?.finish_reason})`);
  return { draft: JSON.parse(stripFence(content)), usage: data.usage };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST 만 지원합니다' });
    return;
  }

  if (rateLimited(req)) {
    res.status(429).json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
    return;
  }

  let parsed;
  try {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) throw new TypeError('요청 데이터가 너무 큽니다.');
    parsed = validatePayload(typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}));
  } catch (error) {
    res.status(400).json({ error: String(error.message || error) });
    return;
  }
  const { property, answers } = parsed;
  const subject = { ...parsed.subject, refinements: parsed.refinements || parsed.subject.refinements || {} };

  /* 1) 규칙 엔진 — LLM 을 쓰든 안 쓰든 항상 계산한다 */
  let computed;
  try {
    computed = buildScenarios({ property, subject });
  } catch (error) {
    console.error('[advise] 시나리오 계산 실패', error);
    res.status(422).json({ error: String(error.message || error) });
    return;
  }

  if (isMockMode() || !process.env.OPENAI_API_KEY) {
    if (!isMockMode()) console.warn('[advise] OPENAI_API_KEY 가 없어 규칙 기반 추천을 사용합니다.');
    res.status(200).json(fallbackAdvice({ computed, answers, property, subject, reason: isMockMode() ? 'mock-mode' : 'missing-api-key' }));
    return;
  }

  /* 2) LLM — 판단과 문장만 */
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify({ property, subject, answers, computed }) },
  ];

  try {
    let { draft, usage } = await callOpenAI(messages);
    let errors = verify(draft, computed);

    if (errors.length) {
      console.warn('[advise] 1차 검증 실패:', errors);
      const retry = await callOpenAI([
        ...messages,
        { role: 'assistant', content: JSON.stringify(draft) },
        { role: 'user', content: buildRepairPrompt(errors) },
      ]);
      const retryErrors = verify(retry.draft, computed);
      if (!retryErrors.length) { draft = retry.draft; usage = retry.usage; errors = []; }
      else { console.warn('[advise] 재시도도 실패:', retryErrors); errors = retryErrors; }
    }

    if (errors.length) {
      res.status(200).json({ ...fallbackAdvice({ computed, answers, property, subject, reason: 'verification-failed' }), _verifyErrors: errors });
      return;
    }

    /* 3) 조립 — 금액은 computed, 문장은 draft */
    res.status(200).json({ ...assemble({ computed, draft, property, subject }), _source: 'llm', _usage: usage });
  } catch (error) {
    console.error('[advise] 호출 실패 — 규칙 기반 추천을 반환합니다.', error);
    res.status(200).json({ ...fallbackAdvice({ computed, answers, property, subject, reason: 'llm-failed' }), _error: String(error.message || error) });
  }
}
