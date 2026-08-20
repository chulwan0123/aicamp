import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';

const unzip = promisify(gunzip);
const BASE_YEAR = '2025';
const MAX_CACHE_ENTRIES = 4;
const cache = new Map();

export const PUBLIC_PRICE_SOURCE = {
  id: '3073746',
  name: '국토교통부_주택 공시가격 정보_20250626',
  baseDate: '2025-01-01',
  url: 'https://www.data.go.kr/data/3073746/fileData.do',
};

function trimCache() {
  while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
}

function requestOrigin(req) {
  const configured = String(process.env.PUBLIC_PRICE_DATA_BASE_URL || '').replace(/\/$/, '');
  if (configured) return configured;
  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
  if (!host) return '';
  const protocol = req?.headers?.['x-forwarded-proto'] || (String(host).includes('localhost') ? 'http' : 'https');
  return `${protocol}://${host}/data/public-price`;
}

async function readCompressedShard(shard, { req, fetchImpl }) {
  const filename = `${shard}.tsv.gz`;
  const origin = requestOrigin(req);
  if (!origin) return null;
  const response = await fetchImpl(`${origin}/${BASE_YEAR}/${filename}`, {
    headers: { Accept: 'application/gzip, application/octet-stream' },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`공시가격 원본 조각을 불러오지 못했어요. (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

async function loadShard(shard, options) {
  if (cache.has(shard)) return cache.get(shard);
  const pending = (async () => {
    const compressed = await readCompressedShard(shard, options);
    if (!compressed) return '';
    const payload = compressed[0] === 0x1f && compressed[1] === 0x8b
      ? await unzip(compressed)
      : compressed;
    return String(payload);
  })();
  cache.set(shard, pending);
  trimCache();
  try {
    return await pending;
  } catch (error) {
    cache.delete(shard);
    throw error;
  }
}

function parseLine(line) {
  const [
    pnu, complexName, dongName, hoName, areaM2, officialPrice, roadAddress,
    complexCode, dongCode, hoCode, buildingLedgerPk,
  ] = line.split('\t');
  return {
    pnu,
    aphusNm: complexName || null,
    dongNm: dongName || null,
    hoNm: hoName || null,
    areaM2: Number(areaM2) || null,
    pblntfPc: Number(officialPrice) || 0,
    roadAddress: roadAddress || null,
    complexCode: complexCode || null,
    dongCode: dongCode || null,
    hoCode: hoCode || null,
    buildingLedgerPk: buildingLedgerPk || null,
    stdrYear: BASE_YEAR,
  };
}

export async function findPublicPriceUnits(pnu, { req, fetchImpl = fetch } = {}) {
  const text = String(pnu || '');
  if (!/^(11|41)\d{17}$/.test(text)) return [];
  const shardText = await loadShard(text.slice(0, 7), { req, fetchImpl });
  if (!shardText) return [];
  const prefix = `${text}\t`;
  return shardText.split('\n')
    .filter((line) => line.startsWith(prefix))
    .map(parseLine)
    .filter((item) => item.pblntfPc > 0);
}

export function clearPublicPriceCache() {
  cache.clear();
}
