import { recommendationHeadline } from './recommendationCopy.js';

export const ADEQUATE_COVERAGE_RATIO = 0.9;
export const INTERVENTION_ORDER = ['HOLD', 'PENSION', 'PARTIAL', 'DOWNSIZE', 'SELL'];

const LABELS = {
  HOLD: '현재 집 그대로 보유하기', PENSION: '주택연금', PARTIAL: '집 일부를 세놓기',
  DOWNSIZE: '작은 집으로 옮기기', SELL: '팔고 전세로 옮기기',
};
const MOVE_WILLING = new Set(['조건이 맞으면 이사할 수 있다', '떠나도 괜찮다']);
const URGENT = new Set(['지금 당장 해결해야 한다', '1년 이내에 해결해야 한다']);

function eligibleIds(computed) {
  return INTERVENTION_ORDER.filter((id) => computed?.options?.[id]?.eligible === true);
}

function coverageRatio(computed, id) {
  const target = Math.max(1, Number(computed?.cashflow?.targetExpense || 0));
  return Math.max(0, Number(computed?.options?.[id]?.monthlyNet || 0)) / target;
}

function bestCoverage(computed, ids) {
  return [...ids].sort((a, b) => {
    const gap = coverageRatio(computed, b) - coverageRatio(computed, a);
    return Math.abs(gap) > 0.000001 ? gap : INTERVENTION_ORDER.indexOf(a) - INTERVENTION_ORDER.indexOf(b);
  })[0];
}

/**
 * 집을 파는 결론이 현금흐름 하나만으로 과도하게 나오지 않도록 하는 최종 정책이다.
 * 보유 후 생활비 충족도와 거주 의향을 먼저 보고, 매도는 급하고 이사 가능한 경우의
 * 마지막 선택지로만 남긴다.
 */
export function selectRecommendedId({ computed, answers = {} }) {
  const eligible = eligibleIds(computed);
  if (!eligible.length) throw new Error('추천할 수 있는 시나리오가 없습니다.');

  if (eligible.includes('HOLD') && coverageRatio(computed, 'HOLD') >= ADEQUATE_COVERAGE_RATIO) return 'HOLD';

  const nonSale = ['HOLD', 'PENSION', 'PARTIAL'].filter((id) => eligible.includes(id));
  const adequateNonSale = nonSale.filter((id) => coverageRatio(computed, id) >= ADEQUATE_COVERAGE_RATIO);
  if (adequateNonSale.length) return adequateNonSale[0];

  const hardStay = answers.residency === '절대 떠나고 싶지 않다';
  const canMove = MOVE_WILLING.has(answers.residency);
  const isUrgent = URGENT.has(answers.urgency);
  if (hardStay || !canMove || !isUrgent) return bestCoverage(computed, nonSale.length ? nonSale : eligible);

  // 이사가 가능하고 생활비 해결이 급할 때도 덜 되돌리기 어려운 방법부터 살펴본다.
  const adequateMove = ['DOWNSIZE', 'SELL']
    .filter((id) => eligible.includes(id) && coverageRatio(computed, id) >= ADEQUATE_COVERAGE_RATIO);
  if (adequateMove.length) return adequateMove[0];
  return bestCoverage(computed, eligible);
}

function policyWhy(id, computed) {
  const monthly = computed.display?.optionMonthlyNet?.[id] || '계산된 금액';
  const hasPositiveMonthlyNet = Number(computed?.options?.[id]?.monthlyNet || 0) > 0;
  if (id === 'HOLD') {
    if (coverageRatio(computed, id) >= ADEQUATE_COVERAGE_RATIO) {
      return `집을 그대로 두고 보유세를 빼도 매달 ${monthly}을 쓸 수 있어요. 필요한 생활비의 대부분을 마련할 수 있어요. 집을 파는 큰 결정보다 현재 생활을 지키는 방법을 먼저 권해 드려요.`;
    }
    return hasPositiveMonthlyNet
      ? `지금 사는 곳을 지키고 싶은 마음을 먼저 반영했어요. 집을 그대로 두면 매달 ${monthly}을 쓸 수 있어요. 생활비가 부족할 수 있으니 지출을 함께 점검하고 다른 비매도 방법도 차근차근 비교해 보세요.`
      : '지금 사는 곳을 지키고 싶은 마음을 먼저 반영했어요. 다만 보유세를 내고 나면 생활비로 쓸 소득이 남지 않아요. 지출을 함께 점검하고 다른 비매도 방법도 차근차근 비교해 보세요.';
  }
  if (id === 'PENSION') return `집을 팔지 않고 살던 곳에 머물면서 매달 ${monthly}을 쓸 수 있어요. 생활비를 보태면서 거주를 이어갈 수 있어요. 가입 조건과 실제 지급액을 확인한 뒤 결정해 보세요.`;
  if (id === 'PARTIAL') return `집을 팔지 않고 일부 공간을 활용하면 매달 ${monthly}을 쓸 수 있어요. 현재 집을 지키면서 생활비를 보탤 수 있어요. 임대가 가능한 구조와 실제 임대 조건을 먼저 확인해 보세요.`;
  if (id === 'DOWNSIZE') return `생활비 해결이 급하고 조건이 맞으면 이사할 수 있다고 답하셨어요. 작은 집으로 옮기면 매달 ${monthly}을 쓸 수 있어요. 집을 완전히 처분하기보다 새 집을 남기는 방법을 먼저 권해 드려요.`;
  return `생활비 해결이 급하고 이사도 가능하다고 답하셨어요. 집을 유지하는 방법만으로는 필요한 생활비를 채우기 어려워요. 팔고 전세로 옮기면 매달 ${monthly}을 쓸 수 있어요. 실행 전 세금과 새 거주지를 꼭 다시 확인해 보세요.`;
}

