/**
 * 규칙 기반 세액 계산기.
 * RULES_2026 의 수치만으로 각 세목을 결정적으로 계산하고, 단계별 산식을 함께 반환한다.
 *
 * LLM 은 자유 계산을 하다 62% 과다 산출하는 등 산술이 불안정했다.
 * 그래서 금액은 이 모듈이 계산하고, LLM 은 자격 판정·선택지 비교·성향 반영·설명 생성을 맡는다.
 * 산출 결과는 프롬프트에 computed 로 주입되고, verify() 가 LLM 응답과 교차검증한다.
 */
import { RULES_2026 as RULES } from './rules.js';
import { fmtKRW } from '../../js/format.js';

const round = (n) => {
  if (typeof n !== 'number' || Number.isNaN(n)) throw new TypeError(`계산 결과가 숫자가 아닙니다: ${n}`);
  return Math.round(n);
};
const won = (n) => fmtKRW(round(n), { exact: true });

/** 누진세율표에서 과세표준에 해당하는 구간을 찾아 산출세액을 구한다. */
function progressiveTax(base, brackets) {
  if (base <= 0) return { tax: 0, bracket: null };
  const bracket = brackets.find((b) => b.upTo === null || base <= b.upTo);
  return { tax: Math.max(0, base * bracket.rate - bracket.progressive), bracket };
}

/**
 * 1세대1주택 고가주택 양도소득세 (지방소득세 포함).
 * 부부 공동명의는 지분별로 나눠 각자 기본공제와 누진세율을 적용한 뒤 합산한다.
 */
