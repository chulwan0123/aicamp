/**
 * "더 정확하게 계산하려면" 항목 정의 — 클라이언트와 서버가 함께 쓰는 단일 원본.
 *
 * 보유세는 세부담상한(작년 고지세액), 공동명의 특례 신청 여부, 지자체 탄력세율처럼
 * 사용자만 아는 값에 좌우된다. 그래서 기본 계산은 표준 가정으로 근사값을 내고,
 * 여기 정의한 항목을 화면에서 되물어 답을 받으면 그 값으로 다시 계산한다.
 *
 * 각 항목의 선택지는 이미 정형화되어 있으므로 자유 입력 대신 버튼으로 제시한다.
 * `neutral: true` 인 선택지는 "모르겠다"는 뜻이라 계산에 반영하지 않고 기본 가정을 유지한다.
 */

export const REFINE_FIELDS = [
  {
    field: 'householdHouseCount',
    label: '가족이 가진 집이 몇 채인가요?',
    short: '보유 주택 수',
    why: '한 채만 갖고 계신 걸로 보고 계산했어요. 두 채 이상이면 세금이 크게 달라져요.',
    impact: 'HIGH',
    input: {
      type: 'options',
      options: [
        { value: 1, label: '한 채예요', hint: '1세대 1주택 공제와 연세·장기보유 공제를 받아요' },
        { value: 2, label: '두 채예요', hint: '1주택 공제가 빠지고 공제액이 9억으로 줄어요' },
        { value: 3, label: '세 채 이상이에요', hint: '공제액이 줄고 세금이 크게 늘어요' },
        { value: null, label: '잘 모르겠어요', neutral: true },
      ],
    },
  },
  {
    field: 'hasAdjustedAreaHome',
    label: '조정대상지역에 있는 집이 포함되어 있나요?',
    short: '조정대상지역 주택',
    why: '2028년부터 3주택 이상이거나 조정대상지역 주택이 포함된 다주택자는 공정시장가액비율이 80%로 올라갈 수 있어요.',
    impact: 'HIGH',
    input: {
      type: 'options',
      options: [
        { value: true, label: '포함되어 있어요', hint: '2028년 공정시장가액비율 80%' },
        { value: false, label: '포함되지 않아요', hint: '2028년 공정시장가액비율 70%' },
        { value: null, label: '잘 모르겠어요', neutral: true },
      ],
    },
  },
  {
    field: 'isResidingHome',
    label: '이 집에 직접 살고 계신가요?',
    short: '실거주 여부',
    why: '2027년부터 사시는 집은 공제가 14억으로 늘고, 살지 않는 집은 9억으로 줄어요. 세금 차이가 가장 크게 나는 항목이에요.',
    impact: 'HIGH',
    input: {
      type: 'options',
      options: [
        { value: true, label: '직접 살고 있어요', hint: '2027년부터 공제 14억원' },
        { value: false, label: '세를 주고 있어요', hint: '2027년부터 공제 9억원으로 줄어요' },
        { value: 'EXCEPTION', label: '직장·학업·부모봉양으로 떨어져 있어요', hint: '정부가 인정하는 사유면 거주로 봐요' },
        { value: null, label: '잘 모르겠어요', neutral: true },
      ],
    },
  },
  {
    field: 'previousYearTax',
    label: '작년에 내신 재산세·종합부동산세',
    short: '작년 낸 세금',
    why: '세금이 갑자기 오르지 않도록 작년의 1.5배까지만 내는 제도가 있어요. 작년 금액을 알려주시면 이걸 반영할 수 있어요.',
    impact: 'HIGH',
    input: {
      type: 'amount',
      unit: '원',
      placeholder: '예) 3,200,000',
      hint: '작년 고지서나 위택스에서 확인하실 수 있어요. 재산세와 종합부동산세를 더한 금액이에요.',
      max: 500_000_000,
      unknownLabel: '고지서를 못 찾겠어요',
    },
  },
  {
    field: 'previousOfficialPrice',
    label: '작년 공시가격을 알고 계신가요?',
    short: '작년 공시가격',
    why: '세금 기준 금액이 갑자기 오르지 않게 막는 상한이 있어요. 지금은 지역 평균 상승률로 어림잡았는데, 실제 금액을 알려주시면 정확해져요.',
    impact: 'HIGH',
    input: {
      type: 'amount',
      unit: '원',
      placeholder: '예) 2,950,000,000',
      hint: '부동산공시가격 알리미에서 연도별로 확인하실 수 있어요.',
      max: 100_000_000_000,
      unknownLabel: '모르겠어요',
    },
  },
  {
    field: 'jointSpecialFiled',
    label: '부부 공동명의 특례를 신청하셨나요?',
    short: '공동명의 특례',
    why: '두 가지 방법 중 더 적게 내는 쪽으로 계산했어요. 실제로 신청하신 내용과 다르면 금액이 달라져요.',
    impact: 'MEDIUM',
    input: {
      type: 'options',
      options: [
        { value: 'JOINT_SPECIAL', label: '특례를 신청했어요', hint: '한 분이 대표로 12억 공제 + 연세·장기보유 공제' },
        { value: 'PER_SHARE', label: '각자 따로 내고 있어요', hint: '두 분이 9억씩 공제, 연세 공제는 없어요' },
        { value: 'SINGLE', label: '단독명의예요', hint: '한 분 이름으로만 되어 있어요' },
        { value: null, label: '잘 모르겠어요', neutral: true },
      ],
    },
  },
  {
    field: 'ownershipRatio',
    label: '등기부에 적힌 두 분의 지분',
    short: '지분 비율',
    why: '반반으로 보고 계산했어요. 지분이 다르면 각자 내실 세금도 달라져요.',
    impact: 'MEDIUM',
    input: {
      type: 'options',
      options: [
        { value: 50, label: '반반이에요 (50:50)' },
        { value: 60, label: '6대 4예요 (60:40)' },
        { value: 70, label: '7대 3예요 (70:30)' },
        { value: 100, label: '한 분 단독이에요' },
        { value: null, label: '잘 모르겠어요', neutral: true },
      ],
    },
  },
  {
    field: 'officialPriceForecast',
    label: '내년·내후년 공시가격 예상',
    short: '공시가격 전망',
    why: '공시가격이 지금 그대로라고 보고 계산했어요. 해마다 바뀌기 때문에 앞으로 낼 세금도 달라져요.',
    impact: 'MEDIUM',
    input: {
      type: 'options',
      options: [
        { value: 0, label: '지금과 비슷할 것 같아요' },
        { value: 3, label: '해마다 3%쯤 오를 것 같아요' },
        { value: 5, label: '해마다 5%쯤 오를 것 같아요' },
        { value: -3, label: '해마다 3%쯤 내릴 것 같아요' },
        { value: null, label: '잘 모르겠어요', neutral: true },
      ],
    },
  },
  {
    field: 'isUrbanArea',
    label: '도시지역에 있는 집인가요?',
    short: '도시지역 여부',
    why: '도시지역이면 재산세를 조금 더 내요. 아니라면 세금이 줄어들어요.',
    impact: 'LOW',
    input: {
      type: 'options',
      options: [
        { value: true, label: '도시지역이에요', hint: '시·구 지역 대부분이 해당해요' },
        { value: false, label: '도시지역이 아니에요', hint: '도시지역분 재산세가 빠져요' },
        { value: null, label: '잘 모르겠어요', neutral: true },
      ],
    },
  },
  {
    field: 'localTaxAdjustment',
    label: '사시는 지자체가 세율을 조정했나요?',
    short: '지자체 탄력세율',
    why: '구청·시청이 세율을 조금 올리거나 내릴 수 있어요. 지금은 기본 세율로 계산했어요.',
    impact: 'LOW',
    input: {
      type: 'options',
      options: [
        { value: 0, label: '기본 세율이에요' },
        { value: -10, label: '10% 깎아줬어요' },
        { value: 10, label: '10% 올렸어요' },
        { value: null, label: '잘 모르겠어요', neutral: true },
      ],
    },
  },
];

