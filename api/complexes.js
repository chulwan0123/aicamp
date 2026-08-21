import { findComplexByPnu, getComplexSearchManifest, searchComplexes } from './_lib/complexSearchStore.js';
import { findPublicPriceUnits, PUBLIC_PRICE_SOURCE } from './_lib/publicPriceStore.js';
import { groupUnitsByDong } from './_lib/unitGroups.js';
import { isSupportedPnu } from './price.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET 요청만 지원해요.' });

  try {
    const districtCode = String(req.query?.districtCode || '');
    const query = String(req.query?.q || '').trim();
    const pnu = String(req.query?.pnu || '');
    const mode = String(req.query?.mode || '');
    if (mode === 'units') {
      const areaM2 = Number(req.query?.areaM2);
      if (!/^\d{19}$/.test(pnu) || !isSupportedPnu(pnu)) {
        return res.status(400).json({ error: '현재는 서울·경기 아파트만 선택할 수 있어요.' });
      }
      if (!(areaM2 > 0)) return res.status(400).json({ error: '전용면적을 먼저 선택해 주세요.' });
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
    }
    if (!districtCode && !query && !pnu) {
      const manifest = await getComplexSearchManifest({ req, fetchImpl: req.fetchImpl || fetch });
      return res.status(200).json(manifest);
    }
    if (!/^(11|41)\d{3}$/.test(districtCode)) {
      return res.status(400).json({ error: '서울·경기의 시/군/구를 선택해 주세요.' });
    }
    if (pnu) {
      if (!/^(11|41)\d{17}$/.test(pnu) || !pnu.startsWith(districtCode)) {
        return res.status(400).json({ error: '선택한 지역과 주소 정보를 다시 확인해 주세요.' });
      }
      const item = await findComplexByPnu(districtCode, pnu, { req, fetchImpl: req.fetchImpl || fetch });
      return res.status(200).json({ items: item ? [item] : [], count: item ? 1 : 0 });
    }
    if (!query) return res.status(400).json({ error: '단지명을 입력해 주세요.' });
    const items = await searchComplexes(districtCode, query, { req, fetchImpl: req.fetchImpl || fetch });
    return res.status(200).json({ items, count: items.length });
  } catch (error) {
    console.error('[complexes] 단지·동호수 검색 실패', error);
    return res.status(500).json({ error: error?.message || '단지 정보를 불러오는 중 오류가 발생했어요.' });
  }
}