export function capitalGainsTax({
  salePrice,
  acquisitionPrice,
  expenses = 0,
  holdingYears = 0,
  residencyYears = 0,
  ownerCount = 1,
  reductionRate = 0,
  reductionCap = null,
  reductionLabel = '',
  year = RULES.holdingTax.years[0],
  houseCount = 1,
  isAdjustedArea = false,
}) {
  const cg = RULES.capitalGains;
  const steps = [];

  const gain = salePrice - acquisitionPrice - expenses;
  steps.push(`집을 팔아 남은 이익 (양도차익) = 판 값 ${won(salePrice)} - 사신 값 ${won(acquisitionPrice)} - 들어간 비용 ${won(expenses)} = ${won(gain)}`);

  const limit = cg.exemption.priceLimit;
  const taxableRatio = salePrice > limit ? (salePrice - limit) / salePrice : 0;
  if (taxableRatio === 0) {
    return { total: 0, principal: 0, localTax: 0, steps: [`집값이 ${won(limit)} 아래라 세금이 없어요 = ${won(salePrice)} → 0원`], taxableRatio: 0 };
  }
  steps.push(`이 중에서 세금 매기는 몫 = ${won(limit)} 넘는 부분만 → (${won(salePrice)} - ${won(limit)}) ÷ ${won(salePrice)} = ${(taxableRatio * 100).toFixed(2)}%`);

  const taxableGain = gain * taxableRatio;
  steps.push(`세금 매기는 이익 = ${won(gain)} × ${(taxableRatio * 100).toFixed(2)}% = ${won(taxableGain)}`);

  const ltd = cg.longTermDeduction;
  /* 파는 해에 따라 보유 공제는 줄고 거주 공제는 커진다 */
  const caps = ltd.byYear[year] ?? ltd.byYear.default;
  const meetsRequirement = holdingYears >= ltd.minYears && residencyYears >= ltd.minResidencyYears;
  const holdingRate = meetsRequirement ? Math.min(holdingYears * caps.holdingPerYear, caps.maxHoldingRate) : 0;
  const residencyRate = meetsRequirement ? Math.min(residencyYears * caps.residencyPerYear, caps.maxResidencyRate) : 0;
  const deductionRate = Math.min(holdingRate + residencyRate, ltd.maxRate);
  if (!meetsRequirement) {
    steps.push(`3년 이상 갖고 2년 이상 사셔야 오래 보유한 공제를 받으실 수 있어요 — 보유 ${holdingYears}년 · 거주 ${residencyYears}년 이라 공제 없음`);
  } else {
    steps.push(`오래 갖고 오래 사셔서 빼드려요 (장기보유특별공제) = 보유 ${holdingYears}년 ${(holdingRate * 100).toFixed(0)}%${caps.maxHoldingRate < 0.4 ? ` (${year}년 상한 ${(caps.maxHoldingRate * 100).toFixed(0)}%)` : ''} + 거주 ${residencyYears}년 ${(residencyRate * 100).toFixed(0)}% = ${(deductionRate * 100).toFixed(0)}%`);
  }

  let deductionAmount = taxableGain * deductionRate;
  const amountLimit = ltd.amountLimit?.[year] ?? null;
  if (amountLimit != null && deductionAmount > amountLimit) {
    steps.push(`${year}년부터는 빼드리는 금액에 한도가 있어요 — ${won(deductionAmount)} 대신 ${won(amountLimit)} 까지만`);
    deductionAmount = amountLimit;
  }

  const income = taxableGain - deductionAmount;
  steps.push(`공제 빼고 남은 금액 = ${won(taxableGain)} - ${won(deductionAmount)} = ${won(income)}`);

  /* 10년 이상 거주 + 양도가액 30억원 이하 1세대1주택은 기본공제가 250만 → 2,500만원 */
  const bd = cg.basicDeductionLongResidency;
  const useBigBasic = bd && year >= bd.from && houseCount <= 1
    && residencyYears >= bd.minResidencyYears && salePrice <= bd.maxSalePrice;
  const basicDeduction = useBigBasic ? bd.amount : cg.basicDeduction;
  if (useBigBasic) {
    steps.push(`${bd.minResidencyYears}년 넘게 사셨고 판 값이 ${won(bd.maxSalePrice)} 이하라 기본공제가 늘어요 = ${won(cg.basicDeduction)} → ${won(basicDeduction)}`);
  }

  const perOwnerIncome = income / ownerCount;
  const perOwnerBase = Math.max(0, perOwnerIncome - basicDeduction);
  const { tax: rawPerOwnerTax, bracket } = progressiveTax(perOwnerBase, cg.brackets);
  const perOwnerTax = round(rawPerOwnerTax);
  if (ownerCount > 1) {
    steps.push(`두 분 공동명의라 반씩 나눠요 = ${won(income)} ÷ ${ownerCount}명 = ${won(perOwnerIncome)}`);
  }
  steps.push(`한 분당 세금 매기는 금액 = ${won(perOwnerIncome)} - 기본공제 ${won(basicDeduction)} = ${won(perOwnerBase)}`);
  steps.push(bracket
    ? `한 분이 낼 세금 = ${won(perOwnerBase)} × ${(bracket.rate * 100).toFixed(0)}% - 누진공제 ${won(bracket.progressive)} = ${won(perOwnerTax)}`
    : `공제를 빼고 나니 세금 매길 금액이 남지 않아요 = 0원`);

  let principal = perOwnerTax * ownerCount;
  if (ownerCount > 1) steps.push(`두 분 합쳐서 = ${won(perOwnerTax)} × ${ownerCount}명 = ${won(principal)}`);

  /* 조정대상지역 다주택 중과 — 2027~2028년은 한시 완화된다 */
  const mh = cg.multiHouseSurcharge;
  const surcharge = (isAdjustedArea && houseCount >= 2 && holdingYears >= mh.minHoldingYears)
    ? (mh.byYear[year] ?? mh.byYear[2028])[Math.min(houseCount, 3)] ?? 0
    : 0;
  if (surcharge > 0) {
    const extra = perOwnerBase * surcharge * ownerCount;
    steps.push(`집이 ${houseCount}채라 조정대상지역 중과가 붙어요 = ${won(perOwnerBase)} × ${(surcharge * 100).toFixed(0)}%p × ${ownerCount}명 = ${won(extra)}`);
    principal = principal + extra;
    steps.push(`중과 포함 = ${won(principal)}`);
  }

  if (reductionRate > 0) {
    let discount = principal * reductionRate;
    if (reductionCap && discount > reductionCap) {
      steps.push(`${reductionLabel || '감면'} = ${won(principal)} 의 ${(reductionRate * 100).toFixed(0)}% 는 ${won(discount)} 이지만, 감면 한도가 ${won(reductionCap)} 이에요 = ${won(reductionCap)}`);
      discount = reductionCap;
    } else {
      steps.push(`${reductionLabel || '감면'} = ${won(principal)} 의 ${(reductionRate * 100).toFixed(0)}% 를 빼요 = ${won(discount)}`);
    }
    const reduced = round(principal - discount);
    steps.push(`감면 뒤 세금 = ${won(principal)} - ${won(discount)} = ${won(reduced)}`);
    principal = reduced;
  }

  const localTax = round(principal * cg.localIncomeTaxRate);
  steps.push(`지방소득세 (세금의 ${cg.localIncomeTaxRate * 100}%) = ${won(principal)} × ${cg.localIncomeTaxRate * 100}% = ${won(localTax)}`);
  const total = principal + localTax;
  steps.push(`집 팔 때 내실 세금 전부 = ${won(principal)} + ${won(localTax)} = ${won(total)}`);

  return { total: round(total), principal: round(principal), localTax: round(localTax), income: round(income), deductionRate, taxableRatio, steps };
}