/** field 이름으로 정의를 찾는다. 예전 세션에 저장된 응답을 다시 그릴 때 쓴다. */
export const REFINE_FIELD_BY_NAME = Object.fromEntries(REFINE_FIELDS.map((f) => [f.field, f]));

/** 사용자가 고른 값을 화면에 보여줄 문구로 바꾼다. */
export function refineAnswerLabel(field, value) {
  const spec = REFINE_FIELD_BY_NAME[field];
  if (!spec || value === undefined || value === null) return '';
  if (spec.input.type === 'amount') return `${Number(value).toLocaleString('ko-KR')}${spec.input.unit}`;
  return spec.input.options.find((o) => o.value === value)?.label || '';
}

/** 반영된 조건을 "가정 보기" 목록에 넣을 한 줄로 만든다. 조사가 꼬이지 않게 붙여 쓰지 않는다. */
export function refineAppliedNote(field, value) {
  const spec = REFINE_FIELD_BY_NAME[field];
  const label = refineAnswerLabel(field, value);
  if (!spec || !label) return '';
  return `${spec.short} — ${label} (알려주신 대로 반영했어요)`;
}

/** 계산에 실제로 반영할 값만 남긴다 — null(모르겠어요)은 버린다. */
export function usableRefinements(refinements) {
  const clean = {};
  for (const [key, value] of Object.entries(refinements || {})) {
    if (value === null || value === undefined || value === '') continue;
    if (!REFINE_FIELD_BY_NAME[key]) continue;
    clean[key] = value;
  }
  return clean;
}
