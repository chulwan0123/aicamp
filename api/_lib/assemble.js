/**
 * 최종 리포트 조립 — 금액은 computed(규칙 엔진), 문장은 draft(LLM).
 * LLM 이 숫자를 틀려도 화면에는 반영되지 않는다.
 */
import { REFINE_FIELDS } from './holdingTax.js';

const OPTION_LABEL = {
  SELL: '팔고 전세로 옮기기', DOWNSIZE: '작은 집으로 옮기기',
  PARTIAL: '집 일부를 세놓기', PENSION: '주택연금',
};

export function assemble({ computed, draft, property, subject }) {
  const id = draft.recommendedId;
  const chosen = computed.options[id] || {};
  const target = computed.cashflow.targetExpense;

  const monthlyNet = chosen.monthlyNet ?? 0;
  const gross = (chosen.monthlyFlow || []).filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const deductions = (chosen.monthlyFlow || [])
    .filter((r) => r.amount < 0)
    .map((r) => ({ label: r.label, amount: r.amount, formula: r.formula }));

  /* 계산 근거 — 화면에 그대로 노출된다 */
  const evidence = [
    { title: '매달 얼마가 모자란가요?', steps: computed.cashflow.steps, basis: computed.cashflow.basis },
    { title: `${computed.taxes.holding[0].year}년에 낼 세금 (갖고 계실 때)`, steps: computed.taxes.holding[0].steps, basis: computed.taxes.holding[0].basis, estimated: true },
    { title: '집을 파실 때 낼 세금', steps: computed.taxes.sale2026.steps, basis: computed.taxes.sale2026.basis },
    ...(computed.taxes.sale2027Special.applicable
      ? [{ title: '1년 기다리시면 얼마를 아낄까요?', steps: computed.taxes.sale2027Special.steps, basis: computed.taxes.sale2027Special.basis, upcoming: computed.taxes.sale2027Special.status }]
      : []),
    { title: `권해 드리는 방법 — ${OPTION_LABEL[id]}`, steps: chosen.steps || [], basis: chosen.basis },
    { title: '주택연금에 가입하실 수 있나요?', steps: computed.options.PENSION.steps, basis: computed.options.PENSION.basis },
    { title: '자녀에게 물려주시면 어떨까요?', steps: computed.giftReview.steps, basis: computed.giftReview.basis },
  ].filter((block) => block.steps?.length);

  return {
    profile: draft.profile,

    cashflow: {
      monthlyIncome: computed.cashflow.monthlyIncome,
      targetExpense: target,
      monthlyShortage: computed.cashflow.monthlyShortage,
      annualHoldingTax: computed.cashflow.annualHoldingTax,
      annualShortage: computed.cashflow.annualShortage,
      summary: draft.cashflowSummary,
      steps: computed.cashflow.steps,
      basis: computed.cashflow.basis,
    },

    recommended: {
      id,
      label: draft.label || OPTION_LABEL[id],
      headline: draft.headline,
      gross,
      deductions,
      net: monthlyNet,
      coverage: target ? Math.min(1, monthlyNet / target) : 0,
      ratioToTarget: target ? monthlyNet / target : 0,
      trace: chosen.steps || [],
      basis: chosen.basis,
      why: draft.why,
      tradeoff: draft.tradeoff,
      cautions: draft.cautions || [],
      actionPlan: draft.actionPlan || [],
    },

    alternatives: (draft.alternatives || [])
      .filter((a) => computed.options[a.id]?.eligible)
      .map((a) => ({
        id: a.id,
        label: OPTION_LABEL[a.id],
        net: computed.options[a.id].monthlyNet ?? 0,
        oneLiner: a.oneLiner,
      })),

    excluded: (draft.excluded || []).map((e) => ({
      id: e.id,
      label: OPTION_LABEL[e.id],
      reason: e.reason,
      fact: computed.options[e.id]?.reason,
    })),

    details: {
      taxes: computed.taxes,
      options: computed.options,
      giftReview: computed.giftReview,
    },

    evidence,

    /** 정확도를 높이려면 사용자가 알려줘야 하는 값 */
    refine: {
      title: '더 정확하게 알려드릴 수 있어요',
      intro: '아래 내용을 알려주시면 실제에 더 가깝게 다시 계산해 드릴 수 있어요.',
      accuracy: computed.taxes.holding[0].accuracy,
      fields: REFINE_FIELDS,
      /** 이미 알려주신 답 — 화면이 선택 상태로 되살린다 */
      answers: computed.meta.refinements || {},
      applied: computed.meta.refinementNotes || [],
      assumptions: computed.meta.assumptions,
    },

    familyNote: draft.familyNote,
  };
}
