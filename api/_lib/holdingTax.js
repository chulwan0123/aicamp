/**
 * 보유세(재산세 + 종합부동산세) 근사 계산.
 *
 * 정확한 세액은 세부담상한(전년도 고지세액 필요), 공동명의 1주택 특례 신청 여부,
 * 지자체 탄력세율 등 사용자가 추가로 알려줘야 하는 정보에 좌우된다.
 * 그래서 기본값은 표준 규칙으로 **근사값**을 내고, 정확도를 높이는 데 필요한 입력을
 * REFINE_FIELDS 로 화면에 노출한다. 화면에서 답을 받으면 refinements 로 되돌아와
 * 여기서 다시 계산된다 — 답한 항목만 반영하고 나머지는 기본 가정을 유지한다.
 */
import { RULES_2026 as RULES } from './rules.js';
import { fmtKRW } from '../../js/format.js';
import { REFINE_FIELDS, REFINE_FIELD_BY_NAME, usableRefinements } from '../../js/refine-fields.js';

/** 정확한 계산에 필요한 추가 입력 — 화면에서 사용자에게 요청한다. */
export { REFINE_FIELDS };

const round = (n) => {
  if (typeof n !== 'number' || Number.isNaN(n)) throw new TypeError(`계산 결과가 숫자가 아닙니다: ${n}`);
  return Math.round(n);
};
const won = (n) => fmtKRW(round(n), { exact: true });
const pct = (n, digits = 0) => `${(n * 100).toFixed(digits)}%`;

function progressive(base, brackets) {
  if (base <= 0) return { tax: 0, bracket: brackets[0] };
  const bracket = brackets.find((b) => b.upTo === null || base <= b.upTo);
  return { tax: Math.max(0, base * bracket.rate - bracket.progressive), bracket };
}

/** 공시가격 구간에 따른 1세대1주택 공정시장가액비율 */
function singleHouseRatio(officialPrice, table) {
  return table.find((row) => row.upTo === null || officialPrice <= row.upTo).rate;
}

/**
 * 재산세 — 공시가격에서 과세표준을 구하고, 과표상한을 적용한 뒤 세율을 매긴다.
 * 도시지역분과 지방교육세를 더한 값이 한 해 재산세다.
 */
