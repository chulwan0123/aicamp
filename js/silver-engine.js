import { fmtKRW } from './format.js';
import { openAddressSearch } from './address.js';
import { lookupOfficialPrice, lookupProperty } from './property.js';
import { refineAnswerLabel } from './refine-fields.js';

const SESSION_KEY = 'silver-analysis-session-v2';
const TARGET_EXPENSE = 3_296_000;
const AGE_BAND = { '50~59세': 50, '60~64세': 60, '65~69세': 65, '70세 이상': 70 };
const shell = window.SILVER_SHELL;
const state = { property: null, properties: [], subject: null, answers: null, advice: null, refinements: {} };

const screen = (index) => document.querySelector(`[data-screen="${index}"]`);
const checkedLabel = (name) => document.querySelector(`input[name="${name}"]:checked`)?.closest('label')?.textContent.trim() || '';
const checkedValue = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value || '';
const text = (node, value) => { if (node && value !== undefined && value !== null) node.textContent = String(value); };
const format = (value, exact = false) => fmtKRW(Math.round(Number(value) || 0), exact ? { exact: true } : undefined);
const signed = (value) => `${value < 0 ? '- ' : ''}${format(Math.abs(value))}`;
const OPTION_LABELS = {
  SELL: '팔고 전세로 옮기기',
  DOWNSIZE: '작은 집으로 옮기기',
  PARTIAL: '집 일부를 세놓기',
  PENSION: '주택연금',
};

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined && value !== null) node.textContent = String(value);
  return node;
}

function summaryCard(rows) {
  const card = element('div', 'card summary');
  card.style.marginTop = '18px';
  rows.filter((row) => row && row[1] !== undefined && row[1] !== null).forEach(([label, value]) => {
    const line = element('div', 'summary-row');
    line.append(element('span', 'summary-label', label), element('span', 'summary-value', value));
    card.append(line);
  });
  return card;
}

function infoBox(label, value) {
  const box = element('div', 'info');
  box.style.marginTop = '18px';
  const strong = element('strong', '', label);
  box.append(strong, document.createElement('br'), document.createTextNode(value || '확인할 내용이 없어요.'));
  return box;
}

function pointList(items) {
  const list = element('ul', 'points');
  (items || []).filter(Boolean).forEach((item) => list.append(element('li', '', item)));
  return list;
}

function basisText(basis) {
  return (Array.isArray(basis) ? basis : [basis]).filter(Boolean).join(' · ');
}

function calculationDetails(title, steps, basis, badges = []) {
  const details = element('details', 'faq-item');
  const summary = element('summary', 'faq-question', title);
  const answer = element('div', 'faq-answer');
  badges.filter(Boolean).forEach((badge) => answer.append(element('p', 'eyebrow', badge)));
  (steps || []).forEach((step) => answer.append(element('p', '', step)));
  if (basisText(basis)) answer.append(infoBox('계산 근거', basisText(basis)));
  details.append(summary, answer);
  return details;
}

function calculationCard(title, steps, basis, badges = []) {
  const card = element('div', 'card faq-list');
  card.append(calculationDetails(title, steps, basis, badges));
  return card;
}

function engineSection(screenIndex, key, title, copy) {
  const content = screen(screenIndex)?.querySelector('.content');
  if (!content) return null;
  let section = content.querySelector(`[data-engine-section="${key}"]`);
  if (!section) {
    section = element('section');
    section.dataset.engineSection = key;
    const disclaimer = content.querySelector('.disclaimer');
    content.insertBefore(section, disclaimer || null);
  }
  section.replaceChildren();
  section.append(element('h3', 'section-heading', title));
  if (copy) section.append(element('p', 'section-copy', copy));
  return section;
}

function optionStatus(advice, id) {
  if (advice.recommended.id === id) return '가장 추천';
  if (advice.details.options[id]?.eligible) return '선택 가능';
  return '현재 어려움';
}

function optionExplanation(advice, id) {
  if (advice.recommended.id === id) return advice.recommended.why;
  const alternative = advice.alternatives.find((item) => item.id === id);
  if (alternative) return alternative.oneLiner;
  const excluded = advice.excluded.find((item) => item.id === id);
  return [excluded?.reason, excluded?.fact].filter(Boolean).join(' ')
    || advice.details.options[id]?.reason
    || '현재 입력값을 기준으로 비교했어요.';
}

