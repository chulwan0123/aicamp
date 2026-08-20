import { MARKET_DATA_SOURCES, queryApartmentMarket } from './_lib/marketData.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET 요청만 지원해요.' });

  const pnu = String(req.query?.pnu || '');
  if (!/^\d{19}$/.test(pnu)) return res.status(400).json({ error: '올바른 형식의 PNU(19자리 숫자)가 필요해요.' });
  if (!/^(11|41)/.test(pnu)) return res.status(400).json({ error: '현재는 서울·경기 아파트만 조회할 수 있어요.' });

  const complexName = String(req.query?.complexName || '').trim();
  if (!complexName) return res.status(400).json({ error: '정확한 단지명이 필요해요.' });
  const areaM2 = Number(req.query?.areaM2) || null;
  const months = Math.min(12, Math.max(1, Number(req.query?.months) || 6));
  const mode = String(req.query?.mode || 'all');
  if (!['trade', 'rent', 'all'].includes(mode)) return res.status(400).json({ error: 'mode는 trade, rent, all 중 하나여야 해요.' });

  const apiKey = process.env.DATA_GO_KR_API_KEY || process.env.PUBLIC_DATA_API_KEY;
  if (!apiKey) return res.status(503).json({ error: '실거래 조회용 공공데이터 API 키가 설정되지 않았어요.' });

  try {
    const requestedModes = mode === 'all' ? ['trade', 'rent'] : [mode];
    const results = await Promise.allSettled(requestedModes.map((requestedMode) =>
      queryApartmentMarket({ pnu, complexName, areaM2, months, mode: requestedMode, apiKey })));
    const payload = {};
    const errors = {};
    results.forEach((result, index) => {
      const requestedMode = requestedModes[index];
      if (result.status === 'fulfilled') payload[requestedMode] = result.value;
      else errors[requestedMode] = result.reason?.message || '조회 중 오류가 발생했어요.';
    });
    if (!Object.keys(payload).length) throw new Error(Object.values(errors).join(' / '));
    return res.status(200).json({
      ...payload,
      errors: Object.keys(errors).length ? errors : undefined,
      sources: Object.fromEntries(requestedModes.map((requestedMode) => [requestedMode, MARKET_DATA_SOURCES[requestedMode]])),
    });
  } catch (error) {
    console.error('[market] 실거래 조회 실패', error);
    const message = error?.name === 'AbortError'
      ? '실거래 조회 시간이 초과됐어요. 잠시 후 다시 시도해 주세요.'
      : error?.message || '실거래 조회 중 오류가 발생했어요.';
    return res.status(502).json({ error: message });
  }
}