function propertyTax({
  officialPrice, previousOfficialPrice, isSingleHouse, region, year,
  isUrbanArea = true, localTaxAdjustment = 0,
}) {
  const pt = RULES.holdingTax.propertyTax;
  const steps = [];
  const notes = [];

  const usesSpecialRatio = isSingleHouse && pt.fairMarketRatio.singleHouseValidYears.includes(year);
  const ratio = usesSpecialRatio
    ? singleHouseRatio(officialPrice, pt.fairMarketRatio.singleHouse)
    : pt.fairMarketRatio.general;
  if (isSingleHouse && !usesSpecialRatio) {
    notes.push(`${year}년은 1세대1주택 특례비율 연장 여부가 정해지지 않아 일반 비율 ${pt.fairMarketRatio.general * 100}% 로 계산했어요`);
  }

  let base = officialPrice * ratio;
  steps.push(`재산세 매기는 기준 금액 = 공시가격 ${won(officialPrice)} 의 ${(ratio * 100).toFixed(0)}%${usesSpecialRatio ? ' (집 한 채만 가진 분 특례)' : ''} = ${won(base)}`);

  // 과세표준 상한 — 직전연도 공시가격이 있어야 계산된다.
  let priorPrice = previousOfficialPrice;
  let priorEstimated = false;
  if (!(priorPrice > 0)) {
    const rates = pt.priceChangeRate[RULES.holdingTax.years[0]] || {};
    const rate = rates[region] ?? rates['서울'] ?? rates['전국'];
    if (rate != null) {
      priorPrice = officialPrice / (1 + rate);
      priorEstimated = true;
      steps.push(`작년 공시가격 (추정) = ${won(officialPrice)} ÷ (1 + 올해 오른 비율 ${(rate * 100).toFixed(2)}%) = ${won(priorPrice)}`);
      notes.push('작년 공시가격을 지역 평균 상승률로 어림잡았어요. 실제 금액을 알려주시면 더 정확해져요');
    }
  }

  if (priorPrice > 0) {
    const cap = priorPrice * ratio + officialPrice * ratio * pt.baseCap.growthRate;
    steps.push(`세금이 갑자기 오르지 않게 막는 상한 = 작년 기준 ${won(priorPrice * ratio)} + 올해 기준의 ${pt.baseCap.growthRate * 100}% ${won(officialPrice * ratio * pt.baseCap.growthRate)} = ${won(cap)}`);
    if (cap < base) {
      steps.push(`상한에 걸려 낮춰 잡아요 = ${won(base)} 대신 ${won(cap)}`);
      base = cap;
    }
  }

  const useSingleBrackets = isSingleHouse && officialPrice <= pt.singleHouseBracketLimit;
  const brackets = useSingleBrackets ? pt.singleHouseBrackets : pt.brackets;
  const { tax: standardTax, bracket } = progressive(base, brackets);
  steps.push(`재산세 = ${won(base)} × ${(bracket.rate * 100).toFixed(2)}%${useSingleBrackets ? ' (9억원 이하 한 채 특례세율)' : ''} - 누진공제 ${won(bracket.progressive)} = ${won(standardTax)}`);

  /* 지자체 탄력세율 — 알려주셨을 때만 반영한다 */
  const adjust = 1 + (localTaxAdjustment / 100);
  const tax = standardTax * adjust;
  if (localTaxAdjustment) {
    steps.push(`사시는 지자체가 세율을 ${localTaxAdjustment > 0 ? '올려' : '깎아'} 주셔서 = ${won(standardTax)} × ${(adjust * 100).toFixed(0)}% = ${won(tax)}`);
  }

  const urban = isUrbanArea ? base * pt.urbanAreaRate * adjust : 0;
  steps.push(isUrbanArea
    ? `도시에 사셔서 더 내는 몫 = ${won(base)} × ${(pt.urbanAreaRate * 100).toFixed(2)}% = ${won(urban)}`
    : '도시지역이 아니라고 알려주셔서, 도시지역분은 빼고 계산했어요');

  const eduTax = tax * pt.localEducationTaxRate;
  steps.push(`지방교육세 (재산세의 ${pt.localEducationTaxRate * 100}%) = ${won(tax)} × ${pt.localEducationTaxRate * 100}% = ${won(eduTax)}`);

  const total = tax + urban + eduTax;
  steps.push(`한 해 재산세 = ${won(tax)} + ${won(urban)} + ${won(eduTax)} = ${won(total)}`);

  return {
    total: round(total), principal: round(tax), urban: round(urban), eduTax: round(eduTax),
    base, ratio, priorEstimated, steps, notes,
  };
}

/**
 * 종합부동산세 — 부부 공동명의 1주택은 두 방식 중 유리한 쪽을 고른다.
 *  (a) 지분별 과세: 각자 9억원씩 공제, 고령자·장기보유 세액공제 없음
 *  (b) 공동명의 1주택자 특례: 12억원 공제 + 고령자·장기보유 세액공제
 * 사용자가 실제 신청 내용(jointSpecialFiled)을 알려주면 그쪽으로 고정한다.
 * 2주택 이상이면 1세대1주택 공제·세액공제가 모두 빠진다.
 */
