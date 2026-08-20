/**
 * 시나리오 계산 엔진.
 * 네 가지 선택지(SELL/DOWNSIZE/PARTIAL/PENSION)와 증여 검토안의 금액을
 * RULES 만으로 결정적으로 산출하고, 각 금액에 산식(steps)과 법령 근거(basis)를 붙인다.
 *
 * LLM 은 이 결과를 받아 자격 판정 해설·선택지 비교·성향 반영·추천·문장 생성을 맡는다.
 * 금액을 새로 만들어내서는 안 되며, verify() 가 응답의 금액을 이 결과와 대조한다.
 */
import { RULES_2026 as RULES } from './rules.js';
import {
  capitalGainsTax, acquisitionTax, brokerageFee, giftTaxTotal,
  housingPension, drawdownMonthly,
} from './calc.js';
import { holdingTaxByYear, holdingTaxPortfolioByYear } from './holdingTax.js';
import { usableRefinements, refineAppliedNote } from '../../js/refine-fields.js';
import { fmtKRW } from '../../js/format.js';

const round = (n) => {
  if (typeof n !== 'number' || Number.isNaN(n)) throw new TypeError(`계산 결과가 숫자가 아닙니다: ${n}`);
  return Math.round(n);
};
const won = (n) => fmtKRW(round(n), { exact: true });

/** 법령 근거 문구 — 리포트에 그대로 노출된다. */
export const BASIS = {
  capitalGains: '집 한 채만 가진 분은 12억원까지 세금이 없고, 넘는 부분에만 세금이 붙어요. 오래 갖고 오래 사신 만큼 깎아드려요. — 소득세법 제89조·제95조·제104조',
  localIncome: '양도소득세를 내면 그 금액의 10%를 지방소득세로 함께 내요. — 지방세법 제103조의3',
  jointOwnership: '부부 공동명의면 각자 몫으로 나눠 따로 계산해요. 세금이 줄어드는 쪽이에요. — 소득세법 제118조',
  brokerage: '부동산에 드리는 수수료는 법으로 상한이 정해져 있어요. 부가세는 따로예요. — 공인중개사법 시행규칙 제20조',
  acquisition: '집을 살 때 내는 세금이에요. 집값에 따라 세율이 달라져요. — 지방세법 제11조제1항제8호',
  giftTax: '부모님이 자녀에게 주시면 5천만원까지는 세금이 없고, 넘는 금액에 세금이 붙어요. 제때 신고하면 3% 깎아줘요. — 상속세 및 증여세법 제26조·제53조·제69조',
  giftAcquisition: '집을 물려받은 자녀도 취득세를 내요. 85㎡ 이하면 농어촌특별세는 없어요. — 지방세법 제11조·제13조의2, 농어촌특별세법 제4조',
  housingPension: '집에 계속 사시면서 매달 연금을 받는 나라 제도예요. 공시가격 12억원 이하만 가입할 수 있어요. — 한국주택금융공사',
  livingCost: RULES.livingCost.citation,
  drawdown: '남은 돈을 앞으로 사실 기간으로 나눠 매달 얼마씩 쓰실 수 있는지 계산했어요. — 통계청 2024년 생명표',
  special2027: '만 65세가 넘으신 분이 수도권 집을 팔고 6개월 안에 지방으로 옮기시면, 양도소득세를 절반만 내는 제도예요. 감면은 최대 5억원까지예요. 법률이 확정되고 요건을 모두 갖추셔야 적용돼요. — 2026년 세제개편안, 2027년 시행 예정',
};

/** 잔여 자산을 목적별로 나눈다. 배분 비율이 아니라 필요액 기준으로 순서대로 채운다. */
function allocate(remaining, { livingYears, livingAccount, medicalReserve }) {
  const living = Math.min(livingAccount, remaining);
  const medical = Math.min(medicalReserve, remaining - living);
  const rest = remaining - living - medical;
  const longTerm = Math.floor(rest * 0.8 / 1e8) * 1e8; // 억 단위로 절사
  const family = rest - longTerm;
  return [
    { label: `매달 생활비로 쓰실 돈 (${livingYears}년치)`, amount: round(living), note: '예금에 넣고 매달 자동이체' },
    { label: '아프실 때 쓸 돈', amount: round(medical), note: '따로 통장을 만들어 두세요' },
    { label: '안전하게 묻어둘 돈', amount: round(longTerm), note: '예금·국채로 나눠서' },
    { label: '여유 자금', amount: round(family), note: '두 분 쓰실 돈을 먼저 확인한 뒤에' },
  ].filter((row) => row.amount > 0);
}

