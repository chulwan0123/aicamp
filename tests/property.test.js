import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dataset = JSON.parse(fs.readFileSync(new URL('../data/properties.json', import.meta.url), 'utf8'));
globalThis.fetch = async () => ({ ok: true, json: async () => dataset });
const { lookupProperty } = await import('../js/property.js');

test('등록 주소는 해당 주택을 찾는다', async () => {
  const property = await lookupProperty('서울특별시 서초구 신반포로 270', '101동 101호');
  assert.equal(property.complexName, '반포자이');
  assert.equal(property.marketPrice, 4_700_000_000);
  assert.equal(property.isAdjustedArea, true);
});

test('미등록 주소는 반포자이로 폴백하지 않는다', async () => {
  const property = await lookupProperty('제주특별자치도 제주시 존재하지 않는 길 999', '1동 1호');
  assert.equal(property, null);
});

test('같은 단지여도 동·호가 다르면 다른 세대의 면적과 가격을 쓰지 않는다', async () => {
  const property = await lookupProperty('서울특별시 서초구 신반포로 270', '120동 1002호');
  assert.equal(property, null);
});
