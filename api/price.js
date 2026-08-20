const API_BASE_URL = 'https://apis.data.go.kr/1611000/nsdi/ApartHousingPriceService/attr/getApartHousingPriceAttr';
const REQUEST_TIMEOUT_MS = 12_000;

export function extractGovErrorMessage(rawText) {
  const auth = rawText.match(/<returnAuthMsg>([^<]*)<\/returnAuthMsg>/i)?.[1];
  const error = rawText.match(/<errMsg>([^<]*)<\/errMsg>/i)?.[1];
  const result = rawText.match(/<resultMsg>([^<]*)<\/resultMsg>/i)?.[1];
  const reason = rawText.match(/<returnReasonCode>([^<]*)<\/returnReasonCode>/i)?.[1];
  const parts = [error, auth, result, reason ? `(code: ${reason})` : null].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

export function extractItems(json) {
  const candidates = [
    json?.field,
    json?.response?.body?.items?.item,
    json?.items?.item,
    json?.result,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === 'object') return [candidate];
  }
  return [];
}

export function normalizeItem(item) {
  return {
    aphusNm: item.aphusNm ?? item.aphusnm ?? null,
    pblntfPc: Number(item.pblntfPc ?? item.pblntfpc ?? 0) || 0,
    stdrYear: String(item.stdrYear ?? item.stdryear ?? '0'),
  };
}

async function callGovApi(pnu, apiKey) {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    pnu,
    format: 'json',
    numOfRows: '50',
    pageNo: '1',
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}?${params}`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json, application/xml;q=0.9, text/xml;q=0.8' },
    });
    const rawText = await response.text();
    if (!response.ok) {
      const message = extractGovErrorMessage(rawText);
      throw new Error(message || `공시가격 API 호출에 실패했어요. (${response.status})`);
    }
    try {
      return JSON.parse(rawText);
    } catch {
      const message = extractGovErrorMessage(rawText);
      throw new Error(message || '공시가격 API가 예상하지 못한 형식으로 응답했어요.');
    }
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET 요청만 지원해요.' });

  const apiKey = process.env.PUBLIC_DATA_API_KEY;
  if (!apiKey) return res.status(500).json({ error: '공공데이터 API 키가 설정되지 않았어요.' });

  const pnu = String(req.query?.pnu || '');
  if (!/^\d{19}$/.test(pnu)) {
    return res.status(400).json({ error: '올바른 형식의 PNU(19자리 숫자)가 필요해요.' });
  }

  try {
    const items = extractItems(await callGovApi(pnu, apiKey));
    if (!items.length) return res.status(404).json({ error: '해당 주소의 공동주택가격 정보를 찾을 수 없어요.' });

    const latest = items
      .map(normalizeItem)
      .reduce((current, item) => Number(item.stdrYear) > Number(current.stdrYear) ? item : current);
    if (latest.pblntfPc <= 0) return res.status(502).json({ error: '공시가격 값을 확인할 수 없어요.' });

    return res.status(200).json(latest);
  } catch (error) {
    console.error('[price] 공시가격 조회 실패', error);
    const message = error?.name === 'AbortError'
      ? '공시가격 조회 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.'
      : error?.message || '공시가격 조회 중 오류가 발생했어요.';
    return res.status(500).json({ error: message });
  }
}
