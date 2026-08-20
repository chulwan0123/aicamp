import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { extractGovErrorMessage, extractItems, normalizeItem } from '../api/price.js';

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
  } } } } });
  assert.deepEqual(item.map(normalizeItem), [
    { aphusNm: '테스트아파트', pblntfPc: 930_000_000, stdrYear: '2026' },
  ]);
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
        { aphusNm: '테스트아파트', pblntfPc: '1100000000', stdrYear: '2024' },
        { aphusNm: '테스트아파트', pblntfPc: '1200000000', stdrYear: '2025' },
      ] }),
    };
  };

  try {
    const res = response();
    await handler({ method: 'GET', query: { pnu: '1165010700000200043' } }, res);
    assert.equal(res.code, 200);
    assert.deepEqual(res.body, { aphusNm: '테스트아파트', pblntfPc: 1_200_000_000, stdrYear: '2025' });
    const requested = new URL(requestedUrl);
    assert.equal(requested.origin + requested.pathname, 'https://apis.data.go.kr/1611000/nsdi/ApartHousingPriceService/attr/getApartHousingPriceAttr');
    assert.equal(requested.searchParams.get('serviceKey'), 'test-key');
    assert.equal(requested.searchParams.get('pnu'), '1165010700000200043');
    assert.equal(requested.searchParams.get('format'), 'json');
    assert.equal(requested.searchParams.get('numOfRows'), '50');
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
    await handler({ method: 'GET', query: { pnu: '1165010700000200043' } }, res);
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
    await handler({ method: 'GET', query: { pnu: '1165010700000200043' } }, res);
    assert.equal(res.code, 404);
    assert.match(res.body.error, /찾을 수 없/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PUBLIC_DATA_API_KEY;
    else process.env.PUBLIC_DATA_API_KEY = originalKey;
  }
});
