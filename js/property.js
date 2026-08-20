/**
 * 실거래가·면적 등 분석용 주택 정보는 검증된 발췌본(data/properties.json)을 쓰고,
 * 공시가격은 주소 검색에서 만든 PNU로 서버 API를 조회해 덮어쓸 수 있다.
 */
let cache = null;

const normalize = (text) => String(text || '').replace(/[\s,·\-()]/g, '');

async function loadDataset() {
  if (cache) return cache;
  try {
    const res = await fetch('./data/properties.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cache = (await res.json()).items || [];
  } catch (error) {
    console.error('[property] 데이터셋을 불러오지 못했습니다.', error);
    throw new Error('부동산 데이터셋을 불러오지 못했습니다.');
  }
  return cache;
}

function toProperty(item, confidence) {
  return {
    address: item.address,
    officialPrice: item.officialPrice,
    marketPrice: item.marketPrice,
    confidence: confidence || item.confidence,
    tradeCount: item.tradeCount,
    areaM2: item.areaM2,
    complexName: item.complexName,
    dong: item.dong,
    ho: item.ho,
    pyeong: item.pyeong,
    region: item.region,
    isCapitalArea: item.isCapitalArea,
    isAdjustedArea: item.isAdjustedArea,
    acquisitionYear: item.acquisitionYear,
    acquisitionPrice: item.acquisitionPrice,
    _source: 'dataset',
  };
}

/**
 * 주소 문자열로 단지를 찾는다.
 * 등록되지 않은 주소는 다른 단지 값으로 대체하지 않는다.
 * 잘못된 자산·세금 결과를 만드는 것보다 조회 실패를 명확히 반환하는 편이 안전하다.
 */
export async function lookupProperty(roadAddress, detailAddress = '') {
  const items = await loadDataset();
  const query = normalize(`${roadAddress}${detailAddress}`);

  const hit = items.find((item) =>
    (item.keywords || []).some((keyword) => query.includes(normalize(keyword))));

  if (hit) return toProperty(hit);
  return null;
}

/** PNU와 동·호수로 서버의 국토교통부 공동주택가격 API를 조회한다. */
export async function lookupOfficialPrice(pnu, { dong, ho, areaM2 } = {}) {
  const normalized = String(pnu || '');
  if (!/^\d{19}$/.test(normalized)) throw new Error('올바른 PNU 19자리가 필요해요.');
  if (!dong || !ho) throw new Error('정확한 공시가격 조회를 위해 동·호수를 입력해 주세요.');

  const params = new URLSearchParams({ pnu: normalized, dong: String(dong), ho: String(ho) });
  if (Number(areaM2) > 0) params.set('areaM2', String(areaM2));
  const response = await fetch(`./api/price?${params}`, {
    headers: { Accept: 'application/json' },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || '공시가격을 불러오지 못했어요.');
  if (!Number.isFinite(Number(body.pblntfPc)) || Number(body.pblntfPc) <= 0) {
    throw new Error('공시가격 값을 확인할 수 없어요.');
  }
  return {
    complexName: body.aphusNm || null,
    officialPrice: Number(body.pblntfPc),
    officialPriceYear: body.stdrYear || null,
    areaM2: Number(body.areaM2) || null,
    dong: body.dongNm ? `${body.dongNm}동` : null,
    ho: body.hoNm ? `${body.hoNm}호` : null,
    pnu: normalized,
    _source: body.source || 'data.go.kr',
    sourceName: body.sourceName || null,
    sourceUrl: body.sourceUrl || null,
  };
}

export const CONFIDENCE_LABEL = { HIGH: '높음', MEDIUM: '보통', LOW: '참고용' };
