/**
 * 데모 폴백 데이터 — DEMO_SCENARIO.md(반포자이 은퇴 부부)가 정본이다.
 * 클라이언트(js/*)와 서버리스 함수(api/advise.js)가 함께 import하는 단일 원본이므로
 * 이 파일의 수치를 바꾸면 양쪽이 동시에 바뀐다.
 */

export const MOCK_PROPERTY = {
  address: '서울 서초구 반포동 반포자이 84.94㎡',
  officialPrice: 3_491_000_000,
  marketPrice: 4_700_000_000,
  confidence: 'HIGH',
  tradeCount: 12,
  areaM2: 84.94,
};

export const MOCK_SUBJECT = {
  age: 70,
  spouseAge: 65,
  houseCount: 1,
  ownership: 'JOINT_50_50',
  holdingYears: 18,
  isResiding: true,
  monthlyIncome: 2_000_000,
  targetExpense: 3_296_000,
  annualPropertyTax: 18_090_000,
};

export const MOCK_ANSWERS = {
  inheritance: '어느 정도 중요하다',
  residency: '가능하면 지금 집에 살고 싶지만 세금이 부담된다',
  urgency: '지금 당장 해결해야 한다',
  liquidityForm: '매달 나오는 돈이 더 필요하다',
  familyConsensus: '자녀와 상의 중이다',
};