/** 주택 유상취득 취득세 (구간별 단순세율 근사) */
export function acquisitionTax(price) {
  const rate = RULES.acquisition.rates.find((r) => r.upTo === null || price <= r.upTo).rate;
  return { total: round(price * rate), rate, step: `새 집 살 때 내는 세금 (취득세) = ${won(price)} × ${(rate * 100).toFixed(1)}% = ${won(price * rate)}` };
}

/** 매매 중개보수 (부가세 포함) */
export function brokerageFee(price) {
  const { rate, vatRate } = RULES.brokerage;
  const fee = price * rate;
  const total = fee * (1 + vatRate);
  return { total: round(total), step: `부동산 중개수수료 = ${won(price)} × ${(rate * 100).toFixed(1)}% + 부가세 = ${won(total)}` };
}

/** 자녀 증여 시 증여세 + 취득세 */
export function giftTaxTotal({ value, area = 0, isAdjustedArea = false, isSingleHouseToLineal = true }) {
  const g = RULES.giftTax;
  const steps = [];

  const base = Math.max(0, value - g.childDeduction);
  steps.push(`증여세 매기는 금액 = 집값 ${won(value)} - 자녀 공제 ${won(g.childDeduction)} = ${won(base)}`);

  const { tax, bracket } = progressiveTax(base, g.brackets);
  steps.push(`증여세 = ${won(base)} × ${(bracket.rate * 100).toFixed(0)}% - 누진공제 ${won(bracket.progressive)} = ${won(tax)}`);

  const giftTax = tax * (1 - g.filingCredit);
  steps.push(`제때 신고하면 ${g.filingCredit * 100}% 깎아드려요 = ${won(giftTax)}`);

  // 조정대상지역 중과는 1세대1주택자가 직계존비속에게 증여하는 경우 제외된다.
  const heavy = isAdjustedArea && !isSingleHouseToLineal;
  const acqRate = heavy ? g.heavyAcquisitionTaxRate : g.acquisitionTaxRate;
  const farmTax = area > 85 ? (heavy ? g.farmTaxHeavy : g.farmTaxNormal) : 0;
  const totalRate = acqRate + farmTax;
  const acqTotal = value * totalRate;
  steps.push(`자녀가 낼 취득세 = ${won(value)} × ${(totalRate * 100).toFixed(1)}%` +
    `(${heavy ? '조정대상지역이라 더 냄' : '일반 세율'}${area > 85 ? ', 85㎡ 넘어 농특세 포함' : ', 85㎡ 이하라 농특세 없음'}) = ${won(acqTotal)}`);

  const cashNeeded = giftTax + acqTotal;
  steps.push(`자녀가 바로 마련해야 할 현금 = 증여세 ${won(giftTax)} + 취득세 ${won(acqTotal)} = ${won(cashNeeded)}`);

  return { giftTax: round(giftTax), acquisitionTax: round(acqTotal), cashNeeded: round(cashNeeded), steps };
}

/**
 * 주택연금 가입 자격 판정 + 월지급금.
 * 자격은 공시가격으로, 금액은 시세(12억 상한)로 판정한다 — 공사 규정이 두 기준을 다르게 쓴다.
 * 공사 표는 5세 단위로만 공개되고 연령별 증가폭이 비단조여서 보간하지 않는다.
 */
