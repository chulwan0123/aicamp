import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import handler from '../api/complexes.js';
import { clearComplexSearchCache, normalizeComplexQuery, searchComplexes } from '../api/_lib/complexSearchStore.js';

function response() {
  return {
    code: 200, body: null, headers: {},
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
  };
}

async function dataFetch(url) {
  const filename = new URL(String(url)).pathname.split('/').at(-1);
  const payload = fs.readFileSync(new URL(`../data/property-search/2025/${filename}`, import.meta.url));
  return { ok: true, status: 200, arrayBuffer: async () => payload };
}

const request = (query = {}) => ({
  method: 'GET', query, headers: { host: 'property-search.test' }, fetchImpl: dataFetch,
});

test('단지 검색어는 공백과 기호 차이 없이 비교한다', () => {
  assert.equal(normalizeComplexQuery('반포 자이(아파트)'), '반포자이아파트');
});

test('서초구 색인에서 반포자이와 전용면적 목록을 찾는다', async () => {
  clearComplexSearchCache();
  const items = await searchComplexes('11650', '반포 자이', {
    req: request().headers ? { headers: request().headers } : null,
    fetchImpl: dataFetch,
  });
  const item = items.find((candidate) => candidate.complexName === '반포자이');
  assert.ok(item);
  assert.equal(item.pnu, '1165010700000200043');
  assert.ok(item.areas.some((area) => Math.abs(area.areaM2 - 84.943) < 0.001));
  assert.ok(item.areas.every((area) => area.unitCount > 0));
});

test('지역 목록과 단지 검색 API가 실제 색인을 반환한다', async () => {
  clearComplexSearchCache();
  const regions = response();
  await handler(request(), regions);
  assert.equal(regions.code, 200);
  assert.ok(regions.body.regions.some((region) => region.name === '서울특별시'));
  assert.ok(regions.body.regions.some((region) => region.name === '경기도'));

  const complexes = response();
  await handler(request({ districtCode: '11650', q: '반포자이' }), complexes);
  assert.equal(complexes.code, 200);
  assert.ok(complexes.body.items.some((item) => item.complexName === '반포자이'));
  assert.match(complexes.headers['Cache-Control'], /s-maxage/);
});

test('지역 또는 검색어가 없으면 단지 검색을 거절한다', async () => {
  const noDistrict = response();
  await handler(request({ q: '반포자이' }), noDistrict);
  assert.equal(noDistrict.code, 400);

  const noQuery = response();
  await handler(request({ districtCode: '11650' }), noQuery);
  assert.equal(noQuery.code, 400);
});