export const MOCK_ADVICE = {
  profile: {
    inheritance: 65,
    residency: 70,
    urgency: 85,
    note: '거주 애착은 있으나 매년 3천만원 이상 적자가 발생해 시급성이 가장 높습니다.',
  },

  cashflow: {
    monthlyIncome: 2_000_000,
    targetExpense: 3_296_000,
    monthlyShortage: 1_296_000,
    annualHoldingTax: 18_090_000,
    summary: '집은 47억인데, 매달 130만원이 부족해요',
  },

  recommended: {
    id: 'DOWNSIZE',
    label: '다운사이징 (2027 특례 활용)',
    headline: '1년 기다려 팔면 8,807만원을 아낍니다',
    gross: 6_170_000,
    deductions: [
      { label: '신규주택 보유세 등', amount: -200_000, formula: '공시가 12억 이하 주택 재산세 월 환산' },
    ],
    net: 5_970_000,
    coverage: 1,
    trace: [
      'Step1. 1세대1주택·공동명의·18년 보유거주 → 장기보유특별공제 80% 적용 대상',
      'Step1. 공시가격 34.91억 > 12억 → 주택연금 가입 자격 미달, PENSION 배제',
      'Step1. 전용 84.94㎡ 단일세대 → 세대분리 임대 불가, PARTIAL 배제',
      'Step2. 과세 이벤트: 양도소득세, 신규주택 취득세, 중개보수',
      'Step3. 2026년 매각 시 양도세·지방세 1억 7,614만원',
      'Step3. 2027년 고령 1주택자 비수도권 이전 특례(50% 감면) 적용 시 8,807만원',
      'Step3. 절감액 8,807만원 → 순수령 45억 8,608만원',
      'Step4. 신규주택 12.46억 차감 → 잔여 금융자산 33억 3,988만원',
      'Step4. 생활비 계정 5억 ÷ 10년 = 월 417만원 + 국민연금 200만원 = 617만원',
      'Step5. 시급성 85·거주유지 70 → 보유세 부담 소멸이 거주 애착보다 우선',
      'Step6. 6,170,000 - 200,000 = 5,970,000 ✓ (적정생활비의 181%)',
    ],
    why: '지금 집을 그대로 두시면 매년 3천만원 이상이 부족합니다. 2027년에 시행 예정인 제도(만 65세 이상이 수도권 집을 팔고 비수도권으로 옮기면 양도소득세를 절반까지 깎아주는 제도)를 활용하시면, 세금을 8,807만원 덜 내시고 새 집을 마련한 뒤에도 33억원이 남습니다. 매달 597만원을 쓰실 수 있어 자녀에게 손 벌리실 일이 없어집니다.',
    tradeoff: '18년 사신 반포를 떠나 비수도권으로 이사하셔야 합니다. 병원과 교통, 자녀 접근성을 함께 보고 지역을 정하셔야 합니다.',
    cautions: [
      '이 제도는 아직 확정되지 않았습니다. 국회 통과 여부와 시행 시기를 반드시 확인하셔야 합니다.',
      '매도 후 5년 이내에 수도권 주택을 다시 사시면 감면받은 세금이 추징될 수 있습니다.',
      '제도가 확정되지 않으면 2026년 매각으로 전환하는 대안도 함께 검토하셔야 합니다.',
    ],
    actionPlan: [
      { title: '부동산 명의와 거주기간 확인', desc: '등기부와 주민등록초본으로 공동명의 지분과 실거주 18년을 먼저 확인해요.' },
      { title: '2027 특례 입법 확정 여부 점검', desc: '국회 통과와 시행 시기를 확인한 뒤 매도 시점을 정해요.' },
      { title: '비수도권 이전 후보지 비교', desc: '병원·교통·자녀 접근성과 새 집 마련 비용을 함께 살펴봐요.' },
      { title: '매도 전 세무 전문가 확인', desc: '양도 시점의 법령과 1세대1주택 요건을 최종 확인한 뒤 결정해요.' },
    ],
  },

  alternatives: [
    {
      id: 'SELL',
      label: '2026년 즉시 매각 후 임차',
      net: 6_100_000,
      oneLiner: '지금 팔면 양도세를 8,807만원 더 내시고, 전셋집은 자산으로 남지 않습니다.',
    },
  ],

  excluded: [
    {
      id: 'PENSION',
      label: '주택연금',
      reason: '공시가격 34억 9,100만원으로 가입 기준 12억원을 넘어 가입하실 수 없습니다. 다만 12억원 이하 주택으로 옮기신 뒤에는 가입이 가능하며, 어머니 연세 기준 월 303만 5천원을 받으실 수 있습니다.',
    },
    {
      id: 'PARTIAL',
      label: '부분 유동화',
      reason: '전용 84.94㎡ 단일세대 구조라 일부를 세놓기 어렵고, 집을 그대로 두시면 연 1,809만원의 보유세가 계속 나갑니다.',
    },
  ],

  details: {
    taxes: {
      holding: [
        { year: 2026, propertyTax: null, jongbuTax: null, total: 18_090_000, note: '2026년 기준 보유세' },
        { year: 2027, propertyTax: null, jongbuTax: null, total: 27_640_000, note: '2027 개편안 반영(공정시장가액비율 70%)' },
        { year: 2028, propertyTax: null, jongbuTax: null, total: 27_640_000, estimated: true, note: '2027 개편 완료 기준 유지 가정' },
      ],
      holdingNote: '연령·장기보유 공제 미반영 기준값이며, 공시가격 변동에 따라 달라집니다.',
      sale2026: {
        salePrice: 4_700_000_000,
        acquisitionBasis: 1_082_470_000,
        expenses: 50_000_000,
        brokerage: 25_850_000,
        capitalGainsWithLocal: 176_140_000,
        netProceeds: 4_498_010_000,
        note: '1세대1주택 비과세 + 장기보유특별공제 80% 적용, 12억 초과분 과세',
      },
      sale2027Special: {
        capitalGainsWithLocal: 88_070_000,
        netProceeds: 4_586_080_000,
        savings: 88_070_000,
        condition: '만 65세 이상 · 수도권→비수도권 이전 · 양도소득세 50% 감면',
        status: '입법 미확정',
      },
    },

    options: {
      PENSION: {
        eligible: false,
        reason: '공시가격 34억 9,100만원 > 가입 기준 12억원',
        monthlyIfEligibleLater: 3_035_000,
        laterCondition: '공시가 12억원 이하 주택으로 옮기신 뒤, 어머니(65세) 연령 기준',
      },
      PARTIAL: {
        eligible: false,
        reason: '전용 84.94㎡ 단일세대 구조 — 세대분리 임대 불가, 보유세는 그대로 지속',
      },
      SELL: {
        eligible: true,
        monthlyNet: 6_100_000,
        breakdown: [
          { label: '매도가격', amount: 4_700_000_000 },
          { label: '양도소득세·지방소득세', amount: -176_140_000, formula: '2026년 매각 · 특례 미적용' },
          { label: '중개보수·부가세', amount: -25_850_000 },
          { label: '매도 후 수령액', amount: 4_498_010_000, subtotal: true },
          { label: '서울 임차 보증금', amount: -1_500_000_000 },
          { label: '의료·간병 예비자금', amount: -300_000_000 },
          { label: '금융운용 가능액', amount: 2_698_010_000, subtotal: true },
        ],
        monthlyFlow: [
          { label: '국민연금', amount: 2_000_000 },
          { label: '생활비 계정 인출 (4.92억 ÷ 10년)', amount: 4_100_000 },
        ],
      },
      DOWNSIZE: {
        eligible: true,
        monthlyNet: 5_970_000,
        proceeds: [
          { label: '매도가격', amount: 4_700_000_000 },
          { label: '양도소득세·지방소득세 (특례 50% 감면)', amount: -88_070_000 },
          { label: '중개보수·부가세', amount: -25_850_000 },
          { label: '순수령액', amount: 4_586_080_000, subtotal: true },
          { label: '신규 주택 + 취득·중개비용', amount: -1_246_200_000, formula: '공시가 12억 이하 주택 기준' },
          { label: '잔여 금융자산', amount: 3_339_880_000, subtotal: true },
        ],
        monthlyFlow: [
          { label: '국민연금', amount: 2_000_000 },
          { label: '생활비 계정 인출 (5억 ÷ 10년)', amount: 4_170_000 },
          { label: '신규주택 보유세 등', amount: -200_000 },
        ],
        allocation: [
          { label: '10년 생활비 계정', amount: 500_000_000, note: '예금·단기채, 매달 자동이체' },
          { label: '의료·간병 예비자금', amount: 300_000_000, note: '별도 계좌로 분리' },
          { label: '장기 안정운용', amount: 2_000_000_000, note: '예금·국채·우량채 분산' },
          { label: '가족지원·여유자금', amount: 539_880_000, note: '부모님 평생자금 확인 후 사용' },
        ],
      },
    },

    giftReview: {
      considered: true,
      giftTax: 1_809_050_000,
      acquisitionTax: 178_600_000,
      cashNeeded: 1_987_650_000,
      verdict: 'REJECTED',
      verdictReason: '자녀가 약 19억 8,765만원을 현금으로 준비해야 하고, 그렇게 해도 부모님의 생활비 문제는 그대로 남습니다. 명의만 이전될 뿐입니다.',
      inheritanceScenarios: [
        { title: '다운사이징 후 잔여자산 상속', desc: '새 집과 33억원의 금융자산이 그대로 상속 재원으로 남는 방식이에요.' },
        { title: '새 집 기준 주택연금 병행', desc: '12억원 이하 주택으로 옮기신 뒤 가입해, 정산하고 남은 금액을 상속하는 방식이에요.' },
      ],
    },
  },

  familyNote: '아버지, 어머니. 집이 47억인데 매달 130만원이 모자란 게 이상하시죠. 저도 알아보고 알았어요. 내년에 시행될 제도를 쓰면 세금을 8,800만원 덜 내고 옮기실 수 있대요. 새 집 마련하고도 33억이 남아서, 매달 597만원씩 쓰실 수 있어요. 반포를 떠나는 게 마음에 걸리시겠지만, 지금처럼 두시면 매년 3천만원씩 모자라요. 같이 한번 보시고 이야기 나눠요.',
};
