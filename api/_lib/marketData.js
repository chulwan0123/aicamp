const TRADE_URL = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade';
const RENT_URL = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;
const PAGE_SIZE = 1000;
const MAX_CACHE_ENTRIES = 96;
const cache = new Map();

const endpoints = { trade: TRADE_URL, rent: RENT_URL };

function decodeXml(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function tag(block, name) {
  return decodeXml(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1]);
}

function firstTag(block, names) {
  for (const name of names) {
    const value = tag(block, name);
    if (value !== '') return value;
  }
  return '';
}

function number(value) {
  const parsed = Number(String(value || '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export const normalizeComplexName = (value) => String(value || '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[\s·.\-_/()]/g, '');

export function lotNumberFromPnu(pnu) {
  const text = String(pnu || '');
  if (!/^\d{19}$/.test(text)) return '';
  const main = String(Number(text.slice(11, 15)) || 0);
  const sub = String(Number(text.slice(15, 19)) || 0);
  return sub === '0' ? main : `${main}-${sub}`;
}

function normalizeLot(value) {
  const match = String(value || '').trim().match(/(\d+)(?:-(\d+))?/);
  if (!match) return '';
  const main = String(Number(match[1]) || 0);
  const sub = String(Number(match[2]) || 0);
  return sub === '0' ? main : `${main}-${sub}`;
}

function dateFrom(block) {
  const year = number(firstTag(block, ['dealYear', '년']));
  const month = number(firstTag(block, ['dealMonth', '월']));
  const day = number(firstTag(block, ['dealDay', '일']));
  if (!year || !month || !day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseMarketXml(xml, mode) {
  const resultCode = firstTag(xml, ['resultCode', 'returnReasonCode']);
  const resultMessage = firstTag(xml, ['resultMsg', 'returnAuthMsg', 'errMsg']);
  if (resultCode && !['000', '00', '0'].includes(resultCode)) {
    throw new Error(`공공데이터 API 오류(${resultCode}): ${resultMessage || '요청 실패'}`);
  }

  const items = [];
  const itemPattern = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemPattern.exec(xml)) !== null) {
    const block = match[1];
    const common = {
      complexName: firstTag(block, ['aptNm', '아파트']),
      areaM2: number(firstTag(block, ['excluUseAr', '전용면적'])) || null,
      floor: number(firstTag(block, ['floor', '층'])) || null,
      jibun: firstTag(block, ['jibun', '지번']),
      legalDong: firstTag(block, ['umdNm', '법정동']),
      contractDate: dateFrom(block),
      buildYear: number(firstTag(block, ['buildYear', '건축년도'])) || null,
    };
    if (mode === 'trade') {
      items.push({
        ...common,
        price: number(firstTag(block, ['dealAmount', '거래금액'])) * 10_000,
        canceled: Boolean(firstTag(block, ['cdealType', '해제여부']) || firstTag(block, ['cdealDay', '해제사유발생일'])),
        registrationDate: firstTag(block, ['rgstDate', '등기일자']) || null,
      });
    } else {
      items.push({
        ...common,
        deposit: number(firstTag(block, ['deposit', '보증금액'])) * 10_000,
        monthlyRent: number(firstTag(block, ['monthlyRent', '월세금액'])) * 10_000,
        contractType: firstTag(block, ['contractType', '계약구분']) || null,
      });
    }
  }

  return {
    items,
    totalCount: number(firstTag(xml, ['totalCount', 'totalcount'])),
  };
}

function apiKeyForUrl(apiKey) {
  const value = String(apiKey || '').trim();
  if (!value) throw new Error('DATA_GO_KR_API_KEY 환경변수가 필요해요.');
  return /%[0-9a-f]{2}/i.test(value) ? value : encodeURIComponent(value);
}

async function fetchPage({ mode, districtCode, yearMonth, pageNo, apiKey, fetchImpl }) {
  const query = `serviceKey=${apiKeyForUrl(apiKey)}&LAWD_CD=${encodeURIComponent(districtCode)}&DEAL_YMD=${encodeURIComponent(yearMonth)}&numOfRows=${PAGE_SIZE}&pageNo=${pageNo}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${endpoints[mode]}?${query}`, {
      headers: { Accept: 'application/xml, text/xml;q=0.9' },
      signal: controller.signal,
    });
    const xml = await response.text();
    if (!response.ok) throw new Error(`공공데이터 API 호출에 실패했어요. (${response.status})`);
    return parseMarketXml(xml, mode);
  } finally {
    clearTimeout(timeout);
  }
}

function trimCache() {
  while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
}

