import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { chooseBestItem, extractGovErrorMessage, extractItems, isSupportedPnu, normalizeItem } from '../api/price.js';

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

test('공공데이터 XML 오류 메시지를 추출한다', () => {
  const xml = '<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg><returnAuthMsg>KEY ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>';
  assert.equal(extractGovErrorMessage(xml), 'SERVICE ERROR KEY ERROR (code: 30)');
});

test('공공데이터의 응답 스키마와 필드 대소문자 변형을 정규화한다', () => {
  const item = extractItems({ response: { body: { items: { item: {
    aphusnm: '테스트아파트', pblntfpc: '930000000', stdryear: 2026,
    dongnm: '101동', honm: '0101호', prvusear: '84.943',
  } } } } });
  assert.deepEqual(item.map(normalizeItem), [
    { aphusNm: '테스트아파트', pblntfPc: 930_000_000, stdrYear: '2026', dongNm: '101', hoNm: '101', areaM2: 84.943 },
  ]);
});

test('서울·경기 PNU만 허용하고 동·호·면적이 같은 호를 고른다', () => {
  assert.equal(isSupportedPnu('1165010700000200043'), true);
  assert.equal(isSupportedPnu('4113510900004980000'), true);
  assert.equal(isSupportedPnu('2611010100000010000'), false);
  const selected = chooseBestItem([
    { aphusNm: '반포자이', pblntfPc: 4_096_000_000, stdrYear: 2025, dongNm: '120', hoNm: '1002', areaM2: 165.052 },
    { aphusNm: '반포자이', pblntfPc: 2_462_000_000, stdrYear: 2025, dongNm: '101', hoNm: '101', areaM2: 84.943 },
  ], { dong: '101동', ho: '101호', areaM2: 84.94 });
  assert.equal(selected.pblntfPc, 2_462_000_000);
});

test('공동주택가격 응답에서 최신 연도의 값을 반환한다', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.PUBLIC_DATA_API_KEY;
  let requestedUrl = '';
  process.env.PUBLIC_DATA_API_KEY = 'test-key';
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ field: [
        { aphusNm: '테스트아파트', pblntfPc: '1100000000', stdrYear: '2024', dongNm: '101', hoNm: '101', prvuseAr: 84.94 },
        { aphusNm: '테스트아파트', pblntfPc: '1200000000', stdrYear: '2025', dongNm: '101', hoNm: '101', prvuseAr: 84.94 },
      ] }),
    };
  };

  try {
    const res = response();
    await handler({ method: 'GET', query: { pnu: '1165010700000200043', dong: '101동', ho: '101호', areaM2: '84.94' } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.aphusNm, '테스트아파트');
    assert.equal(res.body.pblntfPc, 1_200_000_000);
    assert.equal(res.body.stdrYear, '2025');
    assert.equal(res.body.dongNm, '101');
    assert.equal(res.body.hoNm, '101');
    assert.equal(res.body.source, 'data.go.kr-api');
    const requested = new URL(requestedUrl);
    assert.equal(requested.origin + requested.pathname, 'https://apis.data.go.kr/1611000/nsdi/ApartHousingPriceService/attr/getApartHousingPriceAttr');
    assert.equal(requested.searchParams.get('serviceKey'), 'test-key');
    assert.equal(requested.searchParams.get('pnu'), '1165010700000200043');
    assert.equal(requested.searchParams.get('format'), 'json');
    assert.equal(requested.searchParams.get('numOfRows'), '1000');
    assert.equal(requested.searchParams.get('pageNo'), '1');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PUBLIC_DATA_API_KEY;
    else process.env.PUBLIC_DATA_API_KEY = originalKey;
  }
});

test('PNU 형식이 잘못되면 공공 API를 호출하지 않는다', async () => {
  const originalKey = process.env.PUBLIC_DATA_API_KEY;
  process.env.PUBLIC_DATA_API_KEY = 'test-key';
  try {
    const res = response();
    await handler({ method: 'GET', query: { pnu: '1234' } }, res);
    assert.equal(res.code, 400);
    assert.match(res.body.error, /19자리/);
  } finally {
    if (originalKey === undefined) delete process.env.PUBLIC_DATA_API_KEY;
    else process.env.PUBLIC_DATA_API_KEY = originalKey;
  }
});

test('HTTP 200 XML 오류도 정부 오류 메시지로 처리한다', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.PUBLIC_DATA_API_KEY;
  process.env.PUBLIC_DATA_API_KEY = 'test-key';
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => '<OpenAPI_ServiceResponse><cmmMsgHeader><returnAuthMsg>LIMITED NUMBER OF SERVICE REQUESTS EXCEEDS ERROR</returnAuthMsg><returnReasonCode>22</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>',
  });

  try {
    const res = response();
    await handler({ method: 'GET', query: { pnu: '1165010700000200043', dong: '101', ho: '101' } }, res);
    assert.equal(res.code, 500);
    assert.match(res.body.error, /LIMITED NUMBER/);
    assert.match(res.body.error, /code: 22/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PUBLIC_DATA_API_KEY;
    else process.env.PUBLIC_DATA_API_KEY = originalKey;
  }
});

test('데이터가 없는 정상 응답은 404로 반환한다', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.PUBLIC_DATA_API_KEY;
  process.env.PUBLIC_DATA_API_KEY = 'test-key';
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ response: { body: { items: {} } } }),
  });

  try {
    const res = response();
    await handler({ method: 'GET', query: { pnu: '1165010700000200043', dong: '101', ho: '101' } }, res);
    assert.equal(res.code, 404);
    assert.match(res.body.error, /찾을 수 없/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PUBLIC_DATA_API_KEY;
    else process.env.PUBLIC_DATA_API_KEY = originalKey;
  }
});

test('API 키가 없는 로컬에서도 공공 원본 발췌값으로 반포자이 기본 호를 검증한다', async () => {
  const originalKey = process.env.PUBLIC_DATA_API_KEY;
  delete process.env.PUBLIC_DATA_API_KEY;
  try {
    const res = response();
    await handler({ method: 'GET', query: {
      pnu: '1165010700000200043', dong: '101동', ho: '101호', areaM2: '84.943',
    } }, res);
    assert.equal(res.code, 200);
    assert.equal(res.body.pblntfPc, 2_462_000_000);
    assert.equal(res.body.source, 'data.go.kr-file-seed');
  } finally {
    if (originalKey === undefined) delete process.env.PUBLIC_DATA_API_KEY;
    else process.env.PUBLIC_DATA_API_KEY = originalKey;
  }
});