function policyTradeoff(id) {
  if (id === 'HOLD') return '집은 그대로 남지만 생활비가 부족할 수 있어요. 해마다 보유세도 계속 내셔야 해요.';
  if (id === 'PENSION') return '집을 계속 보유하는 대신 해마다 보유세를 내야 해요. 가입 뒤에는 선택을 바꾸기 어려울 수 있어요.';
  if (id === 'PARTIAL') return '임차인과 공간을 나눠 써야 할 수 있어요. 수리비와 빈집 기간도 함께 생각해야 해요.';
  if (id === 'DOWNSIZE') return '익숙한 집을 떠나야 해요. 새 집을 사고 옮기는 비용도 들어요.';
  return '현재 집의 소유권을 포기하고 이사해야 해요. 다시 집을 사려면 자금 계획이 필요해요.';
}

function requiredCautions(draft, computed, id) {
  const cautions = [...(draft.cautions || [])];
  cautions.push('보유세는 입력한 공시가격과 표준 세율로 계산한 예상값이라 실제 고지액과 달라질 수 있어요.');
  if (id === 'DOWNSIZE' && computed?.taxes?.sale2027Special?.applicable) {
    cautions.push('2027년 특례는 발표된 개편안이에요. 법률이 확정되고 요건을 갖춰야 적용돼요.');
    cautions.push('매도 후 5년 안에 수도권 주택을 다시 사면 감면세액이 추징될 수 있어요.');
  }
  return [...new Set(cautions)];
}

function excludedReason(id) {
  if (id === 'PENSION') return '현재 집의 공시가격이나 가입 연령이 기준에 맞지 않아 지금은 이용하기 어려워요.';
  if (id === 'PARTIAL') return '독립 임대가 가능한 구조와 예상 임대수입을 확인하지 못해 지금은 계산하기 어려워요.';
  if (id === 'DOWNSIZE') return '옮길 집의 가격 정보가 없어 지금은 계산하기 어려워요.';
  if (id === 'SELL') return '매도에 필요한 가격과 비용 정보가 부족해 지금은 계산하기 어려워요.';
  return '현재 입력한 정보로는 이 방법을 계산하기 어려워요.';
}

/** AI 문장과 폴백 문장에 동일한 최종 추천 정책을 적용한다. */
export function enforceRecommendationPolicy({ draft, computed, answers = {} }) {
  const id = selectRecommendedId({ computed, answers });
  const eligible = eligibleIds(computed);
  const existingAlternatives = new Map((draft.alternatives || []).map((item) => [item.id, item]));
  const monthly = computed.display?.optionMonthlyNet?.[id] || '계산된 금액';
  const monthlyNote = Number(computed?.options?.[id]?.monthlyNet || 0) > 0
    ? `예상 월 금액은 ${monthly}이에요.`
    : '보유세를 내고 나면 생활비로 쓸 소득이 남지 않을 수 있어요.';

  return {
    ...draft,
    recommendedId: id,
    label: LABELS[id],
    headline: recommendationHeadline(id),
    why: policyWhy(id, computed),
    tradeoff: policyTradeoff(id),
    cautions: requiredCautions(draft, computed, id),
    alternatives: eligible.filter((candidateId) => candidateId !== id).map((candidateId) =>
      existingAlternatives.get(candidateId) || {
        id: candidateId,
        oneLiner: `${LABELS[candidateId]}도 가능해요. 지금은 생활비와 거주 의향을 함께 보면 차선이에요.`,
      }),
    excluded: INTERVENTION_ORDER
      .filter((candidateId) => computed?.options?.[candidateId]?.eligible === false)
      .map((candidateId) => ({ id: candidateId, reason: excludedReason(candidateId) })),
    actionPlan: [
      { title: '생활비 확인', desc: '매달 꼭 필요한 생활비를 가족과 다시 확인해요.', owner: '함께', timing: '결정 전', documents: [] },
      { title: '세금 재계산', desc: '실행할 때의 확정 법령으로 세금을 다시 계산해요.', owner: '전문가', timing: '실행 전', documents: ['세금 고지서'] },
      { title: '대안 비교', desc: '집을 팔지 않는 방법부터 실제 조건을 비교해요.', owner: '함께', timing: '결정 전', documents: [] },
      { title: '가족 상의', desc: '거주와 생활비 중 무엇이 중요한지 함께 정해요.', owner: '함께', timing: '결정 전', documents: [] },
      { title: '최종 확인', desc: '계약 전에 세무와 법률 내용을 확인해요.', owner: '전문가', timing: '계약 전', documents: ['등기부등본'] },
    ],
    familyNote: `부모님의 생활비와 거주 의향을 함께 살펴봤어요. 지금은 ${LABELS[id]} 방법을 먼저 비교해 보면 좋겠어요. ${monthlyNote} 집을 파는 결정은 비매도 방법으로 생활비를 채우기 어려울 때만 살펴봐요. 실제 세금과 계약 조건은 실행 시점에 다시 확인해 주세요. 부모님의 마음을 먼저 듣고 가족이 함께 결정해요.`,
  };
}
