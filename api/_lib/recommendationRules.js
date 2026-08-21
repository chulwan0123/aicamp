import { recommendationHeadline } from './recommendationCopy.js';

export const HOLD_INCOME_THRESHOLD = 3_000_000;

const HOLD_ID = 'HOLD';
const HOLD_LABEL = '현재 집 그대로 보유하기';

export function mustRecommendHold(computed) {
  return Number(computed?.cashflow?.monthlyIncome || 0) >= HOLD_INCOME_THRESHOLD
    && computed?.options?.HOLD?.eligible === true;
}

/**
 * 월 연금·소득이 300만 원 이상이면 AI 판단보다 보유 추천 규칙을 우선한다.
 * 추천안을 바꾸면 기존 추천안을 대안 목록으로 돌려 비교 선택지가 사라지지 않게 한다.
 */
export function enforceMandatoryRecommendation({ draft, computed }) {
  if (!mustRecommendHold(computed)) return draft;

  const eligibleIds = Object.entries(computed.options)
    .filter(([, option]) => option?.eligible === true)
    .map(([id]) => id);
  const existingAlternatives = new Map((draft.alternatives || []).map((item) => [item.id, item]));
  const monthlyIncome = computed.display?.monthlyIncome || '300만원 이상';
  const monthlyNet = computed.display?.optionMonthlyNet?.HOLD || '계산된 금액';

  return {
    ...draft,
    recommendedId: HOLD_ID,
    label: HOLD_LABEL,
    headline: recommendationHeadline(HOLD_ID),
    why: `월 연금·소득이 ${monthlyIncome}으로 300만원 이상이에요. 현재 기준에서는 집을 팔지 않고 그대로 보유하는 방법을 먼저 권해 드려요. 보유세를 빼고 매달 쓸 수 있는 돈은 ${monthlyNet}이에요.`,
    tradeoff: '집은 그대로 남지만 필요한 생활비보다 부족할 수 있어요. 해마다 보유세도 계속 내셔야 해요.',
    alternatives: eligibleIds
      .filter((id) => id !== HOLD_ID)
      .map((id) => existingAlternatives.get(id) || {
        id,
        oneLiner: '현재 소득 기준에서는 집을 그대로 보유하는 방법을 먼저 권해 드려요.',
      }),
    familyNote: `현재 월 연금·소득이 ${monthlyIncome}이에요. 우리 서비스의 300만원 이상 추천 기준에 따라 지금 집을 그대로 보유하는 방법을 먼저 살펴보면 좋겠어요. 보유세를 빼고 매달 쓸 수 있는 돈은 ${monthlyNet}이에요. 실제 세금과 생활비는 가족이 함께 다시 확인해 보세요.`,
  };
}
