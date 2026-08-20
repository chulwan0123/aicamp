import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildScenarios } from '../api/_lib/scenarios.js';
import { comprehensiveTax } from '../api/_lib/holdingTax.js';

const sample = JSON.parse(fs.readFileSync(new URL('../docs/샘플-payload.json', import.meta.url), 'utf8'));

function compute(overrides = {}) {
  const property = { ...sample.property, ...(overrides.property || {}) };
  const subject = { ...sample.subject, ...(overrides.subject || {}) };
  return buildScenarios({ property, subject });
}

test('반포자이 샘플은 재산세 중복 공제를 포함한 동일 계산값을 낸다', () => {
  const computed = compute();
  const holding = computed.taxes.holding[0];
  assert.equal(holding.propertyTax, 5_214_532);
  assert.equal(holding.jongbuTax, 1_065_370);
  assert.equal(holding.total, 6_279_902);
  assert.deepEqual(computed.taxes.holding.map((row) => row.total), [6_279_902, 9_437_050, 9_437_050]);
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

test('여러 주택은 첫 집만 보지 않고 공시가격과 재산세를 모두 합산한다', () => {
  const second = {
    ...sample.property,
    complexName: '두 번째 집',
    officialPrice: 800_000_000,
    marketPrice: 1_200_000_000,
    acquisitionPrice: 500_000_000,
  };
  const computed = buildScenarios({
    property: sample.property,
    properties: [sample.property, second],
    subject: {
      ...sample.subject,
      houseCount: 2,
      acquisitions: [
        { acquisitionPrice: sample.property.acquisitionPrice, holdingYears: 18 },
        { acquisitionPrice: second.acquisitionPrice, holdingYears: 8 },
      ],
    },
  });
  assert.equal(computed.taxes.holding[0].officialPrice, 3_262_000_000);
  assert.equal(computed.taxes.holding[0].propertyTaxByHome.length, 2);
  assert.equal(computed.meta.portfolio.length, 2);
  assert.match(computed.taxes.holding[0].steps.join('\n'), /주택 2채의 공시가격을 모두 더해요/);
});

test('2028년 80% 비율은 3주택 이상 또는 조정대상지역 다주택에만 적용한다', () => {
  const base = {
    officialPrice: 3_000_000_000,
    ownerCount: 1,
    olderAge: 50,
    holdingYears: 3,
    year: 2028,
    houseCount: 2,
  };
  assert.equal(comprehensiveTax(base).ratio, 0.7);
  assert.equal(comprehensiveTax({ ...base, hasAdjustedAreaHome: true }).ratio, 0.8);
  assert.equal(comprehensiveTax({ ...base, houseCount: 3 }).ratio, 0.8);
});

test('2027년 보유기간 공제는 현행의 절반이고 거주기간 공제와 큰 값을 고른다', () => {
  const common = {
    officialPrice: 3_000_000_000,
    ownerCount: 1,
    olderAge: 50,
    holdingYears: 10,
    isResiding: true,
    residencyYears: 0,
  };
  assert.equal(comprehensiveTax({ ...common, year: 2026 }).creditRate.holding, 0.4);
  assert.equal(comprehensiveTax({ ...common, year: 2027 }).creditRate.holding, 0.2);
  assert.equal(comprehensiveTax({ ...common, year: 2028 }).creditRate.holding, 0);
});
