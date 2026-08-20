const API_BASE_URL = 'https://apis.data.go.kr/1611000/nsdi/ApartHousingPriceService/attr/getApartHousingPriceAttr';
const REQUEST_TIMEOUT_MS = 12_000;
import { PUBLIC_PRICE_SEED, PUBLIC_PRICE_SOURCE } from './_lib/publicPriceSeed.js';

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

export const normalizeUnitToken = (value) => String(value || '')
  .trim()
  .replace(/\s+/g, '')
  .replace(/(동|호)$/g, '')
  .replace(/^0+(?=\d)/, '');

export function normalizeItem(item) {
  return {
    aphusNm: item.aphusNm ?? item.aphusnm ?? null,
    pblntfPc: Number(item.pblntfPc ?? item.pblntfpc ?? 0) || 0,
    stdrYear: String(item.stdrYear ?? item.stdryear ?? '0'),
    dongNm: normalizeUnitToken(item.dongNm ?? item.dongnm ?? item.dong ?? item.buldDongNm),
    hoNm: normalizeUnitToken(item.hoNm ?? item.honm ?? item.ho ?? item.buldHoNm),
    areaM2: Number(item.prvuseAr ?? item.prvusear ?? item.areaM2 ?? item.excluUseAr ?? 0) || null,
  };
}

export function isSupportedPnu(pnu) {
  return /^(11|41)\d{17}$/.test(String(pnu || ''));
}

export function chooseBestItem(items, { dong, ho, areaM2 } = {}) {
  const normalized = items.map(normalizeItem).filter((item) => item.pblntfPc > 0);
  const targetDong = normalizeUnitToken(dong);
  const targetHo = normalizeUnitToken(ho);
  const targetArea = Number(areaM2) || null;
  const exact = normalized.filter((item) =>
    (!targetDong || item.dongNm === targetDong)
    && (!targetHo || item.hoNm === targetHo)
    && (!targetArea || item.areaM2 === null || Math.abs(item.areaM2 - targetArea) <= 0.2));
  if ((targetDong || targetHo) && !exact.length) return null;
  const pool = exact.length ? exact : normalized;
  return pool.sort((a, b) => Number(b.stdrYear) - Number(a.stdrYear))[0] || null;
}

function extractTotalCount(json) {
  return Number(json?.response?.body?.totalCount ?? json?.totalCount ?? json?.totalcount ?? 0) || 0;
}

async function callGovApi(pnu, apiKey) {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    pnu,
    format: 'json',
    numOfRows: '1000',
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
      const first = JSON.parse(rawText);
      const items = extractItems(first);
      const totalCount = extractTotalCount(first);
      if (totalCount <= items.length || items.length === 0) return first;

      const pages = Math.ceil(totalCount / 1000);
      const all = [...items];
      for (let page = 2; page <= pages; page += 1) {
        params.set('pageNo', String(page));
        const next = await fetch(`${API_BASE_URL}?${params}`, {
          cache: 'no-store', signal: controller.signal,
          headers: { Accept: 'application/json, application/xml;q=0.9, text/xml;q=0.8' },
        });
        const nextText = await next.text();
        if (!next.ok) throw new Error(extractGovErrorMessage(nextText) || `공시가격 API ${page}쪽 조회에 실패했어요.`);
        all.push(...extractItems(JSON.parse(nextText)));
      }
      return { field: all };
    } catch {
      const message = extractGovErrorMessage(rawText);
      throw new Error(message || '공시가격 API가 예상하지 못한 형식으로 응답했어요.');
    }
  } finally {
    clearTimeout(timeout);
  }
}

function seedLookup({ pnu, dong, ho, areaM2 }) {
  return chooseBestItem(
    PUBLIC_PRICE_SEED.filter((item) => item.pnu === pnu),
    { dong, ho, areaM2 },
  );
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET 요청만 지원해요.' });

  const pnu = String(req.query?.pnu || '');
  if (!/^\d{19}$/.test(pnu)) {
    return res.status(400).json({ error: '올바른 형식의 PNU(19자리 숫자)가 필요해요.' });
  }
  if (!isSupportedPnu(pnu)) {
    return res.status(400).json({ error: '현재는 서울·경기 아파트만 계산할 수 있어요.' });
  }

  const dong = String(req.query?.dong || '');
  const ho = String(req.query?.ho || '');
  const areaM2 = Number(req.query?.areaM2) || null;
  if (!dong || !ho) return res.status(400).json({ error: '정확한 공시가격 조회를 위해 동·호수가 필요해요.' });

  try {
    const apiKey = process.env.PUBLIC_DATA_API_KEY;
    const items = apiKey ? extractItems(await callGovApi(pnu, apiKey)) : PUBLIC_PRICE_SEED.filter((item) => item.pnu === pnu);
    if (!items.length) return res.status(404).json({ error: '해당 주소의 공동주택가격 정보를 찾을 수 없어요.' });
    const latest = chooseBestItem(items, { dong, ho, areaM2 }) || seedLookup({ pnu, dong, ho, areaM2 });
    if (!latest) return res.status(404).json({ error: '입력한 동·호수와 일치하는 공시가격을 찾지 못했어요.' });

    return res.status(200).json({
      ...latest,
      source: apiKey ? 'data.go.kr-api' : 'data.go.kr-file-seed',
      sourceName: PUBLIC_PRICE_SOURCE.name,
      sourceUrl: PUBLIC_PRICE_SOURCE.url,
    });
  } catch (error) {
    console.error('[price] 공시가격 조회 실패', error);
    const message = error?.name === 'AbortError'
      ? '공시가격 조회 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.'
      : error?.message || '공시가격 조회 중 오류가 발생했어요.';
    return res.status(500).json({ error: message });
  }
}