function renderFullEngineResult(advice) {
  const resultContent = screen(10)?.querySelector('.result-home');
  if (!resultContent) return;
  let root = resultContent.querySelector('[data-engine-complete]');
  if (!root) {
    root = element('div');
    root.dataset.engineComplete = 'true';
    const faqHeading = [...resultContent.querySelectorAll('.section-title')]
      .find((node) => node.textContent.trim() === '자주 묻는 질문');
    resultContent.insertBefore(root, faqHeading || null);
  }
  root.replaceChildren();

  root.append(
    element('h3', 'section-title', '부모님 성향 분석'),
    element('p', 'section-copy', '입력하신 답을 100점 기준으로 정리했어요.'),
    summaryCard([
      ['상속 의향', `${advice.profile.inheritance}점`],
      ['현재 거주 의향', `${advice.profile.residency}점`],
      ['현금흐름 시급성', `${advice.profile.urgency}점`],
      ['한 해 보유세', format(advice.cashflow.annualHoldingTax)],
      ['세금 포함 연간 부족액', format(advice.cashflow.annualShortage)],
    ]),
    infoBox('성향 판단', advice.profile.note),
    infoBox('현금흐름 진단', advice.cashflow.summary),
    element('div', 'result-divider'),
    element('h3', 'section-title', '네 가지 선택지를 모두 비교했어요'),
    element('p', 'section-copy', '추천안뿐 아니라 가능한 대안과 현재 어려운 방법도 함께 보여드려요.'),
  );

  const optionList = element('div', 'strategies');
  optionList.style.marginTop = '18px';
  Object.keys(OPTION_LABELS).forEach((id) => {
    const option = advice.details.options[id] || {};
    const card = element('article', 'card strategy');
    const time = element('div', 'strategy-time');
    time.append(element('strong', '', OPTION_LABELS[id]), element('span', 'age', optionStatus(advice, id)));
    const amount = option.eligible && option.monthlyNet != null ? `월 ${format(option.monthlyNet)}` : '현재 적용 어려움';
    card.append(time, element('h3', '', amount), element('p', '', optionExplanation(advice, id)));
    if (option.remainingAssets) {
      card.append(element('p', '', `남는 총자산 ${format(option.remainingAssets.total)} · ${option.remainingAssets.note || ''}`));
    }
    optionList.append(card);
  });
  root.append(optionList);
  const optionEvidence = element('div', 'card faq-list');
  Object.entries(OPTION_LABELS).forEach(([id, label]) => {
    const option = advice.details.options[id] || {};
    optionEvidence.append(calculationDetails(
      `${label} 적용 근거`,
      option.steps || (option.reason ? [`적용 여부 = ${option.reason}`] : []),
      option.basis,
      [optionStatus(advice, id)],
    ));
  });
  root.append(element('h3', 'section-heading', '선택지별 적용 근거'), optionEvidence);

  const deductionTotal = (advice.recommended.deductions || []).reduce((sum, row) => sum + Math.abs(row.amount || 0), 0);
  root.append(
    element('div', 'result-divider'),
    element('h3', 'section-title', '추천 판단을 자세히 볼까요?'),
    summaryCard([
      ['추천 방법', advice.recommended.label],
      ['월 총유입', format(advice.recommended.gross)],
      ['월 차감액', deductionTotal ? signed(-deductionTotal) : '없음'],
      ['월 세후 활용액', format(advice.recommended.net)],
      ['필요 생활비 충족률', `${Math.round(advice.recommended.coverage * 100)}%`],
      ['감수할 점', advice.recommended.tradeoff],
    ]),
    element('h3', 'section-heading', '실행 전에 주의할 점'),
    pointList(advice.recommended.cautions),
    infoBox('가족에게 전할 내용', advice.familyNote),
    element('div', 'result-divider'),
    element('h3', 'section-title', advice.refine.title),
    element('p', 'section-copy', advice.refine.intro),
  );
  if (advice.recommended.deductions?.length) {
    const refineDivider = root.querySelector('.result-divider:last-of-type');
    root.insertBefore(element('h3', 'section-heading', '월 차감 내역'), refineDivider);
    root.insertBefore(summaryCard(advice.recommended.deductions.map((row) => [row.label, `${signed(row.amount)}${row.formula ? ` · ${row.formula}` : ''}`])), refineDivider);
  }

  const accuracy = advice.refine.accuracy || {};
  root.append(summaryCard([
    ['현재 계산 정확도', accuracy.note || '기본 가정으로 계산했어요'],
    ['확인한 추가 정보', `${accuracy.answeredCount || 0}/${accuracy.totalCount || advice.refine.fields.length}개`],
    ['예상 오차 범위', accuracy.tolerance != null ? `±${Math.round(accuracy.tolerance * 100)}%` : '확인 필요'],
  ]));

  const refineList = element('div', 'card faq-list');
  advice.refine.fields.forEach((field) => {
    const answer = refineAnswerLabel(field.field, advice.refine.answers?.[field.field]);
    const details = element('details', 'faq-item');
    const summary = element('summary', 'faq-question', field.label);
    const body = element('div', 'faq-answer');
    body.append(element('p', '', answer ? `현재 반영값: ${answer}` : '추가 확인이 필요해요.'), element('p', '', field.why));
    details.append(summary, body);
    refineList.append(details);
  });
  root.append(refineList);
  if (advice.refine.applied?.length) root.append(infoBox('알려주신 대로 반영한 조건', advice.refine.applied.join(' · ')));
  root.append(element('h3', 'section-heading', '현재 계산에 사용한 가정'), pointList(advice.refine.assumptions));

  root.append(
    element('div', 'result-divider'),
    element('h3', 'section-title', '계산 근거와 산식'),
    element('p', 'section-copy', '금액이 어떻게 나왔는지 항목별로 펼쳐볼 수 있어요.'),
  );
  const evidenceList = element('div', 'card faq-list');
  advice.evidence.forEach((block) => {
    const badges = [block.estimated ? '예상값' : '', block.upcoming || ''];
    evidenceList.append(calculationDetails(block.title, block.steps, block.basis, badges));
  });
  root.append(evidenceList, element('div', 'result-divider'));
}

