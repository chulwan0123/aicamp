import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildScenarios } from '../api/_lib/scenarios.js';
import { createFallbackDraft } from '../api/_lib/fallback.js';
import { verify } from '../api/_lib/verify.js';

const sample = JSON.parse(fs.readFileSync(new URL('../docs/샘플-payload.json', import.meta.url), 'utf8'));

test('AI 설명에 규칙 엔진 display에 없는 한글 금액이 있으면 거절한다', () => {
  const computed = buildScenarios({ property: sample.property, properties: [sample.property], subject: sample.subject });
  const draft = createFallbackDraft({ computed, answers: sample.answers });
  draft.why += ' 추가로 999억원이 남아요.';
  assert.ok(verify(draft, computed).some((error) => error.includes('computed.display 에 없는 금액')));
});