async function fetchMonth({ mode, districtCode, yearMonth, apiKey, fetchImpl }) {
  const key = `${mode}:${districtCode}:${yearMonth}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const pending = (async () => {
    const first = await fetchPage({ mode, districtCode, yearMonth, pageNo: 1, apiKey, fetchImpl });
    const pages = Math.max(1, Math.ceil(first.totalCount / PAGE_SIZE));
    const remaining = await Promise.all(Array.from({ length: pages - 1 }, (_, index) =>
      fetchPage({ mode, districtCode, yearMonth, pageNo: index + 2, apiKey, fetchImpl })));
    return [first, ...remaining].flatMap((page) => page.items);
  })();
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: pending });
  trimCache();
  try {
    const value = await pending;
    cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
    return value;
  } catch (error) {
    cache.delete(key);
    throw error;
  }
}

export function recentYearMonths(count = 6, now = new Date()) {
  const safeCount = Math.min(12, Math.max(1, Number(count) || 6));
  return Array.from({ length: safeCount }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
    return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function latest(records) {
  return [...records].sort((a, b) => String(b.contractDate || '').localeCompare(String(a.contractDate || '')))[0] || null;
}

function tradeSummary(records) {
  const prices = records.map((item) => item.price).filter((value) => value > 0);
  return {
    count: records.length,
    medianPrice: median(prices),
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    latest: latest(records),
    recent: [...records].sort((a, b) => String(b.contractDate || '').localeCompare(String(a.contractDate || ''))).slice(0, 5),
  };
}

function rentSummary(records) {
  const jeonse = records.filter((item) => item.monthlyRent === 0);
  const monthly = records.filter((item) => item.monthlyRent > 0);
  const deposits = (items) => items.map((item) => item.deposit).filter((value) => value > 0);
  const rents = monthly.map((item) => item.monthlyRent).filter((value) => value > 0);
  const jeonseDeposits = deposits(jeonse);
  const monthlyDeposits = deposits(monthly);
  return {
    count: records.length,
    jeonse: {
      count: jeonse.length,
      medianDeposit: median(jeonseDeposits),
      minDeposit: jeonseDeposits.length ? Math.min(...jeonseDeposits) : null,
      maxDeposit: jeonseDeposits.length ? Math.max(...jeonseDeposits) : null,
      latest: latest(jeonse),
    },
    monthly: {
      count: monthly.length,
      medianDeposit: median(monthlyDeposits),
      medianMonthlyRent: median(rents),
      latest: latest(monthly),
    },
    recent: [...records].sort((a, b) => String(b.contractDate || '').localeCompare(String(a.contractDate || ''))).slice(0, 5),
  };
}

function matchesUnit(item, { complexName, lotNumber, areaM2 }) {
  if (!normalizeComplexName(complexName) || normalizeComplexName(item.complexName) !== normalizeComplexName(complexName)) return false;
  if (lotNumber && normalizeLot(item.jibun) !== lotNumber) return false;
  return !areaM2 || (item.areaM2 && Math.abs(item.areaM2 - areaM2) <= 0.3);
}

export async function queryApartmentMarket({ pnu, complexName, areaM2, months = 6, mode, apiKey, fetchImpl = fetch }) {
  if (!['trade', 'rent'].includes(mode)) throw new Error('mode는 trade 또는 rent여야 해요.');
  if (!/^(11|41)\d{17}$/.test(String(pnu || ''))) throw new Error('서울·경기 PNU 19자리가 필요해요.');
  if (!String(complexName || '').trim()) throw new Error('정확한 단지명이 필요해요.');
  const districtCode = String(pnu).slice(0, 5);
  const lotNumber = lotNumberFromPnu(pnu);
  const yearMonths = recentYearMonths(months);
  const pages = await Promise.all(yearMonths.map((yearMonth) =>
    fetchMonth({ mode, districtCode, yearMonth, apiKey, fetchImpl })));
  const records = pages.flat().filter((item) => matchesUnit(item, {
    complexName,
    lotNumber,
    areaM2: Number(areaM2) || null,
  })).filter((item) => mode !== 'trade' || (!item.canceled && item.price > 0));

  return {
    mode,
    districtCode,
    lotNumber,
    complexName,
    areaM2: Number(areaM2) || null,
    period: { from: yearMonths.at(-1), to: yearMonths[0], months: yearMonths.length },
    ...(mode === 'trade' ? tradeSummary(records) : rentSummary(records)),
  };
}

export function clearMarketCache() {
  cache.clear();
}

export const MARKET_DATA_SOURCES = {
  trade: { name: '국토교통부 아파트매매 실거래 상세 자료', url: TRADE_URL },
  rent: { name: '국토교통부 아파트 전월세 자료', url: RENT_URL },
};