/** 인출 기간 — 부부 중 연소자의 기대여명(여성 기준, 보수적으로 내림) */
function drawdownYears(youngerAge) {
  const table = RULES.annuitization.lifeExpectancy;
  const ages = Object.keys(table).map(Number).filter((n) => !Number.isNaN(n));
  const nearest = ages.reduce((a, b) => (Math.abs(b - youngerAge) < Math.abs(a - youngerAge) ? b : a));
  return Math.floor(table[nearest].female);
}

/**
 * 전체 시나리오를 계산한다.
 * @returns {{ cashflow, taxes, options, giftReview, meta }}
 */
export function buildScenarios({ property, properties, subject }) {
  const homes = Array.isArray(properties) && properties.length ? properties : [property];
  const primaryHome = homes[0];
  const officialPrice = homes.reduce((sum, home) => sum + home.officialPrice, 0);
  const marketPrice = homes.reduce((sum, home) => sum + home.marketPrice, 0);
  const { areaM2 } = primaryHome;
  const {
    age, spouseAge, holdingYears, ownership,
    monthlyIncome, targetExpense,
    wishRegionIsCapitalArea, residencyYears,
  } = subject;

  const acquisitionPrice = homes.reduce((sum, home, index) =>
    sum + (subject.acquisitions?.[index]?.acquisitionPrice ?? home.acquisitionPrice ?? 0), 0);
  if (!(acquisitionPrice > 0)) throw new Error('취득가액을 알 수 없어 양도소득세를 계산할 수 없습니다.');

  /* 화면에서 되물어 받은 추가 입력 — 답한 항목만 보유세 계산에 반영된다 */
  const refinements = usableRefinements(subject.refinements);

  const ownerCount = homes.some((home, index) =>
    home.ownership === 'JOINT'
    || (subject.acquisitions?.[index]?.ownershipRatio > 0 && subject.acquisitions[index].ownershipRatio < 100)
    || (index === 0 && ownership === 'JOINT_50_50')) ? 2 : 1;
  const youngerAge = Math.min(age, spouseAge ?? age);
  const olderAge = Math.max(age, spouseAge ?? age);
  const lived = residencyYears ?? holdingYears;
  const expenses = RULES.capitalGains.assumedExpenses ?? 50_000_000;
  const portfolioResidencyYears = Math.max(0, ...homes.map((home, index) =>
    subject.acquisitions?.[index]?.residencyYears ?? home.residencyYears ?? 0));
  const hasResidentHome = homes.some((home, index) =>
    subject.acquisitions?.[index]?.isResiding === true || home.isResiding === true);

  /* ---------------------------------------------------------- 보유세 */
  const holding = holdingTaxPortfolioByYear({
    properties: homes, ownerCount, olderAge, holdingYears, refinements,
    isResiding: hasResidentHome || subject.isResiding === true, residencyYears: portfolioResidencyYears || lived,
  });

  /* ------------------------------------------------------ 현금흐름 진단 */
  const monthlyShortage = Math.max(0, targetExpense - monthlyIncome);
  const annualHoldingTax = holding[0]?.total ?? 0;
  const cashflow = {
    monthlyIncome, targetExpense,
    monthlyShortage: round(monthlyShortage),
    annualHoldingTax,
    annualShortage: round(monthlyShortage * 12 + annualHoldingTax),
    steps: [
      `매달 모자란 돈 = 필요한 생활비 ${won(targetExpense)} - 들어오는 돈 ${won(monthlyIncome)} = ${won(monthlyShortage)}`,
      `한 해 모자란 돈 = 매달 ${won(monthlyShortage)} × 12개월 + 세금 ${won(annualHoldingTax)} = ${won(monthlyShortage * 12 + annualHoldingTax)}`,
    ],
    basis: BASIS.livingCost,
  };

  /* ---------------------------------------------------------- 양도세 */
  const saleForYear = (year, reduction = {}) => {
    const results = homes.map((home, index) => capitalGainsTax({
      salePrice: home.marketPrice,
      acquisitionPrice: subject.acquisitions?.[index]?.acquisitionPrice ?? home.acquisitionPrice,
      expenses: Math.round(expenses / homes.length),
      holdingYears: subject.acquisitions?.[index]?.holdingYears ?? Math.max(0, holdingYears),
      residencyYears: subject.acquisitions?.[index]?.residencyYears ?? (index === 0 ? lived : 0),
      ownerCount: subject.acquisitions?.[index]?.ownershipRatio > 0 && subject.acquisitions[index].ownershipRatio < 100 ? 2 : (index === 0 ? ownerCount : 1),
      year,
      houseCount: subject.houseCount ?? homes.length,
      ...reduction,
    }));
    return {
      total: results.reduce((sum, result) => sum + result.total, 0),
      steps: results.flatMap((result, index) => [
        `${homes[index].complexName || `주택 ${index + 1}`} 양도세`,
        ...result.steps.map((step) => `  ${step}`),
      ]),
      byHome: results.map((result, index) => ({ index, total: result.total })),
    };
  };
  const sale2026 = saleForYear(2026);
  const special = RULES.downsizeSpecial2027;
  const houseCount = subject.houseCount ?? 1;
  const eligibleForSpecial = olderAge >= special.minAge
    && houseCount === 1
    && primaryHome.isCapitalArea === true
    && wishRegionIsCapitalArea === false;
  const sale2027 = saleForYear(2027, {
    reductionRate: eligibleForSpecial ? special.reduction : 0,
    reductionCap: special.reductionCap,
    reductionLabel: '고령 1주택자 비수도권 이전 감면',
  });
  const brokerByHome = homes.map((home) => brokerageFee(home.marketPrice));
  const broker = {
    total: brokerByHome.reduce((sum, fee) => sum + fee.total, 0),
    step: `주택별 부동산 수수료 합계 = ${brokerByHome.map((fee) => won(fee.total)).join(' + ')} = ${won(brokerByHome.reduce((sum, fee) => sum + fee.total, 0))}`,
  };

  const taxes = {
    holding,
    holdingNote: RULES.holdingTax.note,
    holdingBasis: RULES.holdingTax._source,
    sale2026: {
      salePrice: marketPrice,
      acquisitionBasis: acquisitionPrice,
      expenses,
      brokerage: broker.total,
      capitalGainsWithLocal: sale2026.total,
      netProceeds: round(marketPrice - sale2026.total - broker.total),
      byHome: sale2026.byHome,
      steps: [...sale2026.steps, broker.step],
      basis: [BASIS.capitalGains, BASIS.localIncome, BASIS.jointOwnership],
    },
    sale2027Special: {
      applicable: eligibleForSpecial,
      legalStatus: 'ANNOUNCED_PROPOSAL',
      capitalGainsWithLocal: sale2027.total,
      netProceeds: round(marketPrice - sale2027.total - broker.total),
      savings: round(sale2026.total - sale2027.total),
      condition: special.condition,
      requirements: special.requirements,
      reductionNote: special.reductionNote,
      status: special.statusLabel,
      source: special.source,
      effectiveYear: special.effectiveYear,
      clawback: special.clawback,
      byHome: sale2027.byHome,
      steps: eligibleForSpecial
        ? [...sale2027.steps, `아끼시는 세금 = ${won(sale2026.total)} - ${won(sale2027.total)} = ${won(sale2026.total - sale2027.total)}`]
        : [`이 특례는 네 가지 조건을 모두 충족해야 해요 = 만 65세 이상 ${olderAge >= special.minAge ? '충족' : '미충족'}, 1세대 1주택 ${houseCount === 1 ? '충족' : '미충족'}, 수도권 주택 ${primaryHome.isCapitalArea === true ? '충족' : '미충족'}, 비수도권 이전 ${wishRegionIsCapitalArea === false ? '충족' : '미충족'}`],
      basis: BASIS.special2027,
    },
  };

  /* ---------------------------------------------------------- PENSION */
  const pension = housingPension({ officialPrice, marketPrice: primaryHome.marketPrice, youngerAge, olderAge });
  const options = {
    PENSION: pension.eligible && pension.monthly != null
      ? {
          eligible: true,
          monthlyPayout: round(pension.monthly),
          monthlyNet: round(pension.monthly + monthlyIncome),
          monthlyFlow: [
            { label: '지금 받으시는 연금', amount: monthlyIncome },
            { label: '주택연금 월지급금', amount: pension.monthly },
          ],
          steps: pension.steps,
          basis: BASIS.housingPension,
        }
      : {
          eligible: false,
          reason: pension.reason,
          qualification: pension.eligible ? 'POSSIBLE_OFFICIAL_QUOTE_REQUIRED' : 'INELIGIBLE',
          monthlyIfEligibleLater: pension.monthlyIfEligibleLater ?? null,
          laterCondition: pension.laterCondition ?? null,
          steps: [`가입 여부 = ${pension.reason}`],
          basis: BASIS.housingPension,
        },
  };

  /* ---------------------------------------------------------- PARTIAL */
  const partialPossible = subject.partialSpacePossible === true && subject.partialMonthlyRent > 0;
  options.PARTIAL = partialPossible
    ? {
        eligible: true,
        monthlyNet: round(monthlyIncome + subject.partialMonthlyRent - annualHoldingTax / 12),
        monthlyFlow: [
          { label: '지금 받으시는 연금', amount: monthlyIncome },
          { label: '집 일부 임대수입', amount: subject.partialMonthlyRent },
          { label: '현재 집 보유세', amount: -round(annualHoldingTax / 12) },
        ],
        reason: '독립 임대가 가능한 구조와 예상 임대수입을 직접 입력하셨어요.',
        steps: [`월 사용 가능 금액 = 소득 ${won(monthlyIncome)} + 임대수입 ${won(subject.partialMonthlyRent)} - 보유세 월평균 ${won(annualHoldingTax / 12)}`],
        basis: '실제 임대 가능 여부는 건축물대장, 관리규약과 현장 구조를 확인해야 해요.',
      }
    : {
        eligible: false,
        reason: `독립 임대가 가능한 구조와 예상 월 임대수입을 확인해야 해요. 집을 그대로 두시면 세금 한 해 ${won(annualHoldingTax)}은 계속 나가요.`,
        steps: ['별도 출입문·주방·욕실과 실제 예상 월 임대수입이 모두 필요해요.'],
        basis: '집 일부를 따로 세놓으려면 출입문·부엌·욕실이 따로 있어야 해요. — 건축법 시행령 제3조의5',
      };

  /* ------------------------------------------------------------- SELL */
  const years = drawdownYears(youngerAge);
  const deposit = subject.rentalDeposit;
  const medical = subject.medicalReserve;
  if (!(deposit >= 0) || !(medical >= 0)) {
    throw new Error('임차 보증금과 의료·간병 예비자금을 실제 값으로 입력해 주세요.');
  }
  const sellProceeds = taxes.sale2026.netProceeds;
  const sellInvestable = sellProceeds - deposit - medical;
  const sellLiving = Math.max(0, Math.min(sellInvestable, monthlyShortage * 12 * years));
  const sellDraw = drawdownMonthly(sellLiving, years);

  options.SELL = {
    eligible: true,
    monthlyNet: round(monthlyIncome + sellDraw.monthly),
    breakdown: [
      { label: '집 판 돈', amount: marketPrice },
      { label: '팔 때 내는 세금', amount: -sale2026.total, formula: '2026년에 팔 경우, 특례 없이' },
      { label: '부동산 수수료', amount: -broker.total },
      { label: '세금 내고 손에 쥐는 돈', amount: sellProceeds, subtotal: true },
      { label: '전세 보증금', amount: -deposit },
      { label: '아프실 때 쓸 돈', amount: -medical },
      { label: '굴릴 수 있는 돈', amount: round(sellInvestable), subtotal: true },
    ],
    monthlyFlow: [
      { label: '지금 받으시는 연금', amount: monthlyIncome },
      { label: `모아둔 돈에서 꺼내 쓰기 (${won(sellLiving)}을 ${years}년에 나눠서)`, amount: sellDraw.monthly },
    ],
    remainingAssets: {
      home: 0,
      deposit: deposit,
      financial: round(sellInvestable),
      total: round(deposit + sellInvestable),
      note: '집은 남지 않고, 전세 보증금과 현금만 남아요.',
    },
    steps: [...taxes.sale2026.steps, sellDraw.step],
    basis: [BASIS.capitalGains, BASIS.brokerage, BASIS.drawdown],
  };

  /* --------------------------------------------------------- DOWNSIZE */
  const newHomePrice = Number(subject.newHomeMarketPrice) || 0;
  const newHomeOfficialPrice = Number(subject.newHomeOfficialPrice) || 0;
  if (!(newHomePrice > 0)) {
    options.DOWNSIZE = {
      eligible: false,
      reason: '옮길 집의 예상 매매가격을 입력하면 다운사이징을 비교할 수 있어요.',
      steps: ['옮길 집의 예상 매매가격이 입력되지 않았어요.'],
      basis: [BASIS.acquisition, BASIS.brokerage],
    };
  } else {
    const newAcq = acquisitionTax(newHomePrice);
    const newBroker = brokerageFee(newHomePrice);
    const newHomeCost = newHomePrice + newAcq.total + newBroker.total;
    /* 발표 단계인 2027 특례는 현재 결과에 적용하지 않고 별도 what-if 로만 보여준다. */
    const downProceeds = taxes.sale2026.netProceeds;
    const downRemaining = downProceeds - newHomeCost;
    const newHoldingTax = newHomeOfficialPrice > 0 ? holdingTaxByYear({
      officialPrice: newHomeOfficialPrice, ownerCount, olderAge, holdingYears: 0, isResiding: true,
      region: subject.wishRegion || primaryHome.region,
      refinements: { householdHouseCount: 1, ownershipRatio: refinements.ownershipRatio },
    })[0] : null;
    const newHoldingMonthly = newHoldingTax ? -round(newHoldingTax.total / 12) : 0;
    const requiredMonthlyDraw = Math.max(0, targetExpense - monthlyIncome - newHoldingMonthly);
    const downLiving = Math.max(0, Math.min(downRemaining, requiredMonthlyDraw * 12 * years));
    const downDraw = drawdownMonthly(downLiving, years);

    options.DOWNSIZE = {
    eligible: downRemaining > 0,
    reason: downRemaining > 0 ? null : '현재 입력한 새 집 예산이 매도 후 수령액보다 커요.',
    monthlyNet: downRemaining > 0 ? round(monthlyIncome + downDraw.monthly + newHoldingMonthly) : null,
    usesSpecial: false,
    specialWhatIfAvailable: eligibleForSpecial,
    proceeds: [
      { label: '집 판 돈', amount: marketPrice },
      {
        label: '팔 때 내는 세금 (현행 기준)',
        amount: -sale2026.total,
        formula: '발표된 특례는 확정 전이라 현재 계산에 적용하지 않았어요.',
      },
      { label: '부동산 수수료', amount: -broker.total },
      { label: '세금 내고 손에 쥐는 돈', amount: downProceeds, subtotal: true },
      { label: '새 집 사는 데 드는 돈', amount: -round(newHomeCost), formula: `집값 ${won(newHomePrice)} + 취득세 ${won(newAcq.total)} + 수수료 ${won(newBroker.total)}` },
      { label: '그러고도 남는 돈', amount: round(downRemaining), subtotal: true },
    ],
    monthlyFlow: [
      { label: '지금 받으시는 연금', amount: monthlyIncome },
      { label: `모아둔 돈에서 꺼내 쓰기 (${won(downLiving)}을 ${years}년에 나눠서)`, amount: downDraw.monthly },
      { label: '새 집 세금', amount: newHoldingMonthly, formula: newHoldingTax ? '입력한 새 집 공시가격 기준' : '공시가격 미입력으로 제외' },
    ],
    allocation: allocate(downRemaining, { livingYears: years, livingAccount: downLiving, medicalReserve: medical }),
    remainingAssets: {
      home: newHomePrice,
      deposit: 0,
      financial: round(downRemaining),
      total: round(newHomePrice + downRemaining),
      note: '현재 시점의 새 집과 금융자산 합계예요. 매달 인출하면 금융자산은 줄어들어요.',
    },
    steps: [
      ...taxes.sale2026.steps,
      newAcq.step, newBroker.step,
      `새 집 사고 남는 돈 = ${won(downProceeds)} - ${won(newHomeCost)} = ${won(downRemaining)}`,
      downDraw.step,
      ...(newHoldingTax ? [`새 집 세금 (한 달치) = 한 해 ${won(newHoldingTax.total)} ÷ 12개월 = ${won(-newHoldingMonthly)}`] : ['새 집 공시가격을 입력하지 않아 새 집 보유세는 월 현금흐름에서 제외했어요.']),
    ],
    basis: [BASIS.capitalGains, BASIS.acquisition, BASIS.brokerage, BASIS.drawdown],
    };
  }

  /* ------------------------------------------------------- 증여 검토 */
  const gifts = homes.map((home) => giftTaxTotal({
    value: home.marketPrice, area: home.areaM2,
    isAdjustedArea: home.isAdjustedArea === true, isSingleHouseToLineal: homes.length === 1,
  }));
  const gift = {
    giftTax: gifts.reduce((sum, item) => sum + item.giftTax, 0),
    acquisitionTax: gifts.reduce((sum, item) => sum + item.acquisitionTax, 0),
    cashNeeded: gifts.reduce((sum, item) => sum + item.cashNeeded, 0),
    steps: gifts.flatMap((item, index) => [
      `${homes[index].complexName || `주택 ${index + 1}`} 증여 검토`,
      ...item.steps.map((step) => `  ${step}`),
    ]),
  };

  /** LLM 이 문장에 인용할 금액. 원 단위 숫자를 그대로 쓰면 어르신이 읽기 어렵다. */
  const display = {
    marketPrice: fmtKRW(marketPrice),
    officialPrice: fmtKRW(officialPrice),
    monthlyShortage: fmtKRW(cashflow.monthlyShortage),
    targetExpense: fmtKRW(targetExpense),
    monthlyIncome: fmtKRW(monthlyIncome),
    annualHoldingTax: fmtKRW(annualHoldingTax),
    annualShortage: fmtKRW(cashflow.annualShortage),
    capitalGains2026: fmtKRW(sale2026.total),
    capitalGains2027: fmtKRW(sale2027.total),
    specialSavings: fmtKRW(taxes.sale2027Special.savings),
    pensionLimit: fmtKRW(RULES.housingPension.eligibility.maxOfficialPrice),
    pensionIfLater: options.PENSION.monthlyIfEligibleLater ? fmtKRW(options.PENSION.monthlyIfEligibleLater) : null,
    giftCashNeeded: fmtKRW(gift.cashNeeded),
    optionMonthlyNet: Object.fromEntries(Object.entries(options)
      .filter(([, v]) => v.monthlyNet != null)
      .map(([k, v]) => [k, fmtKRW(v.monthlyNet)])),
    optionRemaining: Object.fromEntries(Object.entries(options)
      .filter(([, v]) => v.remainingAssets)
      .map(([k, v]) => [k, { total: fmtKRW(v.remainingAssets.total), home: v.remainingAssets.home ? fmtKRW(v.remainingAssets.home) : '남지 않음' }])),
  };

  return {
    cashflow,
    display,
    taxes,
    options,
    giftReview: {
      considered: true,
      giftTax: gift.giftTax,
      acquisitionTax: gift.acquisitionTax,
      cashNeeded: gift.cashNeeded,
      steps: gift.steps,
      basis: [BASIS.giftTax, BASIS.giftAcquisition],
    },
    meta: {
      ownerCount, youngerAge, olderAge, drawdownYears: years,
      specialApplicable: eligibleForSpecial,
      portfolio: homes.map((home) => ({
        complexName: home.complexName,
        roadAddress: home.roadAddress || home.address,
        detailAddress: home.detailAddress || [home.dong, home.ho].filter(Boolean).join(' '),
        officialPrice: home.officialPrice,
        marketPrice: home.marketPrice,
        acquisitionPrice: home.acquisitionPrice,
        officialPriceSource: home.officialPriceSource || home._source,
        areaM2: home.areaM2,
        ownership: home.ownership || 'SINGLE',
        ownershipRatio: home.ownershipRatio || 100,
        residencyYears: home.residencyYears ?? 0,
        isResiding: home.isResiding === true,
      })),
      assumptions: [
        `집 팔 때 드는 비용을 ${won(expenses)}으로 잡았어요`,
        `${holdingYears}년 갖고 계시고 ${lived}년 사신 걸로 계산했어요`,
        `앞으로 ${years}년 동안 나눠 쓰시는 걸로 잡았어요 (통계청 기대수명 기준)`,
        ...(newHomePrice > 0 ? [`옮기실 새 집 매매가격은 입력하신 ${won(newHomePrice)}을 썼어요`] : ['옮길 집 가격을 입력하지 않아 다운사이징은 비교에서 제외했어요']),
        ...(newHomeOfficialPrice > 0 ? [`옮기실 새 집 공시가격은 입력하신 ${won(newHomeOfficialPrice)}을 썼어요`] : ['옮길 집 공시가격이 없어 새 집 보유세는 계산하지 않았어요']),
      ],
      refinements,
      refinementNotes: Object.entries(refinements).map(([field, value]) => refineAppliedNote(field, value)),
    },
  };
}
