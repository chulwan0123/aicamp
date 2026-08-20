import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/market.js';
import {
  clearMarketCache, lotNumberFromPnu, parseMarketXml, queryApartmentMarket, recentYearMonths,
} from '../api/_lib/marketData.js';

const tradeXml = `<?xml version="1.0" encoding="UTF-8"?>
<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items>
<item><aptNm>반포자이</aptNm><dealAmount>470,000</dealAmount><dealYear>2026</dealYear><dealMonth>8</dealMonth><dealDay>12</dealDay><excluUseAr>84.943</excluUseAr><floor>12</floor><jibun>20-43</jibun><umdNm>반포동</umdNm><buildYear>2009</buildYear><cdealType></cdealType><cdealDay></cdealDay></item>
<item><aptNm>반포자이</aptNm><dealAmount>450,000</dealAmount><dealYear>2026</dealYear><dealMonth>7</dealMonth><dealDay>2</dealDay><excluUseAr>84.943</excluUseAr><floor>5</floor><jibun>20-43</jibun><umdNm>반포동</umdNm><buildYear>2009</buildYear><cdealType></cdealType><cdealDay></cdealDay></item>
<item><aptNm>반포자이</aptNm><dealAmount>999,000</dealAmount><dealYear>2026</dealYear><dealMonth>7</dealMonth><dealDay>1</dealDay><excluUseAr>84.943</excluUseAr><floor>1</floor><jibun>20-43</jibun><cdealType>O</cdealType><cdealDay>26.07.20</cdealDay></item>
<item><aptNm>다른아파트</aptNm><dealAmount>100,000</dealAmount><dealYear>2026</dealYear><dealMonth>8</dealMonth><dealDay>1</dealDay><excluUseAr>84.943</excluUseAr><jibun>20-43</jibun></item>
</items><totalCount>4</totalCount></body></response>`;

const rentXml = `<?xml version="1.0" encoding="UTF-8"?>
<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items>
<item><aptNm>반포자이</aptNm><deposit>220,000</deposit><monthlyRent>0</monthlyRent><dealYear>2026</dealYear><dealMonth>8</dealMonth><dealDay>4</dealDay><excluUseAr>84.943</excluUseAr><floor>10</floor><jibun>20-43</jibun></item>
<item><aptNm>반포자이</aptNm><deposit>100,000</deposit><monthlyRent>500</monthlyRent><dealYear>2026</dealYear><dealMonth>7</dealMonth><dealDay>9</dealDay><excluUseAr>84.943</excluUseAr><floor>3</floor><jibun>20-43</jibun></item>
</items><totalCount>2</totalCount></body></response>`;

const mockFetch = async (url) => ({
  ok: true,
  status: 200,
  text: async () => String(url).includes('AptRent') ? rentXml : tradeXml,
});

function response() {
  return {
    code: 200, body: null, headers: {},
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
  };
}

test('PNU에서 실거래 API 대조용 지번과 최근 조회월을 만든다', () => {
  assert.equal(lotNumberFromPnu('1165010700000200043'), '20-43');
  assert.deepEqual(recentYearMonths(3, new Date('2026-08-21T00:00:00Z')), ['202608', '202607', '202606']);
});

test('매매·전월세 XML의 금액 단위를 원 단위로 정규화한다', () => {
  const trades = parseMarketXml(tradeXml, 'trade').items;
  const rents = parseMarketXml(rentXml, 'rent').items;
  assert.equal(trades[0].price, 4_700_000_000);
  assert.equal(trades[2].canceled, true);
  assert.equal(rents[0].deposit, 2_200_000_000);
  assert.equal(rents[1].monthlyRent, 5_000_000);
});

test('단지명·지번·면적이 모두 같은 정상 거래만 집계한다', async () => {
  clearMarketCache();
  const trade = await queryApartmentMarket({
    pnu: '1165010700000200043', complexName: '반포 자이', areaM2: 84.94,
    months: 1, mode: 'trade', apiKey: 'test-key', fetchImpl: mockFetch,
  });
  assert.equal(trade.count, 2);
  assert.equal(trade.medianPrice, 4_600_000_000);
  assert.equal(trade.minPrice, 4_500_000_000);
  assert.equal(trade.maxPrice, 4_700_000_000);
});

test('전세와 월세를 분리해 중앙값을 계산한다', async () => {
  clearMarketCache();
  const rent = await queryApartmentMarket({
    pnu: '1165010700000200043', complexName: '반포자이', areaM2: 84.943,
    months: 1, mode: 'rent', apiKey: 'test-key', fetchImpl: mockFetch,
  });
  assert.equal(rent.count, 2);
  assert.equal(rent.jeonse.medianDeposit, 2_200_000_000);
  assert.equal(rent.monthly.medianDeposit, 1_000_000_000);
  assert.equal(rent.monthly.medianMonthlyRent, 5_000_000);
});

test('통합 API는 매매·전월세 결과와 공식 출처를 함께 반환한다', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.DATA_GO_KR_API_KEY;
  globalThis.fetch = mockFetch;
  process.env.DATA_GO_KR_API_KEY = 'test-key';
  clearMarketCache();
  try {
    const res = response();
    await handler({ method: 'GET', query: {
      pnu: '1165010700000200043', complexName: '반포자이', areaM2: '84.943', months: '1', mode: 'all',
    } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.trade.count, 2);
    assert.equal(res.body.rent.count, 2);
    assert.match(res.body.sources.trade.name, /국토교통부/);
    assert.match(res.headers['Cache-Control'], /s-maxage/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.DATA_GO_KR_API_KEY;
    else process.env.DATA_GO_KR_API_KEY = originalKey;
    clearMarketCache();
  }
});

test('서울·경기 밖 PNU와 키 없는 서버 요청은 명확히 거절한다', async () => {
  const outside = response();
  await handler({ method: 'GET', query: { pnu: '2611010100000010000', complexName: '테스트' } }, outside);
  assert.equal(outside.code, 400);

  const originalKey = process.env.DATA_GO_KR_API_KEY;
  const originalPublicKey = process.env.PUBLIC_DATA_API_KEY;
  delete process.env.DATA_GO_KR_API_KEY;
  delete process.env.PUBLIC_DATA_API_KEY;
  try {
    const noKey = response();
    await handler({ method: 'GET', query: { pnu: '1165010700000200043', complexName: '반포자이' } }, noKey);
    assert.equal(noKey.code, 503);
  } finally {
    if (originalKey !== undefined) process.env.DATA_GO_KR_API_KEY = originalKey;
    if (originalPublicKey !== undefined) process.env.PUBLIC_DATA_API_KEY = originalPublicKey;
  }
});