function renderEngineDetails(advice) {
  const taxes = advice.details.taxes;
  const special = taxes.sale2027Special;
  const sell = advice.details.options.SELL;
  const downsize = advice.details.options.DOWNSIZE;
  const pension = advice.details.options.PENSION;
  const gift = advice.details.giftReview;

  const taxSection = engineSection(11, 'zip-tax', '2027년 매도 특례 비교', '현재 입력값이 특례 조건을 모두 충족하는지 함께 확인해요.');
  taxSection?.append(summaryCard([
    ['특례 적용 가능성', special.applicable ? '조건 충족' : '현재 조건 미충족'],
    ['일반 매각 세금', format(taxes.sale2026.capitalGainsWithLocal)],
    ['특례 적용 시 세금', special.applicable ? format(special.capitalGainsWithLocal) : '적용 불가'],
    ['예상 절감액', special.applicable ? format(special.savings) : '없음'],
    ['적용 조건', special.condition],
    ['추징 조건', special.clawback],
  ]));
  taxSection?.append(calculationCard('고령 1주택 특례 산식', special.steps, special.basis, [special.status]));

  const sellSection = engineSection(12, 'zip-sell', '매도·임차 계산 전체 내역', '세금, 보증금, 비상자금과 매달 꺼내 쓰는 금액을 모두 보여드려요.');
  sellSection?.append(summaryCard((sell.breakdown || []).map((row) => [row.label, signed(row.amount)])));
  sellSection?.append(element('h3', 'section-heading', '매월 들어오고 나가는 돈'), summaryCard((sell.monthlyFlow || []).map((row) => [row.label, signed(row.amount)])));
  if (sell.remainingAssets) sellSection?.append(element('h3', 'section-heading', '남는 자산'), summaryCard([
    ['주택', format(sell.remainingAssets.home)], ['임차 보증금', format(sell.remainingAssets.deposit)],
    ['금융자산', format(sell.remainingAssets.financial)], ['총자산', format(sell.remainingAssets.total)],
  ]), infoBox('자산 설명', sell.remainingAssets.note));
  sellSection?.append(calculationCard('매도·임차 산식', sell.steps, sell.basis));

  const downSection = engineSection(13, 'zip-downsize', '다운사이징 계산 전체 내역', '매도부터 새 집 구입, 생활비 배분까지 순서대로 확인해요.');
  downSection?.append(summaryCard((downsize.proceeds || []).map((row) => [row.label, signed(row.amount)])));
  downSection?.append(element('h3', 'section-heading', '남은 돈의 배분'), summaryCard((downsize.allocation || []).map((row) => [row.label, `${format(row.amount)} · ${row.note || ''}`])));
  downSection?.append(element('h3', 'section-heading', '매월 들어오고 나가는 돈'), summaryCard((downsize.monthlyFlow || []).map((row) => [row.label, signed(row.amount)])));
  if (downsize.remainingAssets) downSection?.append(element('h3', 'section-heading', '남는 자산'), summaryCard([
    ['새 주택', format(downsize.remainingAssets.home)], ['금융자산', format(downsize.remainingAssets.financial)],
    ['총자산', format(downsize.remainingAssets.total)],
  ]), infoBox('자산 설명', downsize.remainingAssets.note));
  downSection?.append(calculationCard('다운사이징 산식', downsize.steps, downsize.basis));

  const planSection = engineSection(14, 'zip-plan', '추천 근거와 다른 선택지', '추천하지 않은 방법도 이유와 함께 확인해요.');
  planSection?.append(summaryCard([
    ['추천 방법', advice.recommended.label], ['추천 이유', advice.recommended.why], ['감수할 점', advice.recommended.tradeoff],
  ]));
  planSection?.append(element('h3', 'section-heading', '주의할 점'), pointList(advice.recommended.cautions));
  const comparison = element('div', 'strategies');
  [...advice.alternatives, ...advice.excluded].forEach((item) => {
    const card = element('article', 'card strategy');
    const header = element('div', 'strategy-time');
    header.append(element('strong', '', item.label), element('span', 'age', item.net != null ? '대안' : '제외'));
    card.append(header, element('h3', '', item.net != null ? `월 ${format(item.net)}` : '현재 적용 어려움'), element('p', '', item.oneLiner || [item.reason, item.fact].filter(Boolean).join(' ')));
    comparison.append(card);
  });
  planSection?.append(comparison, infoBox('가족에게 전할 내용', advice.familyNote));

  const pensionSection = engineSection(15, 'zip-pension', '주택연금 계산 전체 내역', pension.eligible ? '현재 소득과 주택연금 월지급금을 함께 봐요.' : pension.reason);
  pensionSection?.append(summaryCard((pension.monthlyFlow || []).map((row) => [row.label, signed(row.amount)])));
  if (!pension.eligible) pensionSection?.append(summaryCard([
    ['현재 사유', pension.reason], ['향후 가능한 조건', pension.laterCondition],
    ['조건 충족 시 월 예상액', pension.monthlyIfEligibleLater ? format(pension.monthlyIfEligibleLater) : '확인 필요'],
  ]));
  pensionSection?.append(calculationCard('주택연금 산식', pension.steps, pension.basis));

  const giftSection = engineSection(16, 'zip-gift', '증여 시 필요한 세금과 현금', '증여세와 자녀 취득세를 나눠서 확인해요.');
  giftSection?.append(summaryCard([
    ['예상 증여세', format(gift.giftTax)], ['자녀 취득세', format(gift.acquisitionTax)], ['자녀가 준비할 현금', format(gift.cashNeeded)],
  ]));
  giftSection?.append(calculationCard('상속·증여 검토 산식', gift.steps, gift.basis));
}

