import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildScenarios } from '../api/_lib/scenarios.js';

const sample = JSON.parse(fs.readFileSync(new URL('../docs/샘플-payload.json', import.meta.url), 'utf8'));

function compute(overrides = {}) {
  const property = { ...sample.property, ...(overrides.property || {}) };
  const subject = { ...sample.subject, ...(overrides.subject || {}) };
  return buildScenarios({ property, subject });
}

test('반포자이 샘플은 재산세 중복 공제를 포함한 동일 계산값을 낸다', () => {
  const computed = compute();
  const holding = computed.taxes.holding[0];
  assert.equal(holding.propertyTax, 7_709_933);
  assert.equal(holding.jongbuTax, 2_406_125);
  assert.equal(holding.total, 10_116_058);
  assert.match(holding.steps.join('\n'), /재산세와 겹치는 금액을 먼저 빼요/);
  assert.equal(computed.taxes.sale2026.capitalGainsWithLocal, 176_139_720);
  assert.equal(computed.giftReview.cashNeeded, 1_987_650_000);
});

test('2027 고령 1주택 특례는 네 조건을 모두 충족할 때만 적용한다', () => {
  assert.equal(compute().taxes.sale2027Special.applicable, true);
  assert.equal(compute({ subject: { houseCount: 2 } }).taxes.sale2027Special.applicable, false);
  assert.equal(compute({ property: { isCapitalArea: false } }).taxes.sale2027Special.applicable, false);
  assert.equal(compute({ subject: { wishRegionIsCapitalArea: true } }).taxes.sale2027Special.applicable, false);
  assert.equal(compute({ subject: { age: 60, spouseAge: 60 } }).taxes.sale2027Special.applicable, false);
});

test('주택연금과 부분 임대 적격성은 규칙 엔진 값으로 판정한다', () => {
  const computed = compute();
  assert.equal(computed.options.PENSION.eligible, false);
  assert.equal(computed.options.PARTIAL.eligible, false);
  assert.equal(computed.options.SELL.eligible, true);
  assert.equal(computed.options.DOWNSIZE.eligible, true);
});
