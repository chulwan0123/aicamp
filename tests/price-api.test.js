import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import handler, { chooseBestItem, isSupportedPnu, normalizeItem } from '../api/price.js';
import { clearPublicPriceCache, findPublicPriceUnits } from '../api/_lib/publicPriceStore.js';

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

const request = (query) => ({
  method: 'GET', query, headers: { host: 'public-price.test' }, fetchImpl: shardFetch,
});

test('공시가격 원본 필드를 서비스 형식으로 정규화한다', () => {
  assert.deepEqual(normalizeItem({
    aphusNm: '테스트아파트', pblntfPc: '930000000', stdrYear: 2025,
    dongNm: '101동', hoNm: '0101호', areaM2: '84.943',
  }), {
    aphusNm: '테스트아파트', pblntfPc: 930_000_000, stdrYear: '2025',
    dongNm: '101', hoNm: '101', areaM2: 84.943,
    roadAddress: null, complexCode: null, dongCode: null, hoCode: null, buildingLedgerPk: null,
  });
});

test('서울·경기 PNU만 허용하고 동·호·면적이 같은 호를 고른다', () => {
  assert.equal(isSupportedPnu('1165010700000200043'), true);
  assert.equal(isSupportedPnu('4113510100000340000'), true);
  assert.equal(isSupportedPnu('2611010100000010000'), false);
  const selected = chooseBestItem([
    { aphusNm: '반포자이', pblntfPc: 4_096_000_000, stdrYear: 2025, dongNm: '120', hoNm: '1002', areaM2: 165.052 },
    { aphusNm: '반포자이', pblntfPc: 2_462_000_000, stdrYear: 2025, dongNm: '101', hoNm: '101', areaM2: 84.943 },
  ], { dong: '101동', ho: '101호', areaM2: 84.94 });
  assert.equal(selected.pblntfPc, 2_462_000_000);
});

test('전체 샤드에서 서울과 경기의 실제 동·호 공시가격을 읽는다', async () => {
  clearPublicPriceCache();
  const options = { req: { headers: { host: 'public-price.test' } }, fetchImpl: shardFetch };
  const seoul = await findPublicPriceUnits('1165010700000200043', options);
  const gyeonggi = await findPublicPriceUnits('4113510100000340000', options);
  assert.ok(seoul.length > 1);
  assert.equal(seoul.find((item) => item.dongNm === '101' && item.hoNm === '101')?.pblntfPc, 2_462_000_000);
  assert.equal(gyeonggi.find((item) => item.dongNm === '101' && item.hoNm === '101')?.pblntfPc, 684_000_000);
});

test('공시가격 API가 서울 실제 세대의 2025년 원본값과 출처를 반환한다', async () => {
  const res = response();
  await handler(request({
    pnu: '1165010700000200043', dong: '101동', ho: '101호', areaM2: '84.943',
  }), res);
  assert.equal(res.code, 200);
  assert.equal(res.body.aphusNm, '반포자이');
  assert.equal(res.body.pblntfPc, 2_462_000_000);
  assert.equal(res.body.stdrYear, '2025');
  assert.equal(res.body.source, 'data.go.kr-file-shard');
  assert.match(res.body.sourceUrl, /data\.go\.kr/);
});

test('공시가격 API가 경기 실제 세대도 같은 방식으로 반환한다', async () => {
  const res = response();
  await handler(request({
    pnu: '4113510100000340000', dong: '101', ho: '101', areaM2: '84.99',
  }), res);
  assert.equal(res.code, 200);
  assert.equal(res.body.aphusNm, '샛별마을(라이프)');
  assert.equal(res.body.pblntfPc, 684_000_000);
});

test('PNU·동·호가 잘못되면 다른 세대나 반포자이 값으로 대체하지 않는다', async () => {
  const badPnu = response();
  await handler(request({ pnu: '1234' }), badPnu);
  assert.equal(badPnu.code, 400);

  const badUnit = response();
  await handler(request({
    pnu: '4113510100000340000', dong: '999', ho: '999', areaM2: '84.99',
  }), badUnit);
  assert.equal(badUnit.code, 404);
  assert.match(badUnit.body.error, /동·호수/);
});