function setBrokenTitle(node, first, second) {
  if (!node) return;
  const br = node.querySelector('br');
  if (!br) { node.textContent = `${first} ${second}`; return; }
  if (node.firstChild) node.firstChild.nodeValue = first;
  if (br.nextSibling) br.nextSibling.nodeValue = second;
}

function rowValue(root, label) {
  return [...(root?.querySelectorAll('.summary-row') || [])]
    .find((row) => row.querySelector('.summary-label')?.textContent.trim() === label)
    ?.querySelector('.summary-value');
}

function ageBand(name, fallback) {
  const label = checkedLabel(name) || fallback;
  return { label, age: AGE_BAND[label] ?? AGE_BAND[fallback] };
}

function residency() {
  const select = document.querySelector('#residency-years');
  const label = select?.selectedOptions?.[0]?.text || '10년 이상';
  const years = label.startsWith('10년') ? 10 : label.startsWith('5년') ? 5 : 2;
  return { label, years };
}

function acquisitionYear() {
  const select = document.querySelector('#acquisition-fields select');
  return Number(select?.value?.replace(/[^0-9]/g, '')) || 2008;
}

function addressRows() {
  return [...document.querySelectorAll('#address-fields .property')].map((propertyNode) => {
    const inputs = propertyNode.querySelectorAll('input.input');
    const roadInput = propertyNode.querySelector('[data-address-input]') || inputs[0];
    return {
      propertyNode,
      road: roadInput?.value.trim() || '',
      detail: inputs[1]?.value.trim() || '',
      pnu: propertyNode.dataset.pnu || '',
      officialPrice: Number(propertyNode.dataset.officialPrice) || null,
      officialPriceYear: propertyNode.dataset.officialPriceYear || null,
      officialComplexName: propertyNode.dataset.officialComplexName || null,
      priceConfirmed: propertyNode.dataset.priceConfirmed === 'true',
      officialPriceError: propertyNode.dataset.officialPriceError || null,
    };
  });
}

async function resolveProperties() {
  const rows = addressRows();
  const properties = await Promise.all(rows.map(async (row, index) => {
    const { propertyNode, road, detail, pnu } = row;
    if (!road) throw new Error(`주택 ${index + 1}의 도로명주소를 입력해 주세요.`);
    const found = await lookupProperty(road, detail);
    if (!found) throw new Error(`주택 ${index + 1}의 주소를 현재 데이터에서 찾지 못했어요.`);

    let official = row.officialPrice ? {
      officialPrice: row.officialPrice,
      officialPriceYear: row.officialPriceYear,
      complexName: row.officialComplexName,
      pnu,
      _source: 'data.go.kr',
    } : null;
    if (pnu && !official) {
      try {
        setOfficialPriceLoading(propertyNode, true);
        official = await lookupOfficialPrice(pnu);
        cacheOfficialPrice(propertyNode, official);
      } catch (error) {
        cacheOfficialPriceError(propertyNode, error);
        console.warn(`[silver] 주택 ${index + 1} 공시가격 자동 조회 실패`, error);
      } finally {
        setOfficialPriceLoading(propertyNode, false);
      }
    }

    return {
      ...found,
      ...(official || {}),
      complexName: official?.complexName || found.complexName,
      roadAddress: road,
      detailAddress: detail,
      dong: detail.split(/\s+/)[0] || found.dong,
      ho: detail.split(/\s+/)[1] || found.ho,
      officialPriceSource: official?._source || found._source,
    };
  }));
  state.properties = properties;
  state.property = properties[0];
  renderLookup(properties);
  return properties;
}

function cacheOfficialPrice(propertyNode, official) {
  propertyNode.dataset.pnu = official.pnu;
  propertyNode.dataset.officialPrice = String(official.officialPrice);
  propertyNode.dataset.fetchedOfficialPrice = String(official.officialPrice);
  propertyNode.dataset.officialPriceYear = official.officialPriceYear || '';
  propertyNode.dataset.officialComplexName = official.complexName || '';
  propertyNode.dataset.priceConfirmed = 'true';
  delete propertyNode.dataset.officialPriceError;
}

