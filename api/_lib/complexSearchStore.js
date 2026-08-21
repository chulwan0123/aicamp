import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';

const unzip = promisify(gunzip);
const BASE_YEAR = '2025';
const MAX_CACHE_ENTRIES = 8;
const cache = new Map();

function requestOrigin(req) {
  const configured = String(process.env.PROPERTY_SEARCH_DATA_BASE_URL || '').replace(/\/$/, '');
  if (configured) return configured;
  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
  if (!host) return '';
  const protocol = req?.headers?.['x-forwarded-proto'] || (/^(localhost|127\.0\.0\.1|\[::1\])(?::|$)/.test(String(host)) ? 'http' : 'https');
  return `${protocol}://${host}/data/property-search/${BASE_YEAR}`;
}

async function fetchPayload(filename, { req, fetchImpl }) {
  const origin = requestOrigin(req);
  if (!origin) throw new Error('단지 검색 데이터 주소를 확인할 수 없어요.');
  const response = await fetchImpl(`${origin}/${filename}`, { headers: { Accept: 'application/json, application/gzip' } });
  if (!response.ok) throw new Error(`단지 검색 데이터를 불러오지 못했어요. (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

async function load(filename, options) {
  if (cache.has(filename)) return cache.get(filename);
  const pending = (async () => {
    const payload = await fetchPayload(filename, options);
    const decoded = payload[0] === 0x1f && payload[1] === 0x8b ? await unzip(payload) : payload;
    return JSON.parse(String(decoded));
  })();
  cache.set(filename, pending);
  while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  try {
    return await pending;
  } catch (error) {
    cache.delete(filename);
    throw error;
  }
}

export function normalizeComplexQuery(value) {
  return String(value || '').normalize('NFC').toLowerCase().replace(/[\s·\-()]/g, '');
}

export async function getComplexSearchManifest({ req, fetchImpl = fetch } = {}) {
  return load('manifest.json', { req, fetchImpl });
}

export async function searchComplexes(districtCode, query, { req, fetchImpl = fetch, limit = 30 } = {}) {
  const code = String(districtCode || '');
  if (!/^(11|41)\d{3}$/.test(code)) return [];
  const needle = normalizeComplexQuery(query);
  if (!needle) return [];
  const items = await load(`${code}.json.gz`, { req, fetchImpl });
  return items
    .filter((item) => normalizeComplexQuery(`${item.complexName} ${item.roadAddress}`).includes(needle))
    .slice(0, Math.max(1, Math.min(Number(limit) || 30, 50)));
}

export async function findComplexByPnu(districtCode, pnu, { req, fetchImpl = fetch } = {}) {
  const code = String(districtCode || '');
  const target = String(pnu || '');
  if (!/^(11|41)\d{3}$/.test(code) || !/^(11|41)\d{17}$/.test(target)) return null;
  const items = await load(`${code}.json.gz`, { req, fetchImpl });
  return items.find((item) => String(item.pnu) === target) || null;
}

export function clearComplexSearchCache() {
  cache.clear();
}
