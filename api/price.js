import { findPublicPriceUnits, PUBLIC_PRICE_SOURCE } from './_lib/publicPriceStore.js';

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
    areaM2: Number(item.areaM2 ?? item.prvuseAr ?? item.prvusear ?? item.excluUseAr ?? 0) || null,
    roadAddress: item.roadAddress ?? null,
    complexCode: item.complexCode ?? null,
    dongCode: item.dongCode ?? null,
    hoCode: item.hoCode ?? null,
    buildingLedgerPk: item.buildingLedgerPk ?? null,
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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
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
    const items = await findPublicPriceUnits(pnu, { req, fetchImpl: req.fetchImpl || fetch });
    if (!items.length) return res.status(404).json({ error: '해당 주소의 공동주택가격 정보를 찾을 수 없어요.' });
    const latest = chooseBestItem(items, { dong, ho, areaM2 });
    if (!latest) return res.status(404).json({ error: '입력한 동·호수와 일치하는 공시가격을 찾지 못했어요.' });

    return res.status(200).json({
      ...latest,
      source: 'data.go.kr-file-shard',
      sourceName: PUBLIC_PRICE_SOURCE.name,
      sourceUrl: PUBLIC_PRICE_SOURCE.url,
      sourceBaseDate: PUBLIC_PRICE_SOURCE.baseDate,
    });
  } catch (error) {
    console.error('[price] 공시가격 조회 실패', error);
    return res.status(500).json({ error: error?.message || '공시가격 조회 중 오류가 발생했어요.' });
  }
}