function clearOfficialPrice(propertyNode) {
  delete propertyNode.dataset.officialPrice;
  delete propertyNode.dataset.fetchedOfficialPrice;
  delete propertyNode.dataset.officialPriceYear;
  delete propertyNode.dataset.officialComplexName;
  propertyNode.dataset.priceConfirmed = 'false';
}

function cacheOfficialPriceError(propertyNode, error) {
  clearOfficialPrice(propertyNode);
  propertyNode.dataset.officialPriceError = error?.message || '공시가격을 불러오지 못했어요.';
}

function setOfficialPriceLoading(propertyNode, loading) {
  propertyNode.dataset.priceLoading = loading ? 'true' : 'false';
  if (loading) delete propertyNode.dataset.officialPriceError;
}

async function searchAddress(searchButton) {
  const propertyNode = searchButton.closest('.property');
  const roadInput = propertyNode?.querySelector('[data-address-input]') || propertyNode?.querySelector('input.input');
  if (!propertyNode || !roadInput) return;

  const original = searchButton.textContent;
  searchButton.disabled = true;
  searchButton.textContent = '검색 중…';
  try {
    const selected = await openAddressSearch();
    if (!selected) return;
    roadInput.value = selected.roadAddress;
    propertyNode.dataset.pnu = selected.pnu;
    clearOfficialPrice(propertyNode);

    searchButton.textContent = '조회 중…';
    try {
      setOfficialPriceLoading(propertyNode, true);
      cacheOfficialPrice(propertyNode, await lookupOfficialPrice(selected.pnu));
    } catch (error) {
      cacheOfficialPriceError(propertyNode, error);
      console.warn('[silver] 공시가격 자동 조회 실패', error);
    } finally {
      setOfficialPriceLoading(propertyNode, false);
    }
  } finally {
    searchButton.disabled = false;
    searchButton.textContent = original;
  }
}

function collectAnswers() {
  return {
    inheritance: checkedValue('q-inheritance'),
    residency: checkedValue('q-residency'),
    urgency: checkedValue('q-urgency'),
    liquidityForm: checkedValue('q-liquidityForm'),
    familyConsensus: checkedValue('q-familyConsensus'),
  };
}

function collectSubject(property) {
  const father = ageBand('fa', '60~64세');
  const mother = ageBand('ma', '60~64세');
  const acquired = acquisitionYear();
  const lived = residency();
  const wishRegion = document.querySelector('#wish-region')?.value || '서울 강남구';
  const incomeInput = document.querySelector('input[name="q-income"]:checked');
  const count = shell.getPropertyCount();
  const joint = shell.getJointOwnership()[0];
  return {
    age: father.age,
    spouseAge: mother.age,
    ageBands: { father: father.label, mother: mother.label },
    houseCount: count,
    ownership: joint ? 'JOINT_50_50' : 'SINGLE',
    holdingYears: Math.max(0, new Date().getFullYear() - acquired),
    acquisitionYear: acquired,
    acquisitionPrice: property.acquisitionPrice,
    isResiding: true,
    residencyYears: lived.years,
    residencyBand: lived.label,
    wishRegion,
    wishRegionIsCapitalArea: /^(서울|경기|인천)/.test(wishRegion),
    monthlyIncome: Number(incomeInput?.dataset.amount) || 2_000_000,
    targetExpense: TARGET_EXPENSE,
  };
}

function collectRefinements(subject) {
  return {
    householdHouseCount: subject.houseCount,
    isResidingHome: true,
    ownershipRatio: subject.ownership === 'JOINT_50_50' ? 50 : 100,
    isUrbanArea: true,
  };
}

function renderLookup(properties) {
  const list = document.querySelector('#lookup-items');
  if (!list) return;
  list.replaceChildren();
  properties.forEach((property, index) => {
    const item = document.createElement('div');
    item.className = 'lookup-item';
    const address = document.createElement('div');
    address.className = 'lookup-address';
    address.textContent = `주택 ${index + 1} · ${shell.getJointOwnership()[index] ? '공동명의' : '단독명의'} · ${property.roadAddress}`;
    const detail = document.createElement('div');
    detail.className = 'lookup-address';
    detail.textContent = `${property.detailAddress} · 전용 ${property.areaM2}㎡ · ${property.pyeong}평형`;
    const value = document.createElement('div');
    value.className = 'lookup-value';
    value.textContent = format(property.marketPrice);
    item.append(address, detail);
    if (property.officialPriceSource === 'data.go.kr') {
      const official = document.createElement('div');
      official.className = 'lookup-address';
      official.textContent = `${property.officialPriceYear || '최신'}년 공시가격 · ${format(property.officialPrice)}`;
      item.append(official);
    }
    item.append(value);
    list.append(item);
  });
  const total = properties.reduce((sum, property) => sum + property.marketPrice, 0);
  text(document.querySelector('#total-assessed-value'), format(total));
  text(document.querySelector('#summary-assessed-value'), format(total));
}