function comprehensiveTax({
  officialPrice, ownerCount, olderAge, holdingYears, year,
  shares, houseCount = 1, jointSpecialFiled = null,
  isResiding = true, residencyYears = null, propertyTaxResult = null,
  residentOfficialPrice = null, hasAdjustedAreaHome = false,
}) {
  const jt = RULES.holdingTax.comprehensiveTax;
  const isSingleHouse = houseCount <= 1;
  /* 2028년부터 일부 다주택·조정대상지역 주택은 공정시장가액비율이 80% */
  const usesAdjustedRatio = !isSingleHouse && (houseCount >= 3 || hasAdjustedAreaHome);
  const ratio = (usesAdjustedRatio && jt.fairMarketRatioAdjusted?.[year])
    || jt.fairMarketRatio[year] || jt.fairMarketRatio.default;
  const lived = residencyYears ?? holdingYears;
  const yearBrackets = jt.bracketsByYear?.[year];
  const brackets = yearBrackets
    ? (houseCount >= 3 ? (yearBrackets.threeOrMore || yearBrackets.general) : yearBrackets.general)
    : jt.brackets;
  const residentShare = Math.max(0, Math.min(1,
    (residentOfficialPrice ?? (isResiding ? officialPrice : 0)) / officialPrice));
  const multiHouseDeduction = year >= 2027
    ? 400_000_000 + 500_000_000 * residentShare
    : jt.basicDeduction.general;
  const ownerShares = shares?.length === ownerCount
    ? shares
    : Array.from({ length: ownerCount }, () => 1 / ownerCount);

  /**
   * 세액공제 — 연령 공제는 그대로 두고, 기간 공제가 보유 → 거주로 옮겨간다.
   *  ~2026년 : 보유기간 공제
   *   2027년 : 축소된 보유기간 공제와 새 거주기간 공제 중 높은 쪽
   *  2028년~ : 거주기간 공제만
   */
  const creditRate = (() => {
    if (!isSingleHouse) return { senior: 0, holding: 0, residency: 0, period: 0, basis: '', total: 0 };
    const senior = [...jt.seniorCredit].reverse().find((c) => olderAge >= c.age)?.rate ?? 0;
    const rawHolding = [...jt.longTermCredit].reverse().find((c) => holdingYears >= c.years)?.rate ?? 0;
    const byHolding = year < jt.residencyOnlyFrom
      ? rawHolding * (year === 2027 ? jt.longTermCredit2027Multiplier : 1)
      : 0;
    const byResidency = year >= jt.residencyCreditFrom
      ? ([...jt.residencyCredit].reverse().find((c) => lived >= c.years)?.rate ?? 0)
      : 0;
    const period = Math.max(byHolding, byResidency);
    const basis = year >= jt.residencyOnlyFrom ? '거주기간'
      : (period === byResidency && byResidency > byHolding ? '거주기간' : '보유기간');
    return {
      senior, holding: byHolding, residency: byResidency, period, basis,
      total: Math.min(senior + period, jt.maxCreditRate),
    };
  })();
  /* 2027년부터는 깎아주는 금액 자체에도 한도가 생긴다 */
  const creditLimit = jt.creditAmountLimit?.[year] ?? null;

  /**
   * 종부세에 대응하는 재산세 중복분 공제.
   * A(실제 재산세 본세) × B(종부세 과표 상당 재산세) ÷ C(재산세 과표 상당 재산세)
   * 도시지역분과 지방교육세는 A에서 제외한다.
   */
  const propertyBrackets = RULES.holdingTax.propertyTax.brackets;
  const propertyRatio = propertyTaxResult?.ratio ?? RULES.holdingTax.propertyTax.fairMarketRatio.general;
  const duplicateDeduction = ({ jongbuBase, share = 1 }) => {
    if (!propertyTaxResult || jongbuBase <= 0) return 0;
    const actualPrincipal = propertyTaxResult.principal * share;
    const corresponding = progressive(jongbuBase * propertyRatio, propertyBrackets).tax;
    const recalculated = progressive(propertyTaxResult.base * share, propertyBrackets).tax;
    if (!(recalculated > 0)) return 0;
    return Math.min(actualPrincipal * corresponding / recalculated, corresponding);
  };

  /** (a) 지분별 과세 — 세액공제 없음 */
  const perOwner = ownerShares.map((share) => {
    const individualDeduction = isSingleHouse ? jt.basicDeduction.general : multiHouseDeduction;
    const base = Math.max(0, (officialPrice * share - individualDeduction) * ratio);
    const gross = progressive(base, brackets).tax;
    const propertyCredit = duplicateDeduction({ jongbuBase: base, share });
    return { share, base, gross, propertyCredit, tax: Math.max(0, gross - propertyCredit) };
  });
  const totalA = perOwner.reduce((sum, o) => sum + o.tax, 0) * (1 + jt.farmTaxRate);

  /** (b) 공동명의 1주택자 특례 — 12억 공제 + 세액공제. 2주택 이상은 쓸 수 없다 */
  /* 2027년부터 1주택 기본공제가 거주 14억 / 비거주 9억 으로 갈린다 */
  const singleTable = isResiding ? jt.basicDeduction.singleHouse : jt.basicDeduction.nonResident;
  const singleDeduction = singleTable[year] ?? singleTable.default;
  const deductionB = isSingleHouse ? singleDeduction : multiHouseDeduction;
  const baseB = Math.max(0, (officialPrice - deductionB) * ratio);
  const { tax: taxB1 } = progressive(baseB, brackets);
  const propertyCreditB = duplicateDeduction({ jongbuBase: baseB });
  const afterPropertyCredit = Math.max(0, taxB1 - propertyCreditB);
  const rawCredit = afterPropertyCredit * creditRate.total;
  const appliedCredit = creditLimit != null ? Math.min(rawCredit, creditLimit) : rawCredit;
  const creditCapped = creditLimit != null && rawCredit > creditLimit;
  const afterCredit = afterPropertyCredit - appliedCredit;
  const totalB = afterCredit * (1 + jt.farmTaxRate);

  /* 어느 방법으로 낼지 — 알려주신 게 있으면 그대로, 없으면 더 적게 내는 쪽 */
  let method;
  if (ownerCount === 1) method = 'SINGLE_OWNER';
  else if (!isSingleHouse) method = 'PER_SHARE';
  else if (jointSpecialFiled === 'JOINT_SPECIAL') method = 'JOINT_SPECIAL';
  else if (jointSpecialFiled === 'PER_SHARE') method = 'PER_SHARE';
  else method = totalB < totalA ? 'JOINT_SPECIAL' : 'PER_SHARE';

  const useSpecial = method === 'JOINT_SPECIAL';
  const chosen = method === 'PER_SHARE' ? totalA : totalB;

  const steps = [];
  if (isSingleHouse && !isResiding && singleDeduction < (jt.basicDeduction.singleHouse[year] ?? jt.basicDeduction.singleHouse.default)) {
    steps.push(`${year}년부터는 살지 않는 집의 공제가 줄어요 — 공제 ${won(singleDeduction)} 적용 (사시는 경우 ${won(jt.basicDeduction.singleHouse[year] ?? jt.basicDeduction.singleHouse.default)})`);
  }
  if (!isSingleHouse) {
    steps.push(`집이 ${houseCount}채라 1주택 공제와 연세·거주 공제는 빼요. ${year}년 기본공제는 거주주택 비중을 반영해 ${won(multiHouseDeduction)}으로 계산했어요`);
    if (year >= 2028) {
      steps.push(usesAdjustedRatio
        ? `3주택 이상이거나 조정대상지역 주택을 보유해 공정시장가액비율 ${pct(ratio)}를 적용했어요`
        : `2주택 이하이고 조정대상지역 주택 보유로 확인되지 않아 공정시장가액비율 ${pct(ratio)}를 적용했어요`);
    }
  }
  if (ownerCount > 1) {
    const shareText = ownerShares.map((s) => pct(s)).join(' : ');
    steps.push(`방법 1. 두 분이 따로 내기 (지분 ${shareText}) — ${perOwner.map((o) =>
      `기준 금액 (${won(officialPrice * o.share)} - 공제 ${won(isSingleHouse ? jt.basicDeduction.general : multiHouseDeduction)}) × ${pct(ratio)} = ${won(o.base)}`).join(' / ')}`);
    steps.push(`  재산세와 겹치는 금액을 빼요 = ${perOwner.map((o) => won(o.propertyCredit)).join(' + ')}`);
    steps.push(`  방법 1로 내면 = ${perOwner.map((o) => won(o.tax)).join(' + ')} + 농특세 ${pct(jt.farmTaxRate)} = ${won(totalA)}`);
    if (isSingleHouse) {
      steps.push(`방법 2. 부부 특례로 함께 내기 — 기준 금액 = (공시가격 ${won(officialPrice)} - 공제 ${won(deductionB)}) × ${pct(ratio)} = ${won(baseB)}`);
      steps.push(`  재산세와 겹치는 금액을 먼저 빼요 = ${won(taxB1)} - ${won(propertyCreditB)} = ${won(afterPropertyCredit)}`);
      steps.push(`  연세와 오래 사신 걸로 깎아드려요 = ${won(afterPropertyCredit)} 에서 ${pct(creditRate.total)} 빼기 (연세 ${pct(creditRate.senior)} + ${creditRate.basis} ${pct(creditRate.period)}) = ${won(rawCredit)}`);
      if (creditCapped) {
        steps.push(`  ${year}년부터 깎아주는 금액에 한도가 있어요 — ${won(rawCredit)} 대신 ${won(creditLimit)} 까지만 = ${won(afterCredit)}`);
      }
      steps.push(`  방법 2로 내면 = ${won(afterCredit)} + 농특세 ${pct(jt.farmTaxRate)} = ${won(totalB)}`);
      steps.push(jointSpecialFiled
        ? `실제로 ${useSpecial ? '특례를 신청하셨다고' : '각자 따로 내신다고'} 알려주셔서 그대로 = ${won(chosen)}`
        : `더 적게 내는 쪽으로 = ${useSpecial ? '방법 2 (부부 특례)' : '방법 1 (따로 내기)'} = ${won(chosen)}`);
    } else {
      steps.push(`2주택 이상이라 부부 특례는 쓸 수 없어요 = ${won(chosen)}`);
    }
  } else {
    steps.push(`종합부동산세 매기는 기준 금액 = (공시가격 ${won(officialPrice)} - 공제 ${won(deductionB)}) × ${pct(ratio)} = ${won(baseB)}`);
    steps.push(`재산세와 겹치는 금액을 먼저 빼요 = ${won(taxB1)} - ${won(propertyCreditB)} = ${won(afterPropertyCredit)}`);
    steps.push(`종합부동산세 = ${won(afterPropertyCredit)} 에서 ${creditCapped ? `한도까지 ${won(appliedCredit)}` : `${pct(creditRate.total)} 인 ${won(appliedCredit)}`} 빼고 농특세 더하기 = ${won(totalB)}`);
  }

  return { total: round(chosen), useSpecial, method, creditRate, creditLimit, appliedCredit: round(appliedCredit), propertyCredit: round(useSpecial ? propertyCreditB : perOwner.reduce((sum, owner) => sum + owner.propertyCredit, 0)), creditCapped, deduction: singleDeduction, ratio, steps };
}

