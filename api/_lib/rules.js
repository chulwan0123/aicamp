/**
 * LLM 에 주입할 세법 규칙셋.
 * 정확한 세법 구현이 아니라 데모용 근사 규칙셋이며, 실서비스 적용 전 세무사 검수가 필수다.
 * LLM 은 이 객체의 수치만 사용해야 하고, 자신의 기억 속 세법 지식을 써서는 안 된다.
 */
export const RULES_2026 = {
  _notice: '데모용 근사 규칙셋. 실서비스 적용 전 세무사 검수 필수.',
  _baseYear: 2026,

  capitalGains: {
    _reform2027: '2027년 세제개편안 반영. 장특공제 거주 중심 전환(2028~), 공제 금액한도 신설, 장기거주 1주택 기본공제 확대, 다주택 중과 한시 완화.',
    exemption: {
      condition: '1세대1주택 AND 보유 2년 이상',
      priceLimit: 1_200_000_000,
      note: '12억 초과분에 대해서만 과세. 과세비율 = (양도가액 - 12억) / 양도가액',
    },
    longTermDeduction: {
      note: '1세대1주택 장기보유특별공제(표2) = 보유기간 공제 + 거주기간 공제. 2028년부터 거주 중심으로 단계 전환된다.',
      perYearVerified: false,
      perYearNote: '개편 후 연 공제율은 발표되지 않았다. 현행이 10년에 최대치(연 4% × 10년 = 40%)에 닿는 구조이므로, 바뀐 상한도 10년에 닿도록 연 공제율을 맞췄다. 기재부 원문 확인이 필요하다.',
      // 양도 연도별 공제율 — 보유는 줄고 거주는 커진다. 각 상한은 10년에 도달한다.
      byYear: {
        2026: { holdingPerYear: 0.04, maxHoldingRate: 0.4, residencyPerYear: 0.04, maxResidencyRate: 0.4 },
        2027: { holdingPerYear: 0.04, maxHoldingRate: 0.4, residencyPerYear: 0.04, maxResidencyRate: 0.4 },
        2028: { holdingPerYear: 0.02, maxHoldingRate: 0.2, residencyPerYear: 0.06, maxResidencyRate: 0.6 },
        2029: { holdingPerYear: 0.00, maxHoldingRate: 0.0, residencyPerYear: 0.08, maxResidencyRate: 0.8 },
        default: { holdingPerYear: 0.00, maxHoldingRate: 0.0, residencyPerYear: 0.08, maxResidencyRate: 0.8 },
      },
      maxRate: 0.8,
      minYears: 3,
      minResidencyYears: 2,
      requirementNote: '3년 이상 보유하고 2년 이상 거주한 1세대1주택이 기본요건이다.',
      // 공제 금액 한도 — 개인별 연간 한도와 주택별 한도가 같은 금액으로 신설된다
      amountLimit: { 2028: 2_000_000_000, 2029: 1_000_000_000 },
      amountLimitNote: '장기거주 소득공제의 개인별 연간 한도이자 주택별 한도. 2028년 20억원, 2029년부터 10억원. 2027년까지는 한도가 없다.',
    },
    basicDeduction: 2_500_000,
    // 10년 이상 거주하고 양도가액 30억원 이하인 1세대1주택은 기본공제가 10배로 늘어난다
    basicDeductionLongResidency: {
      amount: 25_000_000,
      minResidencyYears: 10,
      maxSalePrice: 3_000_000_000,
      from: 2027,
      note: '10년 이상 거주 + 양도가액 30억원 이하 1세대1주택. 기본공제 250만원 → 2,500만원.',
    },
    // 다주택자 조정대상지역 중과 — 2027~2028년 한시 완화 (2년 이상 보유한 주택에 한함)
    multiHouseSurcharge: {
      minHoldingYears: 2,
      byYear: {
        2026: { 2: 0.20, 3: 0.30 },
        2027: { 2: 0.05, 3: 0.10 },
        2028: { 2: 0.10, 3: 0.15 },
      },
      note: '기본세율에 더해지는 중과세율(%p). 키 2 는 2주택, 3 은 3주택 이상. 조정대상지역 주택에만 적용된다.',
      _verified: false,
    },
    brackets: [
      { upTo: 14_000_000, rate: 0.06, progressive: 0 },
      { upTo: 50_000_000, rate: 0.15, progressive: 1_260_000 },
      { upTo: 88_000_000, rate: 0.24, progressive: 5_760_000 },
      { upTo: 150_000_000, rate: 0.35, progressive: 15_440_000 },
      { upTo: 300_000_000, rate: 0.38, progressive: 19_940_000 },
      { upTo: 500_000_000, rate: 0.40, progressive: 25_940_000 },
      { upTo: 1_000_000_000, rate: 0.42, progressive: 35_940_000 },
      { upTo: null, rate: 0.45, progressive: 65_940_000 },
    ],
    localIncomeTaxRate: 0.1,
    localIncomeTaxNote: '지방소득세 = 양도소득세 산출세액의 10%',
    jointOwnership: {
      note: '부부 공동명의는 지분별로 따로 계산한다. 양도소득금액을 지분율로 나눈 뒤 각자 기본공제를 적용하고, 각자 누진세율표를 적용한 산출세액을 합산한다.',
      formula: '인별 과세표준 = (양도소득금액 × 지분율) - 기본공제 → 인별 산출세액 → 전원 합산 → 지방소득세 10% 가산',
    },
  },

  acquisition: {
    note: '취득가액 구간별 세율 적용 (주택 유상취득)',
    rates: [
      { upTo: 600_000_000, rate: 0.011 },
      { upTo: 900_000_000, rate: 0.022 },
      { upTo: null, rate: 0.033 },
    ],
  },

  brokerage: { rate: 0.005, vatRate: 0.1, note: '매매 중개보수 상한 근사, 부가세 별도' },

  holdingTax: {
    note: '재산세와 종합부동산세를 계산해요. 재산세는 법령 기준으로 정확히 계산하고, 종합부동산세는 아직 어림잡은 값이에요.',
    _verified: 'PARTIAL',
    _verifyNote: '재산세는 법령 원문·국세청 자료·서울시ETAX 실측으로 검증 완료. 종합부동산세의 재산세 중복공제 산식은 검증 진행 중.',
    accuracy: { level: 'APPROX', tolerance: 0.15, note: '재산세는 법령 기준으로 계산했고, 종합부동산세와 직전연도 공시가격은 추정이 섞여 있어요.' },
    burdenCapRate: { 2026: 1.5, 2027: 2.0, 2028: 2.0, default: 1.5 },
    burdenCapNote: '세부담상한. 전년도 고지세액을 알려준 경우에만 적용한다. 2027년부터 150% → 200% 로 상향된다(2027 개편안). 실제로는 재산세와 종합부동산세가 나뉘지만 데모에서는 합산 기준으로 근사한다.',
    years: [2026, 2027, 2028],
    yearNotes: {
      2027: '2027 세제개편안(공정시장가액비율 70%, 거주 1주택 기본공제 14억) 반영 — 입법 미확정',
      2028: '2027 개편 완료 기준 유지 가정',
    },

    propertyTax: {
      _verified: true,
      _verifyNote: '지방세법 원문 + 국세청 2026년 종합부동산세 요약표 + 서울시ETAX 재산세 계산기 실측(9회) 3중 확인.',

      // 1세대1주택은 공정시장가액비율을 낮춰주는 한시 특례가 있다.
      // 매년 시행령 개정으로 연장되므로 적용 연도를 반드시 확인해야 한다.
      fairMarketRatio: {
        general: 0.6,
        singleHouse: [
          { upTo: 300_000_000, rate: 0.43 },
          { upTo: 600_000_000, rate: 0.44 },
          { upTo: null, rate: 0.45 },
        ],
        singleHouseValidYears: [2026],
        singleHouseNote: '1세대1주택 특례비율. 지방세법 시행령 제109조제1항제2호 단서의 한시 규정으로, 매년 5월경 시행령 개정으로 연장 여부가 정해진다. 2027년 이후는 자동 연장이 아니다.',
        _source: '지방세법 시행령 제109조 (대통령령 제36364호, 2026.5.29 개정으로 2026년도분 적용)',
      },

      // 과세표준 상한 — 전년도 고지세액이 아니라 전년도 공시가격이 있으면 계산된다.
      baseCap: {
        formula: '과표상한액 = 직전연도 공시가격 × 공정시장가액비율 + 당해연도 공시가격 × 공정시장가액비율 × 5%',
        growthRate: 0.05,
        note: '과세표준이 이 금액을 넘으면 상한액으로 낮춰 과세한다.',
        _source: '지방세법 제110조제3항 (주택 과세표준 상한)',
      },

      // 공시가격 변동률 — 직전연도 공시가격을 모를 때 역산에 쓴다.
      priceChangeRate: {
        2026: { 전국: 0.1093, 서울: 0.186, '서울 서초구': 0.2207 },
        note: '직전연도 공시가격 = 당해 공시가격 ÷ (1 + 변동률). 단지·동·층별 편차는 지역 평균에 흡수되므로 추정치다.',
        _source: '국토교통부 2026년 공동주택 공시가격 결정·공시 보도자료 (2026.4.30) 및 열람안 (2026.3)',
      },

      // 공시가격 9억원 이하 1세대1주택은 세율도 낮다.
      brackets: [
        { upTo: 60_000_000, rate: 0.001, progressive: 0 },
        { upTo: 150_000_000, rate: 0.0015, progressive: 30_000 },
        { upTo: 300_000_000, rate: 0.0025, progressive: 180_000 },
        { upTo: null, rate: 0.004, progressive: 630_000 },
      ],
      singleHouseBrackets: [
        { upTo: 60_000_000, rate: 0.0005, progressive: 0 },
        { upTo: 150_000_000, rate: 0.001, progressive: 30_000 },
        { upTo: 300_000_000, rate: 0.002, progressive: 180_000 },
        { upTo: null, rate: 0.0035, progressive: 630_000 },
      ],
      singleHouseBracketLimit: 900_000_000,
      singleHouseBracketNote: '공시가격 9억원 이하 1세대1주택에만 적용한다.',

      urbanAreaRate: 0.0014,
      urbanAreaNote: '전국 200개 지자체 조례를 전수 확인한 결과 0.14%를 넘는 곳은 없다. 다만 과세 지역인지는 지자체장이 따로 고시하므로 자동 판정은 불가능하다.',
      localEducationTaxRate: 0.2,

      elasticRate: {
        applied: false,
        note: '지자체가 조례로 표준세율을 ±50% 조정할 수 있고 대법원도 적법하다고 판시했다(2020추5169). 현재 주택 재산세에 적용 중인 지자체는 없으나 매년 확인이 필요하다.',
      },

      fireServiceTax: {
        included: false,
        note: '소방분 지역자원시설세는 건축물분 시가표준액이 과세표준인데, 공동주택 공시가격에서 건물분만 떼어낼 수 없어 계산에서 제외했다. 실제 고지서에는 별도로 붙는다.',
      },

      _source: '지방세법 제110조~제112조·제151조, 같은 법 시행령 제109조',
    },

    comprehensiveTax: {
      _reform2027: '2027년 세제개편안 반영. 기본공제 거주/비거주 이원화, 보유공제 → 거주공제 전환, 세액공제 금액한도 신설, 공정시장가액비율 70%.',
      fairMarketRatio: { 2026: 0.6, 2027: 0.7, 2028: 0.7, default: 0.6 },
      // 2028년부터 일부 다주택·조정대상지역 주택은 80% 를 적용한다.
      fairMarketRatioAdjusted: { 2028: 0.8 },
      fairMarketRatioAdjustedNote: '2028년부터 일부 다주택·조정대상지역 주택에 적용. 대상 범위는 시행령 확정 전이다.',
      basicDeduction: {
        general: 900_000_000,
        generalNote: '1세대1주택자가 아닌 경우. 부부 공동명의 지분별 과세 시 각자 적용.',
        // 2027년부터 실거주 여부로 갈린다 — 실거주 14억, 비거주 9억
        singleHouse: { 2026: 1_200_000_000, 2027: 1_400_000_000, 2028: 1_400_000_000, default: 1_200_000_000 },
        singleHouseNote: '거주하는 1세대1주택 기본공제. 2027년부터 14억원.',
        nonResident: { 2026: 1_200_000_000, 2027: 900_000_000, 2028: 900_000_000, default: 1_200_000_000 },
        nonResidentNote: '비거주 1주택 기본공제. 2027년부터 9억원으로 축소된다. 직장·학업·부모봉양 등 인정 사유가 있으면 거주로 본다.',
      },
      brackets: [
        { upTo: 300_000_000, rate: 0.005, progressive: 0 },
        { upTo: 600_000_000, rate: 0.007, progressive: 600_000 },
        { upTo: 1_200_000_000, rate: 0.010, progressive: 2_400_000 },
        { upTo: 2_500_000_000, rate: 0.013, progressive: 6_000_000 },
        { upTo: 5_000_000_000, rate: 0.015, progressive: 11_000_000 },
        { upTo: 9_400_000_000, rate: 0.020, progressive: 36_000_000 },
        { upTo: null, rate: 0.027, progressive: 101_800_000 },
      ],
      // 연령에 따른 고령자 공제는 개편 후에도 유지된다.
      seniorCredit: [
        { age: 60, rate: 0.2 }, { age: 65, rate: 0.3 }, { age: 70, rate: 0.4 },
      ],
      // 보유기간 공제 — 2026년까지 적용. 2027년에는 축소되고, 2028년부터 폐지된다.
      longTermCredit: [
        { years: 5, rate: 0.2 }, { years: 10, rate: 0.4 }, { years: 15, rate: 0.5 },
      ],
      longTermCreditLastYear: 2027,
      longTermCreditReducedNote: '2027년 보유공제는 축소된다고만 발표됐고 축소 후 공제율표는 아직 공개되지 않았다. 여기서는 현행 표를 그대로 쓰되, 2027년은 거주공제와 비교해 높은 쪽을 적용한다. 거주기간과 보유기간이 같으면 두 표가 동일해 결과가 달라지지 않는다.',
      longTermCreditReducedVerified: false,
      // 거주기간 공제 — 2027년 신설, 2028년부터는 이 표만 쓴다.
      residencyCredit: [
        { years: 5, rate: 0.2 }, { years: 10, rate: 0.4 }, { years: 15, rate: 0.5 },
      ],
      residencyCreditFrom: 2027,
      residencyOnlyFrom: 2028,
      creditRuleNote: '2027년은 축소된 보유공제와 새 거주공제 중 높은 공제율을 적용하고, 2028년부터는 거주기간만 기준으로 공제한다.',
      // 세액공제 금액 한도 — 2027년 신설
      creditAmountLimit: { 2027: 8_000_000, 2028: 6_000_000 },
      creditAmountLimitNote: '공제받을 수 있는 세액의 한도. 2027년 800만원, 2028년부터 600만원. 2026년까지는 한도가 없다.',
      maxCreditRate: 0.8,
      farmTaxRate: 0.2,
      jointSpecialNote: '부부 공동명의 1주택은 (a) 지분별 각자 9억 공제(세액공제 없음) 와 (b) 공동명의 1주택자 특례 12억 공제 + 고령자·장기보유 세액공제 중 유리한 쪽을 선택한다.',
      notApplied: ['직전연도 법령 전체를 재현한 세부담상한 자동 계산'],
      notAppliedNote: '재산세 중복분 공제는 반영한다. 세부담상한은 직전연도 총세액 입력이 있을 때 적용하며, 입력이 없으면 상한 미적용 사실을 안내한다.',
      _source: '종합부동산세법 제7조~제9조 (원문 대조 필요)',
    },

    _source: '집을 갖고 계시는 동안 해마다 내는 세금이에요. 재산세와 종합부동산세를 합한 금액이고, 지금은 기본 세율로 어림잡았어요. — 지방세법 · 종합부동산세법',
  },

  rentalIncome: {
    separateTaxation: { threshold: 20_000_000, rate: 0.14 },
    deductionRate: 0.6,
  },

  healthInsurance: {
    dependencyLossThreshold: 20_000_000,
    note: '연소득 기준 초과 시 피부양자 탈락 → 지역가입자 전환',
    estimatedLocalMonthly: 118_000,
  },

  housingPension: {
    eligibility: {
      minAge: 55,
      maxOfficialPrice: 1_200_000_000,
      note: '부부 중 연소자 기준 연령. 가입 자격은 공시가격으로 판정한다.',
    },
    priceBasis: {
      note: '가입 자격은 공시가격, 월지급금은 시세로 산정한다. 두 값을 섞으면 반드시 틀린다.',
      eligibilityBy: 'officialPrice',
      monthlyBy: 'marketPrice (12억원 상한)',
    },

    // 한국주택금융공사 월지급금 예시표 — 종신지급방식 정액형 · 일반주택
    // 열 = 주택가격 1억~12억 (시세 기준), 값 = 월지급금(원)
    monthlyTable: {
      asOf: '2026-03-01',
      scheme: '종신지급방식 정액형 · 일반주택',
      pricesEok: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      byAge: {
        55: [156_000, 312_000, 468_000, 624_000, 780_000, 936_000, 1_092_000, 1_248_000, 1_404_000, 1_560_000, 1_716_000, 1_872_000],
        60: [210_000, 421_000, 632_000, 842_000, 1_053_000, 1_264_000, 1_475_000, 1_685_000, 1_896_000, 2_107_000, 2_318_000, 2_528_000],
        65: [252_000, 505_000, 758_000, 1_011_000, 1_264_000, 1_517_000, 1_770_000, 2_023_000, 2_276_000, 2_529_000, 2_782_000, 3_035_000],
        70: [307_000, 615_000, 923_000, 1_231_000, 1_539_000, 1_847_000, 2_155_000, 2_462_000, 2_770_000, 3_078_000, 3_386_000, 3_414_000],
        75: [381_000, 762_000, 1_143_000, 1_525_000, 1_906_000, 2_287_000, 2_669_000, 3_050_000, 3_431_000, 3_666_000, 3_666_000, 3_666_000],
        80: [483_000, 966_000, 1_449_000, 1_932_000, 2_416_000, 2_899_000, 3_382_000, 3_865_000, 4_060_000, 4_060_000, 4_060_000, 4_060_000],
      },
      // 정비례 구간에서 쓰는 1억원당 계수. linearMax 를 넘으면 표 값을 그대로 쓴다.
      perHundredMillion: {
        55: { rate: 156_042, linearMaxEok: 12 },
        60: { rate: 210_739, linearMaxEok: 12 },
        65: { rate: 252_958, linearMaxEok: 12 },
        70: { rate: 307_866, linearMaxEok: 11 },
        75: { rate: 381_310, linearMaxEok: 9 },
        80: { rate: 483_225, linearMaxEok: 8 },
      },
      rounding: '천원 단위 내림',
      ageInterpolation: {
        allowed: false,
        reason: '5세 구간별 연평균 증가폭이 10,948 → 8,442 → 10,984 → 14,682 → 20,380원으로 비단조여서 구간 내 선형 보간의 오차를 보증할 수 없다.',
        policy: '표에 없는 연령은 인접 하위 연령의 값을 보수적으로 쓰고 추정치임을 반드시 밝힌다. 정확한 금액은 공사 예상연금조회로 안내한다.',
        lookupUrl: 'https://www.hf.go.kr/ko/sub03/sub03_02_02.do',
      },
      caution: '노인복지주택·주거목적 오피스텔은 계수가 다르다. 2026.03.01 이전 신청자는 인상 전 요율이 적용된다.',
      _source: 'https://www.hf.go.kr/ko/sub03/sub03_01_01_02.do (2026.03.01 기준)',
    },

    basicPensionImpact: {
      note: '주택연금 수령액은 소득으로 보지 않는다. 오히려 수령 누계액이 부채로 잡혀 재산의 소득환산액에서 차감되므로, 기초연금 수급에 불리하게 작용하지 않는다.',
      corrected: '초기 규칙셋의 "소득인정액에 반영되어 감액"은 사실과 달라 폐기했다.',
      _source: '보건복지부 2026년 기초연금 사업안내 · 보도자료(2026.01.02)',
    },
    _source: '한국주택금융공사 (hf.go.kr)',
  },

  downsizeSpecial: {
    minAge: 60,
    limit: 100_000_000,
    benefit: '양도차익 1억 한도 연금계좌 추가납입, 연금소득세 3.3~5.5%',
  },

  downsizeSpecial2027: {
    status: 'ANNOUNCED',
    statusLabel: '2027년 시행 예정',
    source: '2026년 세제개편안',
    statusNote: '정부가 발표한 2026년 세제개편안에 담긴 제도로, 2027년 시행 예정이다. 법률이 확정되고 요건을 모두 충족할 때 적용된다.',
    effectiveYear: 2027,
    minAge: 65,
    condition: '만 65세 이상 1세대1주택자가 수도권 주택을 양도하고 6개월 이내에 비수도권으로 이전',
    relocationMonths: 6,
    reduction: 0.5,
    reductionCap: 500_000_000,
    reductionNote: '양도소득세를 50% 감면하되 감면액은 최대 5억원까지',
    clawback: '양도 후 5년 이내에 수도권 주택을 취득하거나 수도권으로 돌아오면 감면세액이 추징될 수 있다',
    requirements: [
      '양도일 현재 만 65세 이상',
      '1세대 1주택',
      '양도 주택이 수도권 소재',
      '양도 후 6개월 이내 비수도권으로 이전',
    ],
  },

  giftTax: {
    note: '증여세 누진세율. 성인 자녀 증여재산공제 5천만원, 신고세액공제 3%.',
    childDeduction: 50_000_000,
    filingCredit: 0.03,
    brackets: [
      { upTo: 100_000_000, rate: 0.10, progressive: 0 },
      { upTo: 500_000_000, rate: 0.20, progressive: 10_000_000 },
      { upTo: 1_000_000_000, rate: 0.30, progressive: 60_000_000 },
      { upTo: 3_000_000_000, rate: 0.40, progressive: 160_000_000 },
      { upTo: null, rate: 0.50, progressive: 460_000_000 },
    ],
    _source: '상속세 및 증여세법 제26조·제53조·제69조 (법제처 국가법령정보센터, 시행 2026.1.2.)',
    acquisitionTaxRate: 0.038,
    acquisitionTaxNote: '일반 증여 취득세 3.5% + 지방교육세 0.3% (지방세법 제11조제1항제2호, 제151조)',
    heavyAcquisitionTaxRate: 0.124,
    heavyAcquisitionTaxNote: '조정대상지역 · 시가표준액 3억원 이상 주택 증여 시 취득세 12% + 지방교육세 0.4% (지방세법 제13조의2제2항)',
    heavyExemption: '1세대1주택자가 소유한 주택을 배우자 또는 직계존비속이 증여받는 경우 중과 제외 → 일반세율 3.5% 적용 (지방세법 시행령 제28조의6제2항)',
    farmTaxNormal: 0.002,
    farmTaxHeavy: 0.01,
    farmTaxNote: '농어촌특별세. 전용 85㎡(국민주택규모) 이하는 비과세 (농어촌특별세법 제4조제11호)',
    _acquisitionSource: '지방세법·시행령, 농어촌특별세법 (법제처, 지방세법 시행 2026.7.1.)',
  },

  annuitization: {
    note: '목돈 → 월 수령액 환산. 반드시 정액 인출 방식으로 계산한다.',
    method: 'DRAWDOWN',
    formula: '월 인출액 = 원금 ÷ 인출기간(년) ÷ 12',
    immediateAnnuity: {
      status: 'UNVERIFIABLE',
      note: '즉시연금 종신형의 연령별 월 수령액은 공시 대상이 아니어서(생명보험협회 공시실은 60세·5천만원 대표계약의 적립률만 공시) 공신력 있는 표준표가 없다. 추정 계수를 만들어 쓰지 마라.',
    },
    lifeExpectancy: {
      note: '인출기간의 근거. 통계청 2024년 생명표(2025.12.03 공표) 기대여명(년).',
      60: { male: 23.7, female: 28.4 },
      65: { male: 19.5, female: 23.7 },
      70: { male: 15.5, female: 19.2 },
      80: { male: 8.5, female: 10.9 },
      caution: '보험사 경험생명표(제10회)는 기대여명이 3~4년 길다. 보험 연금액 산출에는 경험생명표를, 정액 인출 계획에는 통계청 생명표를 쓴다. 정액 인출 결과를 "즉시연금 수령액"이라고 부르지 마라.',
      _source: '통계청 2024년 생명표 (KOSIS DT_1B42)',
    },
  },

  basicPension: {
    note: '기초연금. 주택연금과 병행 가능하다.',
    standardAmount: { single: 349_700, couple: 559_520 },
    coupleReduction: 0.2,
    selectionThreshold: { single: 2_470_000, couple: 3_952_000 },
    housingPensionNote: '주택연금 수령액은 소득으로 산정하지 않는다.',
    _source: '보건복지부 2026년 기초연금 사업안내 · 보도자료(2026.01.02)',
  },

  partialLiquidity: {
    minAreaM2: 115,
    note: '세대구분형 공동주택으로 일부를 임대하려면 별도 출입문·부엌·욕실이 필요하다. 전용 115㎡ 미만 단일세대 아파트는 구조상 어렵다.',
    _source: '건축법 시행령 제3조의5, 주택법 제2조제19호',
  },

  rentalDeposit: {
    seoulCouple: 1_500_000_000,
    note: '서울 전용 84㎡ 전세 보증금 가정치. 실제 지역·단지에 따라 크게 달라진다.',
    _assumption: true,
  },

  livingCost: {
    note: '노후 적정생활비(월). 응답자의 주관적 판단을 조사한 값이다.',
    seoulCouple: 3_296_000,
    byRegion: {
      서울: { coupleAdequate: 3_296_000, coupleMinimum: 2_428_000 },
      광역시: { coupleAdequate: 2_876_000, coupleMinimum: 2_123_000 },
      도: { coupleAdequate: 2_929_000, coupleMinimum: 2_102_000 },
    },
    national: { coupleAdequate: 2_981_000, coupleMinimum: 2_166_000 },
    citation: '국민연금공단 국민연금연구원, 국민노후보장패널조사(KReIS) 제10차 부가조사 (2024년 조사 · 2025년 12월 발표), 국가승인통계 제322001호',
    caution: '흔히 인용되는 "서울 337만원"은 한 회차 앞선 제10차 본조사(2023년 조사) 값이다. 혼용하지 마라.',
  },
};
