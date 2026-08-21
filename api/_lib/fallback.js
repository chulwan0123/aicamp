import { recommendationHeadline } from './recommendationCopy.js';
import { enforceRecommendationPolicy } from './recommendationRules.js';

const LABELS = {
  HOLD: '현재 집 그대로 보유하기',
  SELL: '팔고 전세로 옮기기',
  DOWNSIZE: '작은 집으로 옮기기',
  PARTIAL: '집 일부를 세놓기',
  PENSION: '주택연금',
};

const scoreFromAnswer = (value, table, fallback = 50) => table[value] ?? fallback;

function profileFromAnswers(answers = {}) {
  const inheritance = scoreFromAnswer(answers.inheritance, {
    '매우 중요하다': 95, '어느 정도 중요하다': 70,
    '크게 중요하지 않다': 35, '생활비가 우선이다': 10,
  });
  const residency = scoreFromAnswer(answers.residency, {
    '절대 떠나고 싶지 않다': 100,
    '가능하면 지금 집에 살고 싶지만 세금이 부담된다': 75,
    '조건이 맞으면 이사할 수 있다': 40, '떠나도 괜찮다': 10,
  });
  const urgency = scoreFromAnswer(answers.urgency, {
    '지금 당장 해결해야 한다': 100, '1년 이내에 해결해야 한다': 75,
    '2~3년 이내면 된다': 45, '여유 있게 검토 중이다': 20,
  });
  return {
    inheritance, residency, urgency,
    note: `상속 ${inheritance}점, 거주 ${residency}점, 현금흐름 시급성 ${urgency}점으로 판단했어요.`,
  };
}

function chooseOption(computed, profile) {
  const target = Math.max(1, computed.cashflow.targetExpense);
  const candidates = Object.entries(computed.options)
    .filter(([, option]) => option?.eligible === true)
    .map(([id, option]) => {
      let score = Math.min(120, Math.max(0, option.monthlyNet || 0) / target * 60);
      if (id === 'SELL') score -= profile.inheritance * 0.25 + profile.residency * 0.35;
      if (id === 'DOWNSIZE') score -= profile.residency * 0.2;
      if (id === 'PENSION') score += profile.residency * 0.3 - profile.inheritance * 0.1;
      if (id === 'PARTIAL') score += profile.residency * 0.2;
      if (id === 'HOLD') score += profile.residency * 0.25 + profile.inheritance * 0.15 - profile.urgency * 0.35;
      score += profile.urgency * Math.min(1, (option.monthlyNet || 0) / target) * 0.2;
      return { id, option, score };
    })
    .sort((a, b) => b.score - a.score);
  if (!candidates.length) throw new Error('추천할 수 있는 시나리오가 없습니다.');
  return candidates;
}

/**
 * LLM 실패 시에도 같은 computed를 사용하는 결정적 추천문을 만든다.
 * 정적 목업 금액을 반환하지 않으므로 입력값과 계산 결과가 어긋나지 않는다.
 */
export function createFallbackDraft({ computed, answers = {} }) {
  const profile = profileFromAnswers(answers);
  const ranked = chooseOption(computed, profile);
  const [{ id, option }] = ranked;
  const monthly = computed.display.optionMonthlyNet[id] || '계산 결과';
  const shortage = computed.display.monthlyShortage;
  const label = LABELS[id];
  const cautions = [
    '보유세는 입력한 공시가격과 표준 세율로 계산한 예상값이라 실제 고지액과 달라질 수 있어요.',
    '매도나 증여 전에는 최신 법령과 부모님의 실제 서류를 세무 전문가와 확인해 주세요.',
  ];
  if (id === 'DOWNSIZE' && computed.taxes.sale2027Special.applicable) {
    cautions.push('2027년 특례는 발표된 개편안이에요. 현재 추천 금액에는 적용하지 않았어요.');
    cautions.push('매도 후 5년 안에 수도권 주택을 다시 사면 감면세액이 추징될 수 있어요.');
  }

  return enforceRecommendationPolicy({ computed, answers, draft: {
    profile,
    cashflowSummary: computed.cashflow.monthlyShortage > 0
      ? `집은 ${computed.display.marketPrice}이지만, 매달 ${shortage}이 부족해요.`
      : `집은 ${computed.display.marketPrice}이고, 현재 소득으로 필요한 생활비를 채울 수 있어요.`,
    recommendedId: id,
    label,
    headline: recommendationHeadline(id),
    why: `현재 가능한 선택지 가운데 월 현금흐름이 큰 방법이에요. 매달 쓸 수 있는 금액은 ${monthly}이에요. 부모님의 거주와 상속 성향도 함께 반영했어요. 실행 전 실제 계약 조건을 다시 확인해요.`,
    tradeoff: id === 'HOLD'
      ? '집은 그대로 남지만 생활비 부족액도 그대로 남을 수 있어요. 해마다 보유세도 계속 내셔야 해요.'
      : id === 'PENSION'
        ? '집을 계속 보유하는 대신 해마다 보유세를 부담해야 해요.'
        : '거주지를 옮기거나 현재 집의 소유 형태가 바뀔 수 있어요.',
    cautions,
    actionPlan: [
      { title: '서류 확인', desc: '등기와 취득가액, 실제 거주기간을 먼저 확인해요.' },
      { title: '세금 재계산', desc: '실행할 연도의 확정 법령으로 세금을 다시 계산해요.' },
      { title: '주거비 비교', desc: '새 집이나 임차 보증금의 실제 계약 조건을 비교해요.' },
      { title: '가족 상의', desc: '부모님의 거주와 생활비 우선순위를 함께 정해요.' },
      { title: '전문가 확인', desc: '매도나 증여 전에 세무 전문가에게 최종 확인해요.' },
    ],
    alternatives: ranked.slice(1).map(({ id: alternativeId }) => ({
      id: alternativeId,
      oneLiner: `${LABELS[alternativeId]}도 가능하지만 부모님의 현재 우선순위에는 차선이에요.`,
    })),
    excluded: Object.entries(computed.options)
      .filter(([, candidate]) => candidate && candidate.eligible === false)
      .map(([excludedId, candidate]) => ({
        id: excludedId,
        reason: candidate.reason || `${LABELS[excludedId]}의 적용 요건을 현재 충족하지 못해요.`,
      })),
    familyNote: `부모님의 노후 현금흐름을 함께 확인했어요. 현재는 매달 ${shortage}이 부족해요. ${label}를 우선 비교해 보면 좋겠어요. 예상 월 금액은 ${monthly}이에요. 다만 세금과 실제 계약 조건은 실행 시점에 다시 확인해야 해요. 부모님의 거주 의향을 먼저 듣고 가족이 함께 결정해요.`,
  } });
}