function renderLookupError(message) {
  const list = document.querySelector('#lookup-items');
  if (list) {
    const item = document.createElement('div');
    item.className = 'lookup-item';
    const address = document.createElement('div');
    address.className = 'lookup-address';
    address.textContent = message;
    item.append(address);
    list.replaceChildren(item);
  }
  const info = screen(3)?.querySelector('.property .info strong');
  text(info, message);
}

function renderConfirm(subject, property) {
  const root = screen(8);
  const total = state.properties.reduce((sum, item) => sum + item.marketPrice, 0);
  text(rowValue(root, '부모님 연령대'), `아버지 ${subject.ageBands.father} · 어머니 ${subject.ageBands.mother}`);
  text(rowValue(root, '보유 부동산'), `${subject.houseCount}채`);
  text(rowValue(root, '주택 정보'), `${property.complexName} ${property.pyeong}평형`);
  text(rowValue(root, '최근 실거래가'), format(total));
  text(rowValue(root, '장기 거주'), subject.residencyBand);
  text(rowValue(root, '희망 거주지'), subject.wishRegion);
}

async function fetchAdvice(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  try {
    const response = await fetch('./api/advise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `분석 요청에 실패했어요 (${response.status})`);
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function runAnalysis() {
  const properties = await resolveProperties();
  const subject = collectSubject(properties[0]);
  const answers = collectAnswers();
  const refinements = collectRefinements(subject);
  state.subject = subject;
  state.answers = answers;
  state.refinements = refinements;
  renderConfirm(subject, properties[0]);
  const advice = await fetchAdvice({ property: properties[0], subject, answers, refinements });
  state.advice = advice;
  renderAdvice(advice, properties[0], subject);
  persist();
  return advice;
}

function renderAdvice(advice, property, subject) {
  if (!advice?.cashflow || !advice?.details) return;
  const report = screen(10);
  const cashflow = advice.cashflow;
  const holding = advice.details.taxes.holding;
  const sale = advice.details.taxes.sale2026;
  const pension = advice.details.options.PENSION;
  const downsize = advice.details.options.DOWNSIZE;
  const sell = advice.details.options.SELL;
  const gift = advice.details.giftReview;

  setBrokenTitle(report.querySelector('.result-status-title'), '집은 충분하지만,', `월 ${format(cashflow.monthlyShortage)}이 부족해요`);
  text(report.querySelector('.result-status-copy'), `${property.complexName} ${property.dong || ''} ${property.ho || ''}·${property.pyeong}평형·최근 실거래가 ${format(property.marketPrice)}을 기준으로 분석했어요.`);
  const cashValues = report.querySelectorAll('.cashflow-item strong');
  text(cashValues[0], format(cashflow.targetExpense));
  text(cashValues[1], format(cashflow.monthlyIncome));
  text(cashValues[2], format(cashflow.monthlyShortage));

  text(report.querySelector('.ai-title'), advice.recommended.headline);
  text(report.querySelector('.ai-copy'), advice.recommended.why);
  const recommendedMetric = report.querySelector('.ai-recommendation-group .overview-metric');
  text(recommendedMetric?.querySelector('span'), `${advice.recommended.label} 월 예상액`);
  text(recommendedMetric?.querySelector('strong'), format(advice.recommended.net));

  const taxValues = report.querySelectorAll('.tax-summary-value');
  text(taxValues[0], format(holding[0].total));
  text(taxValues[1], format(holding[2].total));
  text(taxValues[2], format(sale.capitalGainsWithLocal));
  const groups = report.querySelectorAll('.result-overviews .overview-group');
  text(groups[1]?.querySelector('.overview-metric strong'), pension.eligible ? format(pension.monthlyNet) : '가입 기준 초과');
  text(groups[2]?.querySelector('.overview-metric strong'), format(downsize.remainingAssets?.total));
  text(groups[3]?.querySelector('.overview-metric strong'), format(sell.monthlyNet));
  text(groups[4]?.querySelector('.overview-metric strong'), advice.profile.inheritance >= 70 ? '높음' : advice.profile.inheritance >= 40 ? '보통' : '낮음');

  const faq = report.querySelector('.result-home > .faq-list')?.querySelectorAll('.faq-answer > p') || [];
  text(faq[0], `예상 보유세는 2026년 ${format(holding[0].total)}에서 2028년 ${format(holding[2].total)}으로 변할 수 있어요.`);
  text(faq[1], pension.eligible ? `현재 조건의 예상 월 수령액은 ${format(pension.monthlyNet)}이에요.` : `${pension.reason} ${pension.laterCondition || ''}`);
  text(faq[2], `매도 세금과 비용을 반영한 예상 수령액은 ${format(sale.netProceeds)}이에요.`);
  text(faq[3], `현재 증여 시 자녀가 준비할 예상 현금은 ${format(gift.cashNeeded)}이에요.`);

  renderTaxDetail(advice, property);
  renderSellDetail(advice, property, subject);
  renderDownsizeDetail(advice, property, subject);
  renderRecommendation(advice);
  renderPensionDetail(advice, property);
  renderGiftDetail(advice, subject);
  renderHomeValues(advice, property, subject);
  renderChatIntro(advice);
  renderFullEngineResult(advice);
  renderEngineDetails(advice);
}

function renderTaxDetail(advice, property) {
  const root = screen(11);
  const holding = advice.details.taxes.holding;
  const sale = advice.details.taxes.sale2026;
  text(root.querySelector('.hero-value'), format(holding[2].total));
  const change = holding[0].total ? Math.round((holding[2].total / holding[0].total - 1) * 100) : 0;
  text(root.querySelector('.hero-caption'), `2026년 대비 약 ${change}% ${change >= 0 ? '증가' : '감소'}`);
  root.querySelectorAll('.results .result').forEach((card, index) => {
    const values = card.querySelectorAll('.money-value');
    text(values[0], format(holding[index].propertyTax));
    text(values[1], format(holding[index].jongbuTax));
    text(card.querySelector('.money-row.total span:last-child'), format(holding[index].total));
  });
  text(root.querySelector('.sale-value'), format(sale.capitalGainsWithLocal));
  text(rowValue(root, '최근 실거래가'), format(property.marketPrice));
  text(rowValue(root, '취득가·필요경비'), format(sale.acquisitionBasis + sale.expenses));
  text(rowValue(root, '지방소득세 포함'), format(sale.capitalGainsWithLocal));
}

function renderSellDetail(advice, _property, subject) {
  const root = screen(12);
  const sell = advice.details.options.SELL;
  text(root.querySelector('.hero-value'), format(sell.monthlyNet));
  const breakdown = sell.breakdown || [];
  const byLabel = (label) => breakdown.find((row) => row.label === label)?.amount;
  text(rowValue(root, '매도 후 수령액'), format(byLabel('세금 내고 손에 쥐는 돈')));
  text(rowValue(root, '임차 보증금'), signed(byLabel('전세 보증금')));
  text(rowValue(root, '생활비 예비자금'), signed(byLabel('아프실 때 쓸 돈')));
  text(rowValue(root, '금융운용 가능액'), format(byLabel('굴릴 수 있는 돈')));
  const ages = root.querySelectorAll('.strategy .age');
  text(ages[0], `${Math.min(subject.age, subject.spouseAge) + 5}세 예상`);
  text(ages[1], `${Math.min(subject.age, subject.spouseAge) + 10}세 예상`);
}

function renderDownsizeDetail(advice, property, subject) {
  const root = screen(13);
  const sale = advice.details.taxes.sale2026;
  const downsize = advice.details.options.DOWNSIZE;
  text(root.querySelector('.sale-value'), format(downsize.remainingAssets?.total));
  text(rowValue(root, '최근 실거래가'), format(property.marketPrice));
  text(rowValue(root, '양도소득세·지방소득세'), signed(-sale.capitalGainsWithLocal));
  text(rowValue(root, '보유기간'), `${subject.holdingYears}년`);
  text(rowValue(root, '거주기간'), `${subject.residencyYears}년`);
  text(rowValue(root, '주택 수'), `${subject.houseCount}채`);
  text(rowValue(root, '희망 이전 지역'), subject.wishRegion);
}

function renderRecommendation(advice) {
  const root = screen(14);
  const actions = advice.recommended.actionPlan || [];
  root.querySelectorAll('.final-action').forEach((row, index) => {
    if (!actions[index]) return;
    text(row.querySelector('strong'), actions[index].title);
    text(row.querySelector('p'), actions[index].desc);
  });
}

function renderPensionDetail(advice, property) {
  const root = screen(15);
  const pension = advice.details.options.PENSION;
  text(root.querySelector('.hero-value'), pension.eligible ? format(pension.monthlyNet) : '가입 기준 초과');
  text(root.querySelector('.hero-caption'), pension.eligible ? '종신 지급 방식 기준' : pension.reason);
  text(rowValue(root, '가입 대상 주택'), `${property.complexName} ${property.dong || ''} ${property.ho || ''}`);
  text(rowValue(root, '전용면적'), `${property.areaM2}㎡ · ${property.pyeong}평형`);
  text(rowValue(root, '최근 실거래가'), format(property.marketPrice));
  text(rowValue(root, '거주 유지'), pension.eligible ? '가능' : '다른 주택 검토');
  text(rowValue(root, '지급 방식'), pension.eligible ? '종신 정액형' : '현재 가입 불가');
  const reason = root.querySelector('.info');
  const reasonLabel = reason?.querySelector('strong');
  if (reasonLabel) text(reasonLabel, '추천 이유');
  if (reason) {
    const reasonCopy = pension.eligible ? advice.recommended.why : `${pension.reason} ${pension.laterCondition || ''}`;
    const br = reason.querySelector('br');
    if (br?.nextSibling) br.nextSibling.nodeValue = reasonCopy;
  }
}

function renderGiftDetail(advice, subject) {
  const root = screen(16);
  const gift = advice.details.giftReview;
  text(rowValue(root, '공동명의 여부'), subject.ownership === 'JOINT_50_50' ? '주택 1 공동명의' : '주택 1 단독명의');
  text(rowValue(root, '상속 의향'), advice.profile.inheritance >= 70 ? '높음' : advice.profile.inheritance >= 40 ? '보통' : '낮음');
  text(rowValue(root, '거주 지속 의향'), advice.profile.residency >= 60 ? '있음' : '낮음');
  const paragraphs = root.querySelectorAll('.strategy p');
  text(paragraphs[0], `현재 증여 시 예상 증여세는 ${format(gift.giftTax)}이고 자녀 취득세는 ${format(gift.acquisitionTax)}이에요.`);
  text(paragraphs[1], `자녀가 바로 준비할 예상 현금은 모두 ${format(gift.cashNeeded)}이에요.`);
}

function renderHomeValues(advice, property, subject) {
  text(document.querySelector('[data-home-parent-age]'), `아버지 ${subject.ageBands.father} · 어머니 ${subject.ageBands.mother}`);
  text(document.querySelector('[data-home-cashflow-hint]'), `월 ${format(advice.cashflow.monthlyShortage)} 부족`);
  text(document.querySelector('[data-home-need]'), `필요 생활비 · ${format(advice.cashflow.targetExpense)}`);
  text(document.querySelector('[data-home-income]'), `예상 소득 · ${format(advice.cashflow.monthlyIncome)}`);
  const pension = advice.details.options.PENSION;
  text(document.querySelector('[data-home-pension]'), pension.eligible ? `주택연금 · ${format(pension.monthlyNet)}` : '주택연금 · 가입 기준 초과');
  text(document.querySelector('[data-home-finance]'), `금융운용 · ${format(advice.details.options.SELL.monthlyNet)}`);
  const title = document.querySelector('.start-result-head .start-preview-title');
  text(title, property.complexName);
}

function renderChatIntro(advice) {
  const intro = document.querySelector('#ai-consulting-overlay .chat-bubble.ai');
  if (intro) intro.textContent = `${advice.cashflow.summary}\n${advice.recommended.why}`;
}

function persist() {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(state)); }
  catch (error) { console.warn('[silver] 결과 저장 실패', error); }
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!saved?.advice || !saved?.property || !saved?.subject) return false;
    Object.assign(state, saved);
    renderAdvice(state.advice, state.property, state.subject);
    return true;
  } catch (error) {
    console.warn('[silver] 저장 결과 복원 실패', error);
    return false;
  }
}