export function housingPension({ officialPrice, marketPrice, youngerAge, olderAge = youngerAge }) {
  const hp = RULES.housingPension;
  const table = hp.monthlyTable;
  const { minAge, maxOfficialPrice } = hp.eligibility;

  const ages = Object.keys(table.byAge).map(Number).sort((a, b) => a - b);
  /** 표에 없는 연령은 인접 하위 연령을 쓴다. 실제보다 적게 제시되므로 과다 약속을 막는다. */
  const resolveAge = (age) => {
    if (table.byAge[age]) return { age, approximate: false };
    const lower = [...ages].reverse().find((a) => a < age);
    return { age: lower ?? ages[0], approximate: true };
  };

  /** 시세로 월지급금을 구한다. 표에 있는 억 단위면 표 값, 아니면 정비례 구간 안에서만 계수 적용. */
  const payout = (age, priceWon) => {
    const eok = priceWon / 1e8;
    const row = table.byAge[age];
    const index = table.pricesEok.indexOf(Math.round(eok));
    if (index >= 0 && Math.abs(eok - Math.round(eok)) < 1e-9) {
      return { amount: row[index], method: '주택금융공사 표에서 찾은 금액' };
    }
    const coef = table.perHundredMillion[age];
    if (eok <= coef.linearMaxEok) {
      return {
        amount: Math.floor((coef.rate * eok) / 1000) * 1000,
        method: `1억원당 ${coef.rate.toLocaleString('ko-KR')}원씩 × ${eok.toFixed(2)}억`,
      };
    }
    return { amount: row[row.length - 1], method: `${coef.linearMaxEok}억원을 넘으면 더 늘지 않아 상한 금액 적용` };
  };

  if (olderAge < minAge) {
    return { eligible: false, reason: `아직 가입하실 나이가 아니에요 (부부 중 연장자 ${olderAge}세, 기준 ${minAge}세)`, basis: table._source, steps: [`가입 나이 = 부부 중 연장자 ${olderAge}세 < 기준 ${minAge}세`] };
  }
  if (youngerAge < ages[0]) {
    return {
      eligible: true,
      monthly: null,
      needsOfficialQuote: true,
      reason: `가입 연령 요건은 충족하지만 연소자 ${youngerAge}세의 공개 지급표가 없어 공식 조회가 필요해요`,
      steps: [
        `가입 나이 = 부부 중 연장자 ${olderAge}세 ≥ 기준 ${minAge}세`,
        `월지급금은 연소자 ${youngerAge}세 기준 공식 조회가 필요해요`,
      ],
      basis: table._source,
    };
  }

  const priced = Math.min(marketPrice ?? officialPrice, maxOfficialPrice);
  const { age: tableAge, approximate } = resolveAge(youngerAge);

  if (officialPrice > maxOfficialPrice) {
    const later = payout(tableAge, maxOfficialPrice);
    return {
      eligible: false,
      reason: `공시가격이 ${won(officialPrice)}이라 가입 기준 ${won(maxOfficialPrice)}을 넘어요`,
      monthlyIfEligibleLater: later.amount,
      laterCondition: `${won(maxOfficialPrice)} 이하 집으로 옮기신 뒤, 두 분 중 젊은 분 ${youngerAge}세 기준`,
      approximate,
      steps: [
        `지금 집으로는 가입이 어려워요 = 공시가격 ${won(officialPrice)} > 기준 ${won(maxOfficialPrice)}`,
        `${won(maxOfficialPrice)} 이하 집으로 옮기시면 = ${tableAge}세 기준 ${later.method} = 매달 ${won(later.amount)}`,
        ...(approximate ? [`${youngerAge}세 표가 공개돼 있지 않아 ${tableAge}세 기준으로 낮춰 잡은 예상치예요`] : []),
      ],
      basis: table._source,
    };
  }

  const result = payout(tableAge, priced);
  return {
    eligible: true,
    monthly: result.amount,
    approximate,
    steps: [
      `주택연금에 가입하실 수 있어요 = 공시가격 ${won(officialPrice)} ≤ ${won(maxOfficialPrice)}, 부부 중 연장자 ${olderAge}세 ≥ ${minAge}세`,
      `매달 받으실 돈 = 시세 ${won(priced)} · ${tableAge}세 · ${result.method} = ${won(result.amount)}`,
      ...(approximate ? [`${youngerAge}세 표가 공개돼 있지 않아 ${tableAge}세 기준으로 낮춰 잡은 예상치예요`] : []),
    ],
    basis: `집에 계속 사시면서 매달 연금을 받는 나라 제도예요. ${table.asOf} 기준 ${table.scheme} — 한국주택금융공사`,
  };
}

/** 목돈 → 월 인출액 (정액 인출) */
export function drawdownMonthly(principal, years) {
  return { monthly: round(principal / years / 12), step: `모아둔 돈에서 매달 꺼내 쓰기 = ${won(principal)} ÷ ${years}년 ÷ 12개월 = ${won(principal / years / 12)}` };
}

export { RULES };
