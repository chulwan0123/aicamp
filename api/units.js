import { findPublicPriceUnits, PUBLIC_PRICE_SOURCE } from './_lib/publicPriceStore.js';
import { isSupportedPnu, normalizeItem } from './price.js';

const byUnitToken = (left, right) => String(left).localeCompare(String(right), 'ko-KR', {
  numeric: true,
  sensitivity: 'base',
});

export function groupUnitsByDong(items, areaM2) {
  const targetArea = Number(areaM2);
  if (!(targetArea > 0)) return [];

  const grouped = new Map();
  for (const raw of items) {
    const item = normalizeItem(raw);
    if (!item.dongNm || !item.hoNm || !(item.pblntfPc > 0)) continue;
    if (item.areaM2 !== null && Math.abs(item.areaM2 - targetArea) > 0.001) continue;
    if (!grouped.has(item.dongNm)) grouped.set(item.dongNm, new Map());
    grouped.get(item.dongNm).set(item.hoNm, {
      ho: item.hoNm,
      officialPrice: item.pblntfPc,
      officialPriceYear: item.stdrYear,
      areaM2: item.areaM2,
    });
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => byUnitToken(left, right))
    .map(([dong, homes]) => ({
      dong,
      homes: [...homes.values()].sort((left, right) => byUnitToken(left.ho, right.ho)),
    }));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET 요청만 지원해요.' });

  const pnu = String(req.query?.pnu || '');
  const areaM2 = Number(req.query?.areaM2);
  if (!/^\d{19}$/.test(pnu) || !isSupportedPnu(pnu)) {
    return res.status(400).json({ error: '현재는 서울·경기 아파트만 선택할 수 있어요.' });
  }
  if (!(areaM2 > 0)) return res.status(400).json({ error: '전용면적을 먼저 선택해 주세요.' });

  try {
    const items = await findPublicPriceUnits(pnu, { req, fetchImpl: req.fetchImpl || fetch });
    const dongs = groupUnitsByDong(items, areaM2);
    if (!dongs.length) {
      return res.status(404).json({ error: '선택한 전용면적의 동·호수 목록을 찾지 못했어요.' });
    }
    return res.status(200).json({
      pnu,
      areaM2,
      dongs,
      source: 'data.go.kr-file-shard',
      sourceName: PUBLIC_PRICE_SOURCE.name,
      sourceUrl: PUBLIC_PRICE_SOURCE.url,
      sourceBaseDate: PUBLIC_PRICE_SOURCE.baseDate,
    });
  } catch (error) {
    console.error('[units] 동·호수 목록 조회 실패', error);
    return res.status(500).json({ error: error?.message || '동·호수 목록을 불러오는 중 오류가 발생했어요.' });
  }
}