/**
 * 답해 주신 항목만큼 오차 범위를 좁힌다.
 * 정확한 신뢰구간이 아니라, 무엇을 알려주면 얼마나 또렷해지는지 보여주는 지표다.
 */
const IMPACT_WEIGHT = { HIGH: 3, MEDIUM: 2, LOW: 1 };
const MIN_TOLERANCE = 0.03;

const weightOf = (key) => IMPACT_WEIGHT[REFINE_FIELD_BY_NAME[key]?.impact] ?? 0;
const TOTAL_WEIGHT = REFINE_FIELDS.reduce((sum, f) => sum + (IMPACT_WEIGHT[f.impact] ?? 0), 0);

function accuracyWith(answered) {
  const base = RULES.holdingTax.accuracy;
  const progress = TOTAL_WEIGHT ? answered.reduce((sum, key) => sum + weightOf(key), 0) / TOTAL_WEIGHT : 0;
  const tolerance = Number((base.tolerance - (base.tolerance - MIN_TOLERANCE) * progress).toFixed(3));
  return {
    ...base,
    tolerance,
    answeredCount: answered.length,
    totalCount: REFINE_FIELDS.length,
    note: answered.length
      ? `${answered.length}가지를 알려주셔서 ±${Math.round(tolerance * 100)}% 범위까지 좁혔어요`
      : base.note,
  };
}

