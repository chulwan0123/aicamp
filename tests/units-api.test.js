import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import handler, { groupUnitsByDong } from '../api/units.js';
import { clearPublicPriceCache } from '../api/_lib/publicPriceStore.js';

function response() {
  return {
    code: 200,
    body: null,
    headers: {},
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
  };
}

async function shardFetch(url) {
  const filename = new URL(String(url)).pathname.split('/').at(-1);
  const payload = fs.readFileSync(new URL(`../data/public-price/2025/${filename}`, import.meta.url));
  return { ok: true, status: 200, arrayBuffer: async () => payload };
}

test('선택한 평형에 맞는 동과 호수를 숫자 순서로 묶는다', () => {
  const dongs = groupUnitsByDong([
    { dongNm: '102동', hoNm: '1001호', areaM2: 84.943, pblntfPc: 2_000_000_000, stdrYear: 2025 },
    { dongNm: '101동', hoNm: '1002호', areaM2: 84.943, pblntfPc: 2_100_000_000, stdrYear: 2025 },
    { dongNm: '101동', hoNm: '101호', areaM2: 84.943, pblntfPc: 1_900_000_000, stdrYear: 2025 },
    { dongNm: '101동', hoNm: '201호', areaM2: 59.98, pblntfPc: 1_500_000_000, stdrYear: 2025 },
  ], 84.943);
  assert.deepEqual(dongs.map((item) => item.dong), ['101', '102']);
  assert.deepEqual(dongs[0].homes.map((item) => item.ho), ['101', '1002']);
});

test('동·호수 목록 API는 실제 반포자이 평형의 선택지를 반환한다', async () => {
  clearPublicPriceCache();
  const res = response();
  await handler({
    method: 'GET',
    query: { pnu: '1165010700000200043', areaM2: '84.943' },
    headers: { host: 'public-price.test' },
    fetchImpl: shardFetch,
  }, res);
  assert.equal(res.code, 200);
  assert.ok(res.body.dongs.length > 1);
  const unit = res.body.dongs
    .find((item) => item.dong === '101')
    ?.homes.find((item) => item.ho === '101');
  assert.equal(unit?.officialPrice, 2_462_000_000);
  assert.equal(res.body.source, 'data.go.kr-file-shard');
});

test('평형 없이 동·호수 목록을 요청하면 안내하고 거절한다', async () => {
  const res = response();
  await handler({ method: 'GET', query: { pnu: '1165010700000200043' }, headers: {} }, res);
  assert.equal(res.code, 400);
  assert.match(res.body.error, /전용면적/);
});
