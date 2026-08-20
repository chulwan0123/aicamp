/**
 * LLM 응답 검증.
 * 금액은 규칙 엔진이 계산하므로 산술 검산은 필요 없다.
 * 여기서는 판단의 정합성과 문장의 완결성만 본다.
 */
const OPTION_IDS = ['SELL', 'DOWNSIZE', 'PARTIAL', 'PENSION'];

function stringValues(value, output = []) {
  if (typeof value === 'string') output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => stringValues(item, output));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => stringValues(item, output));
  return output;
}

export function verify(draft, computed) {
  const errors = [];
  if (!draft) return ['응답이 비어 있음'];

  const options = computed?.options || {};
  const eligible = OPTION_IDS.filter((id) => options[id]?.eligible === true);
  const ineligible = OPTION_IDS.filter((id) => options[id] && options[id].eligible === false);

  /* --- 추천안 --- */
  const id = draft.recommendedId;
  if (!id) errors.push('recommendedId 누락');
  else if (!OPTION_IDS.includes(id)) errors.push(`recommendedId 가 알 수 없는 값: ${id}`);
  else if (!eligible.includes(id)) {
    errors.push(`자격 미달인 ${id} 를 추천했다. 가능한 안은 ${eligible.join(', ') || '없음'} 뿐이다.`);
  }

  /* --- 성향 --- */
  const p = draft.profile;
  if (!p) errors.push('profile 누락');
  else {
    for (const key of ['inheritance', 'residency', 'urgency']) {
      const v = p[key];
      if (typeof v !== 'number' || v < 0 || v > 100) errors.push(`profile.${key} 가 0~100 범위의 숫자가 아님`);
    }
    if (!p.note) errors.push('profile.note 누락');
  }

  /* --- 배제·대안 목록 정합성 --- */
  const excludedIds = (draft.excluded || []).map((x) => x.id);
  const missingExcluded = ineligible.filter((x) => !excludedIds.includes(x));
  if (missingExcluded.length) errors.push(`excluded 에 빠진 안: ${missingExcluded.join(', ')}`);
  const wrongExcluded = excludedIds.filter((x) => eligible.includes(x));
  if (wrongExcluded.length) errors.push(`가능한 안을 excluded 에 넣었다: ${wrongExcluded.join(', ')}`);
  for (const item of draft.excluded || []) {
    if (!item.reason || item.reason.length < 10) errors.push(`excluded.${item.id}.reason 이 너무 짧다`);
  }

  const altIds = (draft.alternatives || []).map((x) => x.id);
  if (altIds.includes(id)) errors.push('추천안을 alternatives 에도 넣었다');
  for (const item of draft.alternatives || []) {
    if (!item.oneLiner) errors.push(`alternatives.${item.id}.oneLiner 누락`);
  }

  /* --- 문장 --- */
  const required = {
    cashflowSummary: 8, label: 2, headline: 5, why: 40, tradeoff: 10, familyNote: 60,
  };
  for (const [key, min] of Object.entries(required)) {
    const value = draft[key];
    if (!value || String(value).trim().length < min) errors.push(`${key} 가 없거나 너무 짧다 (최소 ${min}자)`);
  }
  if (String(draft.headline || '').length > 40) errors.push('headline 이 40자를 넘는다');
  if (!Array.isArray(draft.cautions) || draft.cautions.length < 1) errors.push('cautions 가 비어 있다');
  if (!Array.isArray(draft.actionPlan) || draft.actionPlan.length < 4) errors.push('actionPlan 이 4단계 미만');

  /* --- 미확정 제도·근사값 고지 --- */
  const cautionText = (draft.cautions || []).join(' ');
  if (computed?.taxes?.sale2027Special?.applicable && id === 'DOWNSIZE') {
    if (!/확정|시행|개편안/.test(cautionText)) {
      errors.push('2027년 시행 예정 특례를 활용했는데, 법률이 확정돼야 적용된다는 사실이 cautions 에 없다');
    }
    if (!/추징|5년|다시 사/.test(cautionText)) {
      errors.push('감면세액 추징 조건(5년 이내 수도권 재취득)이 cautions 에 없다');
    }
  }
  if (computed?.taxes?.holding?.some((h) => h.estimated) && !/보유세|추정|근사|달라질/.test(cautionText)) {
    errors.push('보유세가 근사값이라는 점이 cautions 에 없다');
  }

  /* --- 금액 표기 --- */
  const prose = [
    draft.cashflowSummary, draft.headline, draft.why, draft.tradeoff, draft.familyNote,
    ...(draft.cautions || []),
    ...(draft.alternatives || []).map((a) => a.oneLiner),
    ...(draft.excluded || []).map((e) => e.reason),
  ].filter(Boolean).join(' ');
  // 7자리 이상 숫자(콤마 포함)는 원 단위를 그대로 쓴 것이다 — 어르신이 읽기 어렵다.
  const rawAmounts = prose.match(/\d{1,3}(?:,\d{3}){2,}|\d{7,}/g);
  if (rawAmounts?.length) {
    errors.push(`금액을 원 단위로 썼다: ${[...new Set(rawAmounts)].slice(0, 4).join(', ')}. 억·만원 단위 한글(예: 4억원, 130만원)로 다시 써라.`);
  }
  const amountPattern = /\d[\d,]*(?:억(?:\s*\d[\d,]*만)?|만)?원/g;
  const allowedAmounts = new Set(stringValues(computed?.display).flatMap((value) => value.match(amountPattern) || []));
  const spokenAmounts = prose.match(amountPattern) || [];
  const invented = [...new Set(spokenAmounts.filter((amount) => !allowedAmounts.has(amount)))];
  if (invented.length) {
    errors.push(`computed.display 에 없는 금액을 문장에 썼다: ${invented.slice(0, 4).join(', ')}`);
  }

  return errors;
}