async function share() {
  if (!state.advice) throw new Error('먼저 분석 결과를 확인해 주세요.');
  const response = await fetch('./api/share', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session: state }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.token) throw new Error(body.error || '공유 링크를 만들지 못했어요.');
  const url = new URL(location.origin + location.pathname);
  url.searchParams.set('r', body.token);
  url.hash = 'result';
  if (navigator.share) await navigator.share({ title: '부모님 노후 준비 결과', url: url.toString() });
  else await navigator.clipboard.writeText(url.toString());
}

async function restoreShared() {
  const token = new URLSearchParams(location.search).get('r');
  if (!token) return false;
  const response = await fetch(`./api/share?token=${encodeURIComponent(token)}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.session) throw new Error(body.error || '공유 결과를 불러오지 못했어요.');
  Object.assign(state, body.session);
  renderAdvice(state.advice, state.property, state.subject);
  persist();
  return true;
}

document.addEventListener('click', (event) => {
  const next = event.target.closest('[data-next]');
  if (next && next.closest('[data-screen="3"]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const original = next.textContent;
    next.disabled = true;
    next.textContent = '조회 중…';
    resolveProperties()
      .then(() => shell.show(4))
      .catch((error) => { renderLookupError(error.message); shell.show(3); })
      .finally(() => { next.disabled = false; next.textContent = original; });
    return;
  }
  if (next && next.closest('[data-screen="8"]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const promise = runAnalysis().catch((error) => {
      console.error('[silver] 분석 실패', error);
      renderLookupError(error.message || '주소와 입력 정보를 다시 확인해 주세요.');
      shell.show(3);
      throw error;
    });
    shell.setAnalysisPromise(promise);
    shell.show(9);
    return;
  }

  const search = event.target.closest('#address-fields .small');
  if (search) {
    event.preventDefault();
    searchAddress(search).catch((error) => renderLookupError(error.message || '주소 검색에 실패했어요.'));
    return;
  }

  if (event.target.closest('[data-share]')) {
    event.preventDefault();
    share().catch((error) => console.error('[silver] 공유 실패', error));
  }
  if (event.target.closest('[data-reset-result]')) {
    localStorage.removeItem(SESSION_KEY);
    Object.assign(state, { property: null, properties: [], subject: null, answers: null, advice: null, refinements: {} });
  }
}, true);

document.addEventListener('change', () => {
  if (!state.property) return;
  const subject = collectSubject(state.property);
  renderConfirm(subject, state.property);
});

try {
  if (!(await restoreShared())) restore();
} catch (error) {
  console.error('[silver] 공유 결과 복원 실패', error);
  restore();
}
