/**
 * 공공데이터포털 파일데이터 3073746에서 직접 대조한 기본 예시.
 * 전체 서울·경기 조회는 api/price.js의 공동주택가격 API를 사용하며,
 * 이 값은 API 키가 없는 로컬 환경에서도 기본 플로우를 검증하기 위한 원본 발췌값이다.
 */
export const PUBLIC_PRICE_SOURCE = {
  id: '3073746',
  name: '국토교통부_주택 공시가격 정보_20250626',
  baseDate: '2025-01-01',
  url: 'https://www.data.go.kr/data/3073746/fileData.do',
};

export const PUBLIC_PRICE_SEED = [
  {
    pnu: '1165010700000200043',
    roadAddress: '서울특별시 서초구 신반포로 270',
    aphusNm: '반포자이',
    dongNm: '101',
    hoNm: '101',
    areaM2: 84.943,
    pblntfPc: 2_462_000_000,
    stdrYear: '2025',
    buildingLedgerPk: '10231100187442',
  },
];