/**
 * 연도별 보유세를 계산한다.
 * @param refinements 화면에서 되물어 받은 추가 입력. 답하지 않은 항목은 기본 가정을 쓴다.
 * @returns 각 연도의 { year, propertyTax, jongbuTax, total, steps, estimated }
 */
export function holdingTaxByYear({
  officialPrice, ownerCount = 1, olderAge = 65, holdingYears = 0, isResiding = true,
  residencyYears = null, region, previousOfficialPrice, refinements = {},
}) {
  const given = usableRefinements(refinements);
  const answered = Object.keys(given);

  /* 지분 — 100 은 단독명의를 뜻하므로 소유자 수 자체가 바뀐다 */
  let owners = ownerCount;
  let shares;
  if (given.ownershipRatio === 100) owners = 1;
  else if (given.ownershipRatio && owners > 1) {
    const major = given.ownershipRatio / 100;
    shares = [major, 1 - major];
  }
  if (given.jointSpecialFiled === 'SINGLE') owners = 1;

  const houseCount = given.householdHouseCount ?? 1;
  /* 실거주 여부 — 인정 사유로 떨어져 있는 경우도 거주로 본다 */
  const residing = given.isResidingHome === undefined
    ? isResiding
    : (given.isResidingHome === true || given.isResidingHome === 'EXCEPTION');
  const growth = (given.officialPriceForecast ?? 0) / 100;
  const years = RULES.holdingTax.years;
  const baseYear = years[0];

  const accuracy = accuracyWith(answered);
  let previous = given.previousYearTax ? Number(given.previousYearTax) : null;
  /* 과세표준 상한에 쓸 직전연도 공시가격 — 첫 해는 알려주신 값, 이후는 앞 해에서 이어받는다 */
  let priorPrice = given.previousOfficialPrice ? Number(given.previousOfficialPrice) : previousOfficialPrice;
  const notes = [];

  return years.map((year) => {
    const priceThisYear = officialPrice * Math.pow(1 + growth, year - baseYear);
    const pt = propertyTax({
      officialPrice: priceThisYear,
      previousOfficialPrice: priorPrice,
      isSingleHouse: houseCount <= 1,
      region,
      year,
      isUrbanArea: given.isUrbanArea ?? true,
      localTaxAdjustment: given.localTaxAdjustment ?? 0,
    });
    priorPrice = priceThisYear;
    const jt = comprehensiveTax({
      officialPrice: priceThisYear, ownerCount: owners, olderAge, holdingYears, year,
      shares, houseCount, jointSpecialFiled: given.jointSpecialFiled ?? null,
      isResiding: residing, residencyYears, propertyTaxResult: pt,
      hasAdjustedAreaHome: given.hasAdjustedAreaHome === true,
    });

    const steps = [...pt.steps, ...jt.steps];
    (pt.notes || []).forEach((n) => { if (!notes.includes(n)) notes.push(n); });
    if (growth && year !== baseYear) {
      steps.unshift(`공시가격이 해마다 ${given.officialPriceForecast}% 씩 바뀐다고 보고 ${year}년 공시가격을 ${won(priceThisYear)} 으로 잡았어요`);
    }

    let total = pt.total + jt.total;
    steps.push(`${year}년에 내실 세금 = 재산세 ${won(pt.total)} + 종합부동산세 ${won(jt.total)} = ${won(total)}`);

    /* 세부담상한 — 작년 낸 세금을 알려주셨을 때만 적용한다 */
    const capTable = RULES.holdingTax.burdenCapRate;
    const cap = capTable[year] ?? capTable.default;
    if (previous > 0) {
      const ceiling = previous * cap;
      if (total > ceiling) {
        steps.push(`작년보다 갑자기 오르지 않게 막아주는 제도 — ${won(previous)} 의 ${pct(cap)} 인 ${won(ceiling)} 까지만 내시면 돼요`);
        total = ceiling;
      } else {
        steps.push(`작년(${won(previous)})의 ${pct(cap)} 안쪽이라 상한에 걸리지 않아요`);
      }
      previous = total;
    }

    return {
      year,
      propertyTax: pt.total,
      jongbuTax: jt.total,
      total: round(total),
      useSpecial: jt.useSpecial,
      creditBasis: jt.creditRate?.basis,
      creditCapped: jt.creditCapped,
      jongbuDeduction: jt.deduction,
      estimated: true,
      accuracy,
      officialPrice: round(priceThisYear),
      priorEstimated: pt.priorEstimated,
      notes: [...notes],
      steps,
      note: RULES.holdingTax.yearNotes?.[year],
      basis: RULES.holdingTax._source,
    };
  });
}

/**
 * 여러 주택의 재산세는 호별로, 종부세는 공시가격을 합산해 계산한다.
 * 주택별 공시가격을 첫 번째 주택 하나로 축약하지 않기 위한 포트폴리오 계산 경로다.
 */
export function holdingTaxPortfolioByYear({
  properties, ownerCount = 1, olderAge = 65, holdingYears = 0, isResiding = true,
  residencyYears = null, refinements = {},
}) {
  if (!Array.isArray(properties) || properties.length === 0) throw new TypeError('주택 목록이 필요합니다.');
  if (properties.length === 1) {
    const [property] = properties;
    return holdingTaxByYear({
      officialPrice: property.officialPrice, ownerCount, olderAge, holdingYears,
      isResiding, residencyYears, region: property.region,
      previousOfficialPrice: property.previousOfficialPrice, refinements,
    });
  }

  const given = usableRefinements(refinements);
  const answered = Object.keys(given);
  const years = RULES.holdingTax.years;
  const growth = (given.officialPriceForecast ?? 0) / 100;
  const accuracy = accuracyWith(answered);
  const houseCount = properties.length;
  let previousTax = given.previousYearTax ? Number(given.previousYearTax) : null;
  let priorPrices = properties.map((property) =>
    Number(given.previousOfficialPrice) > 0 && properties.length === 1
      ? Number(given.previousOfficialPrice)
      : property.previousOfficialPrice);

  return years.map((year) => {
    const currentPrices = properties.map((property) =>
      property.officialPrice * Math.pow(1 + growth, year - years[0]));
    const propertyResults = properties.map((property, index) => propertyTax({
      officialPrice: currentPrices[index],
      previousOfficialPrice: priorPrices[index],
      isSingleHouse: false,
      region: property.region,
      year,
      isUrbanArea: given.isUrbanArea ?? true,
      localTaxAdjustment: given.localTaxAdjustment ?? 0,
    }));
    priorPrices = currentPrices;

    const aggregatePropertyTax = propertyResults.reduce((sum, result) => ({
      total: sum.total + result.total,
      principal: sum.principal + result.principal,
      urban: sum.urban + result.urban,
      eduTax: sum.eduTax + result.eduTax,
      base: sum.base + result.base,
      ratio: RULES.holdingTax.propertyTax.fairMarketRatio.general,
    }), { total: 0, principal: 0, urban: 0, eduTax: 0, base: 0, ratio: RULES.holdingTax.propertyTax.fairMarketRatio.general });
    const totalOfficialPrice = currentPrices.reduce((sum, price) => sum + price, 0);
    const jt = comprehensiveTax({
      officialPrice: totalOfficialPrice,
      ownerCount,
      olderAge,
      holdingYears,
      year,
      houseCount,
      jointSpecialFiled: given.jointSpecialFiled ?? null,
      isResiding,
      residencyYears,
      propertyTaxResult: aggregatePropertyTax,
      residentOfficialPrice: properties.reduce((sum, property, index) =>
        sum + (property.isResiding === true ? currentPrices[index] : 0), 0) || (isResiding ? currentPrices[0] : 0),
      hasAdjustedAreaHome: given.hasAdjustedAreaHome === true
        || properties.some((property) => property.isAdjustedArea === true),
    });

    const steps = [
      `주택 ${houseCount}채의 공시가격을 모두 더해요 = ${properties.map((property, index) => `${property.complexName || `주택 ${index + 1}`} ${won(currentPrices[index])}`).join(' + ')} = ${won(totalOfficialPrice)}`,
      ...propertyResults.flatMap((result, index) => [
        `주택 ${index + 1} 재산세 계산`,
        ...result.steps.map((step) => `  ${step}`),
      ]),
      `주택별 재산세 합계 = ${propertyResults.map((result) => won(result.total)).join(' + ')} = ${won(aggregatePropertyTax.total)}`,
      ...jt.steps,
    ];
    let total = aggregatePropertyTax.total + jt.total;
    steps.push(`${year}년에 내실 세금 = 재산세 ${won(aggregatePropertyTax.total)} + 종합부동산세 ${won(jt.total)} = ${won(total)}`);

    const cap = RULES.holdingTax.burdenCapRate[year] ?? RULES.holdingTax.burdenCapRate.default;
    if (previousTax > 0) {
      const ceiling = previousTax * cap;
      if (total > ceiling) {
        steps.push(`알려주신 전년도 세액 기준 세부담상한 ${pct(cap)} = ${won(ceiling)}`);
        total = ceiling;
      }
      previousTax = total;
    }

    return {
      year,
      propertyTax: round(aggregatePropertyTax.total),
      propertyTaxByHome: propertyResults.map((result, index) => ({
        index, total: result.total, principal: result.principal,
      })),
      jongbuTax: jt.total,
      total: round(total),
      useSpecial: false,
      creditBasis: jt.creditRate?.basis,
      creditCapped: jt.creditCapped,
      jongbuDeduction: jt.deduction,
      officialPrice: round(totalOfficialPrice),
      estimated: true,
      accuracy,
      priorEstimated: propertyResults.some((result) => result.priorEstimated),
      notes: ['여러 주택의 재산세는 각 주택별로, 종합부동산세는 합산 공시가격으로 계산했어요.'],
      steps,
      note: RULES.holdingTax.yearNotes?.[year],
      basis: RULES.holdingTax._source,
    };
  });
}

export { propertyTax, comprehensiveTax };
