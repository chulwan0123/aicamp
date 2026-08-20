import { fmtKRW } from './format.js';
import { openAddressSearch } from './address.js';
import { lookupApartmentMarket, lookupOfficialPrice, lookupProperty } from './property.js';
import { refineAnswerLabel } from './refine-fields.js';
import { shareResult } from './kakao-share.js';

const SESSION_KEY = 'silver-analysis-session-v2';
const shell = window.SILVER_SHELL;
const state = { property: null, properties: [], subject: null, answers: null, advice: null, refinements: {}, chatHistory: [] };

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
  return [...new Set([excluded?.reason, excluded?.fact].filter(Boolean))].join(' ')
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

function numericValue(selector, label, { min = 0, max = Number.MAX_SAFE_INTEGER, optional = false } = {}) {
  const input = document.querySelector(selector);
  const raw = String(input?.value || '').trim();
  if (!raw) {
    if (optional) return null;
    throw new Error(`${label}을(를) 입력해 주세요.`);
  }
  const value = Number(raw.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label}을(를) 확인해 주세요.`);
  }
  return value;
}

function acquisitionValues() {
  return [...document.querySelectorAll('#acquisition-fields .property')].map((node, index) => {
    const year = Number(node.querySelector(`[data-acquisition-year="${index}"]`)?.value);
    const price = Number(String(node.querySelector(`[data-acquisition-price="${index}"]`)?.value || '').replace(/[^0-9]/g, ''));
    if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear()) {
      throw new Error(`주택 ${index + 1}의 취득연도를 확인해 주세요.`);
    }
    if (!(price > 0)) throw new Error(`주택 ${index + 1}의 매매 당시 가격을 확인해 주세요.`);
    const residencyYears = Number(node.querySelector(`[data-residency-years="${index}"]`)?.value);
    if (!Number.isFinite(residencyYears) || residencyYears < 0 || residencyYears > 80) {
      throw new Error(`주택 ${index + 1}의 실제 거주기간을 확인해 주세요.`);
    }
    const ownershipRatio = Number(node.querySelector(`[data-ownership-ratio="${index}"]`)?.value);
    if (!Number.isFinite(ownershipRatio) || ownershipRatio <= 0 || ownershipRatio > 100) {
      throw new Error(`주택 ${index + 1}의 명의 지분율을 확인해 주세요.`);
    }
    const isResiding = node.querySelector(`input[name="residing-${index}"]:checked`)?.value === 'yes';
    return { acquisitionYear: year, acquisitionPrice: price, residencyYears, ownershipRatio, isResiding };
  });
}

function unitParts(detail) {
  const tokens = String(detail || '').trim().split(/\s+/);
  return {
    dong: tokens.find((token) => /동$/.test(token)) || tokens[0] || '',
    ho: tokens.find((token) => /호$/.test(token)) || tokens[1] || '',
  };
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
      officialAreaM2: Number(propertyNode.dataset.officialAreaM2) || null,
      officialDong: propertyNode.dataset.officialDong || null,
      officialHo: propertyNode.dataset.officialHo || null,
      officialPriceSource: propertyNode.dataset.officialPriceSource || null,
      priceConfirmed: propertyNode.dataset.priceConfirmed === 'true',
      officialPriceError: propertyNode.dataset.officialPriceError || null,
    };
  });
}

function marketPriceValues() {
  return [...document.querySelectorAll('#lookup-items [data-market-price]')].map((input) =>
    Number(String(input.value || '').replace(/[^0-9]/g, '')) || null);
}

function officialPriceValues() {
  return [...document.querySelectorAll('#lookup-items [data-official-price]')].map((input) =>
    Number(String(input.value || '').replace(/[^0-9]/g, '')) || null);
}

function areaValues() {
  return [...document.querySelectorAll('#lookup-items [data-area-m2]')].map((input) =>
    Number(String(input.value || '').replace(/[^0-9.]/g, '')) || null);
}

function regionFromAddress(roadAddress) {
  const tokens = String(roadAddress || '').split(/\s+/);
  return tokens.slice(0, 2).join(' ').replace('특별시', '').replace('경기도', '경기');
}

async function resolveProperties({ requireMarketPrice = false, requireOfficialPrice = false, requireAcquisition = false } = {}) {
  const rows = addressRows();
  const acquisitions = requireAcquisition ? acquisitionValues() : [];
  const enteredMarketPrices = marketPriceValues();
  const enteredOfficialPrices = officialPriceValues();
  const enteredAreas = areaValues();
  const properties = await Promise.all(rows.map(async (row, index) => {
    const { propertyNode, road, detail, pnu } = row;
    if (!road) throw new Error(`주택 ${index + 1}의 도로명주소를 입력해 주세요.`);
    const found = await lookupProperty(road, detail);

    const unit = unitParts(detail);
    let official = row.officialPrice ? {
      officialPrice: row.officialPrice,
      officialPriceYear: row.officialPriceYear,
      complexName: row.officialComplexName,
      areaM2: row.officialAreaM2,
      dong: row.officialDong,
      ho: row.officialHo,
      pnu,
      _source: row.officialPriceSource || 'data.go.kr-file-shard',
    } : null;
    if (pnu && !official) {
      try {
        setOfficialPriceLoading(propertyNode, true);
        official = await lookupOfficialPrice(pnu, { ...unit, areaM2: found?.areaM2 });
        cacheOfficialPrice(propertyNode, official);
      } catch (error) {
        cacheOfficialPriceError(propertyNode, error);
        console.warn(`[silver] 주택 ${index + 1} 공시가격 자동 조회 실패`, error);
      } finally {
        setOfficialPriceLoading(propertyNode, false);
      }
    }

    const manualOfficialPrice = enteredOfficialPrices[index];
    if (!official && manualOfficialPrice) {
      official = {
        officialPrice: manualOfficialPrice,
        officialPriceYear: new Date().getFullYear(),
        complexName: found?.complexName || null,
        areaM2: enteredAreas[index] || found?.areaM2 || null,
        dong: unit.dong,
        ho: unit.ho,
        pnu,
        _source: 'user-input',
      };
    }
    if (requireOfficialPrice && !official) {
      throw new Error(`주택 ${index + 1}의 공시가격을 조회하거나 직접 입력해 주세요.`);
    }
    const base = found || {
      address: `${road} ${detail}`,
      officialPrice: null,
      marketPrice: null,
      confidence: 'HIGH',
      tradeCount: null,
      areaM2: official?.areaM2,
      complexName: official?.complexName,
      region: regionFromAddress(road),
      isCapitalArea: true,
      _source: 'data.go.kr',
    };
    let marketEvidence = null;
    if (pnu && official?.complexName && official?.areaM2) {
      try {
        marketEvidence = await lookupApartmentMarket(pnu, {
          complexName: official.complexName,
          areaM2: official.areaM2,
          months: 6,
        });
      } catch (error) {
        console.warn(`[silver] 주택 ${index + 1} 실거래 자동 조회 실패`, error);
      }
    }
    const fetchedMarketPrice = marketEvidence?.trade?.medianPrice || null;
    const marketPrice = enteredMarketPrices[index] || fetchedMarketPrice;
    if (requireMarketPrice && !(marketPrice > 0)) {
      throw new Error(`주택 ${index + 1}의 현재 예상 매매가격을 입력해 주세요.`);
    }
    return {
      ...base,
      ...(official || {}),
      officialPrice: official?.officialPrice || null,
      marketPrice,
      complexName: official?.complexName || base.complexName,
      roadAddress: road,
      detailAddress: detail,
      dong: official?.dong || unit.dong || base.dong,
      ho: official?.ho || unit.ho || base.ho,
      areaM2: official?.areaM2 || enteredAreas[index] || base.areaM2,
      acquisitionYear: acquisitions[index]?.acquisitionYear || null,
      acquisitionPrice: acquisitions[index]?.acquisitionPrice || null,
      residencyYears: acquisitions[index]?.residencyYears ?? null,
      ownershipRatio: acquisitions[index]?.ownershipRatio ?? (shell.getJointOwnership()[index] ? null : 100),
      ownership: shell.getJointOwnership()[index] ? 'JOINT' : 'SINGLE',
      isResiding: acquisitions[index]?.isResiding ?? false,
      officialPriceSource: official?._source || null,
      marketPriceSource: marketPrice > 0
        ? (fetchedMarketPrice === marketPrice ? 'data.go.kr-trade' : 'user-input')
        : null,
      tradeEvidence: marketEvidence?.trade || null,
      rentEvidence: marketEvidence?.rent || null,
      marketDataSources: marketEvidence?.sources || null,
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
  propertyNode.dataset.officialAreaM2 = official.areaM2 || '';
  propertyNode.dataset.officialDong = official.dong || '';
  propertyNode.dataset.officialHo = official.ho || '';
  propertyNode.dataset.officialPriceSource = official._source || 'data.go.kr-file-shard';
  propertyNode.dataset.priceConfirmed = 'true';
  delete propertyNode.dataset.officialPriceError;
}

function clearOfficialPrice(propertyNode) {
  delete propertyNode.dataset.officialPrice;
  delete propertyNode.dataset.fetchedOfficialPrice;
  delete propertyNode.dataset.officialPriceYear;
  delete propertyNode.dataset.officialComplexName;
  delete propertyNode.dataset.officialAreaM2;
  delete propertyNode.dataset.officialDong;
  delete propertyNode.dataset.officialHo;
  delete propertyNode.dataset.officialPriceSource;
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
    if (!/^(서울특별시|경기도)/.test(selected.roadAddress)) {
      throw new Error('현재는 서울·경기 아파트 주소만 선택할 수 있어요.');
    }
    if (selected.apartment !== 'Y') {
      throw new Error('아파트로 확인된 주소만 계산할 수 있어요.');
    }
    roadInput.value = selected.roadAddress;
    propertyNode.dataset.pnu = selected.pnu;
    clearOfficialPrice(propertyNode);

    searchButton.textContent = '조회 중…';
    try {
      setOfficialPriceLoading(propertyNode, true);
      const detailInput = propertyNode.querySelectorAll('input.input')[1];
      const found = await lookupProperty(selected.roadAddress, detailInput?.value || '');
      const unit = unitParts(detailInput?.value || '');
      if (unit.dong && unit.ho) {
        cacheOfficialPrice(propertyNode, await lookupOfficialPrice(selected.pnu, { ...unit, areaM2: found?.areaM2 }));
      }
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

function collectSubject(properties) {
  const property = properties[0];
  const fatherAge = numericValue('#father-age', '아버지 만 나이', { min: 18, max: 120 });
  const motherAge = numericValue('#mother-age', '어머니 만 나이', { min: 18, max: 120 });
  const acquired = property.acquisitionYear;
  const wishRegion = document.querySelector('#wish-region')?.value.trim() || '';
  const count = shell.getPropertyCount();
  const joint = shell.getJointOwnership()[0];
  const acquisitions = properties.map((item, index) => ({
    acquisitionYear: item.acquisitionYear,
    acquisitionPrice: item.acquisitionPrice,
    holdingYears: Math.max(0, new Date().getFullYear() - item.acquisitionYear),
    residencyYears: item.residencyYears,
    ownershipRatio: item.ownershipRatio,
    ownership: item.ownership,
    isResiding: item.isResiding,
    index,
  }));
  return {
    age: fatherAge,
    spouseAge: motherAge,
    ageBands: { father: `${fatherAge}세`, mother: `${motherAge}세` },
    houseCount: count,
    ownership: joint ? 'JOINT_50_50' : 'SINGLE',
    holdingYears: Math.max(0, new Date().getFullYear() - acquired),
    acquisitionYear: acquired,
    acquisitionPrice: property.acquisitionPrice,
    acquisitions,
    isResiding: property.isResiding,
    residencyYears: property.residencyYears,
    residencyBand: properties.map((item, index) => `주택 ${index + 1} ${item.residencyYears}년`).join(' · '),
    wishRegion,
    wishRegionIsCapitalArea: /^(서울|경기|인천)/.test(wishRegion),
    newHomeMarketPrice: numericValue('#new-home-market-price', '옮길 집의 예상 매매가격', { optional: true }),
    newHomeOfficialPrice: numericValue('#new-home-official-price', '옮길 집의 예상 공시가격', { optional: true }),
    rentalDeposit: numericValue('#rental-deposit', '임차 보증금', { min: 0 }),
    medicalReserve: numericValue('#medical-reserve', '의료·간병 예비자금', { min: 0 }),
    partialSpacePossible: checkedValue('partial-space') === 'yes',
    partialMonthlyRent: numericValue('#partial-monthly-rent', '예상 월 임대수입', { optional: true }) || 0,
    monthlyIncome: numericValue('#monthly-income', '월 연금·소득', { min: 0 }),
    targetExpense: numericValue('#target-expense', '필요한 월 생활비', { min: 1 }),
  };
}

function collectRefinements(subject) {
  return {
    householdHouseCount: subject.houseCount,
    isResidingHome: subject.isResiding,
    ownershipRatio: subject.acquisitions[0]?.ownershipRatio || 100,
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
    detail.textContent = [property.detailAddress, property.areaM2 ? `전용 ${property.areaM2}㎡` : '', property.pyeong ? `${property.pyeong}평형` : '']
      .filter(Boolean).join(' · ');
    item.append(address, detail);
    if (property.officialPrice > 0) {
      const official = document.createElement('div');
      official.className = 'lookup-address';
      official.textContent = `${property.officialPriceYear || '최신'}년 공시가격 · ${format(property.officialPrice)} · ${property.officialPriceSource === 'user-input' ? '사용자 입력' : '공공데이터 조회'}`;
      item.append(official);
    }
    if (property.tradeEvidence?.count > 0) {
      const trade = document.createElement('div');
      trade.className = 'lookup-address';
      trade.textContent = `최근 ${property.tradeEvidence.period?.months || 6}개월 동일 면적 매매 ${property.tradeEvidence.count}건 · 중앙값 ${format(property.tradeEvidence.medianPrice)}`;
      item.append(trade);
    }
    if (property.rentEvidence?.count > 0) {
      const rent = document.createElement('div');
      rent.className = 'lookup-address';
      const parts = [];
      if (property.rentEvidence.jeonse?.count > 0) parts.push(`전세 ${property.rentEvidence.jeonse.count}건 중앙값 ${format(property.rentEvidence.jeonse.medianDeposit)}`);
      if (property.rentEvidence.monthly?.count > 0) parts.push(`월세 ${property.rentEvidence.monthly.count}건 보증금 ${format(property.rentEvidence.monthly.medianDeposit)}·월 ${format(property.rentEvidence.monthly.medianMonthlyRent)}`);
      rent.textContent = `최근 ${property.rentEvidence.period?.months || 6}개월 임대 참고 · ${parts.join(' · ')}`;
      item.append(rent);
    }
    const officialField = document.createElement('label');
    officialField.className = 'field';
    const officialLabel = document.createElement('span');
    officialLabel.className = 'label';
    officialLabel.textContent = '공시가격을 확인해 주세요';
    const officialInput = document.createElement('input');
    officialInput.className = 'input';
    officialInput.inputMode = 'numeric';
    officialInput.dataset.officialPrice = String(index);
    officialInput.placeholder = '예: 3,000,000,000';
    officialInput.value = property.officialPrice > 0 ? Math.round(property.officialPrice).toLocaleString('ko-KR') : '';
    const officialHint = document.createElement('span');
    officialHint.className = 'hint';
    officialHint.textContent = property.officialPrice > 0
      ? '자동 조회값을 확인해 주세요. 수정하면 사용자 입력값으로 기록돼요.'
      : '자동 조회가 되지 않았어요. 공동주택 공시가격을 원 단위로 입력해 주세요.';
    officialField.append(officialLabel, officialInput, officialHint);
    item.append(officialField);

    const areaField = document.createElement('label');
    areaField.className = 'field';
    const areaLabel = document.createElement('span');
    areaLabel.className = 'label';
    areaLabel.textContent = '전용면적 (㎡)';
    const areaInput = document.createElement('input');
    areaInput.className = 'input';
    areaInput.inputMode = 'decimal';
    areaInput.dataset.areaM2 = String(index);
    areaInput.placeholder = '예: 84.93';
    areaInput.value = property.areaM2 > 0 ? String(property.areaM2) : '';
    areaField.append(areaLabel, areaInput);
    item.append(areaField);
    const marketField = document.createElement('label');
    marketField.className = 'field';
    const marketLabel = document.createElement('span');
    marketLabel.className = 'label';
    marketLabel.textContent = '현재 예상 매매가격을 확인해 주세요';
    const marketInput = document.createElement('input');
    marketInput.className = 'input';
    marketInput.inputMode = 'numeric';
    marketInput.dataset.marketPrice = String(index);
    marketInput.dataset.fetchedMarketPrice = property.marketPriceSource === 'data.go.kr-trade' ? String(property.marketPrice) : '';
    marketInput.placeholder = '예: 4,700,000,000';
    marketInput.value = property.marketPrice > 0 ? Math.round(property.marketPrice).toLocaleString('ko-KR') : '';
    const hint = document.createElement('span');
    hint.className = 'hint';
    hint.textContent = property.marketPriceSource === 'data.go.kr-trade'
      ? '동일 단지·지번·면적의 국토교통부 매매 중앙값입니다. 필요하면 수정해 주세요.'
      : '공시가격과 다른 값입니다. 최근 시세나 실거래가를 참고해 입력해 주세요.';
    marketField.append(marketLabel, marketInput, hint);
    item.append(marketField);
    list.append(item);
  });
  const total = properties.reduce((sum, property) => sum + (property.marketPrice || 0), 0);
  text(document.querySelector('#total-assessed-value'), total > 0 ? format(total) : '직접 입력 필요');
  text(document.querySelector('#summary-assessed-value'), total > 0 ? format(total) : '직접 입력 필요');
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
  const total = state.properties.reduce((sum, item) => sum + (item.marketPrice || 0), 0);
  text(rowValue(root, '부모님 나이'), `아버지 ${subject.ageBands.father} · 어머니 ${subject.ageBands.mother}`);
  text(rowValue(root, '보유 부동산'), `${subject.houseCount}채`);
  text(rowValue(root, '주택 정보'), property.pyeong
    ? `${property.complexName} ${property.pyeong}평형`
    : `${property.complexName || '아파트'}${property.areaM2 ? ` 전용 ${property.areaM2}㎡` : ''}`);
  text(rowValue(root, '예상 매매가격 합계'), format(total));
  text(rowValue(root, '주택별 거주기간'), subject.residencyBand);
  text(rowValue(root, '희망 거주지'), subject.wishRegion || '아직 정하지 않음');
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
  const properties = await resolveProperties({ requireMarketPrice: true, requireOfficialPrice: true, requireAcquisition: true });
  const subject = collectSubject(properties);
  subject.calculatedAt = new Date().toISOString();
  const answers = collectAnswers();
  const refinements = collectRefinements(subject);
  state.subject = subject;
  state.answers = answers;
  state.refinements = refinements;
  renderConfirm(subject, properties[0]);
  const advice = await fetchAdvice({ property: properties[0], properties, subject, answers, refinements });
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

  const portfolio = advice.portfolio || {
    totalMarketPrice: state.properties.reduce((sum, item) => sum + item.marketPrice, 0),
    properties: state.properties,
  };
  const shortageTitle = cashflow.monthlyShortage > 0
    ? `매달 ${format(cashflow.monthlyShortage)}이 부족해요`
    : '현재 소득으로 생활비를 채울 수 있어요';
  setBrokenTitle(report.querySelector('.result-status-title'), `집 ${portfolio.properties.length}채의 전체 시세는 ${format(portfolio.totalMarketPrice)}이고,`, shortageTitle);
  text(report.querySelector('.result-status-copy'), `${portfolio.properties.map((item, index) => item.complexName || `주택 ${index + 1}`).join(' · ')}의 실제 입력값을 모두 합쳐 분석했어요.`);
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
  text(groups[1]?.querySelector('.overview-metric strong'), pension.eligible ? format(pension.monthlyPayout) : '가입 기준 초과');
  text(groups[2]?.querySelector('.overview-metric strong'), downsize.eligible ? format(downsize.remainingAssets?.total) : '추가 입력 필요');
  text(groups[3]?.querySelector('.overview-metric strong'), format(sell.monthlyNet));
  text(groups[4]?.querySelector('.overview-metric strong'), advice.profile.inheritance >= 70 ? '높음' : advice.profile.inheritance >= 40 ? '보통' : '낮음');

  const faq = report.querySelector('.result-home > .faq-list')?.querySelectorAll('.faq-answer > p') || [];
  text(faq[0], `예상 보유세는 2026년 ${format(holding[0].total)}에서 2028년 ${format(holding[2].total)}으로 변할 수 있어요.`);
  text(faq[1], pension.eligible ? `현재 조건의 예상 월 수령액은 ${format(pension.monthlyPayout)}이에요.` : `${pension.reason} ${pension.laterCondition || ''}`);
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
  report.querySelector('[data-engine-complete]')?.remove();
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
  text(root.querySelector('.desc'), `주택 ${advice.meta?.houseCount || 1}채의 공시가격과 실제 입력한 매매가격을 모두 반영했어요.`);
  text(rowValue(root, '최근 실거래가'), format(advice.portfolio?.totalMarketPrice || property.marketPrice));
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
  setBrokenTitle(root.querySelector('.title'), `주택 ${subject.houseCount}채를 매도하고`, '작은 집으로 옮기면 얼마가 남을까요?');
  text(root.querySelector('.desc'), downsize.eligible ? `입력한 새 집 예산 ${format(subject.newHomeMarketPrice)}을 기준으로 비교했어요.` : downsize.reason);
  text(root.querySelector('.sale-value'), downsize.eligible ? format(downsize.remainingAssets?.total) : '계산 전');
  text(rowValue(root, '최근 실거래가'), format(advice.portfolio?.totalMarketPrice || property.marketPrice));
  text(rowValue(root, '양도소득세·지방소득세'), signed(-sale.capitalGainsWithLocal));
  text(rowValue(root, '보유기간'), `${subject.holdingYears}년`);
  text(rowValue(root, '거주기간'), subject.residencyBand);
  text(rowValue(root, '주택 수'), `${subject.houseCount}채`);
  text(rowValue(root, '희망 이전 지역'), subject.wishRegion || '아직 정하지 않음');
}

function renderRecommendation(advice) {
  const root = screen(14);
  text(root.querySelector('.title'), advice.recommended.headline);
  text(root.querySelector('.desc'), `${advice.recommended.label} — 왜 이 방법인지, 금액은 어떻게 나왔는지 정리했어요.`);
  const detail = root.querySelector('#recommendation-detail');
  if (!detail) return;
  detail.replaceChildren();

  const hero = element('div', 'recommendation-hero');
  const main = element('div', 'recommendation-hero-main');
  main.append(element('span', '', '추천 후 월 사용 가능 금액'), element('strong', '', format(advice.recommended.net)));
  text(main.querySelector('span'), '매달 쓰실 수 있는 돈');
  const coverage = element('div', 'recommendation-coverage', `필요한 생활비 ${format(advice.cashflow.targetExpense)}의 ${Math.round(advice.recommended.ratioToTarget * 100)}%`);
  const progress = element('div', 'recommendation-progress');
  const bar = element('i');
  bar.style.width = `${Math.min(100, Math.round(advice.recommended.ratioToTarget * 100))}%`;
  progress.append(bar);
  hero.append(main, coverage, progress);
  const topMetrics = summaryCard([
    ['추천 후 월 부족액', advice.recommended.monthlyShortageAfter > 0 ? format(advice.recommended.monthlyShortageAfter) : '없어요'],
    ['현재 남는 전체 자산', advice.recommended.remainingAssets ? format(advice.recommended.remainingAssets.total) : '선택지별 확인'],
  ]);
  topMetrics.classList.add('recommendation-top-metrics');
  detail.append(hero, topMetrics);

  const section = (title, copy) => {
    const node = element('section', 'recommendation-section');
    node.append(element('h3', 'section-heading', title));
    if (copy) node.append(element('p', 'recommendation-section-copy', copy));
    detail.append(node);
    return node;
  };

  const whySection = section('왜 이 방법일까요?');
  const whyCard = element('article', 'card strategy');
  whyCard.append(element('p', 'recommendation-section-copy', advice.recommended.why));
  whySection.append(whyCard);
  const tradeoffSection = section('대신 이런 점은 감수하셔야 해요');
  const tradeoffCard = element('article', 'card strategy');
  tradeoffCard.append(element('p', 'recommendation-section-copy', advice.recommended.tradeoff));
  tradeoffSection.append(tradeoffCard);

  const cautionSection = section('이건 꼭 확인해 주세요');
  const cautions = element('div', 'strategies');
  (advice.recommended.cautions || []).forEach((copy, index) => {
    const card = element('article', 'card strategy');
    card.append(element('span', 'status-tag', index === 0 ? '전문가 검토 권장' : '사용자 확인 필요'), element('p', '', copy));
    cautions.append(card);
  });
  if (advice.details.taxes.sale2027Special?.applicable) {
    const card = element('article', 'card strategy');
    card.append(element('span', 'status-tag', '시행 예정'), element('p', '', '2027년 특례는 발표된 개편안이에요. 법률이 확정되기 전에는 현재 계산 금액에 적용하지 않았어요.'));
    cautions.append(card);
  }
  cautionSection.append(cautions);

  const flowSection = section('매달 이렇게 들어와요');
  flowSection.append(summaryCard((advice.recommended.monthlyFlow || []).map((row) => [row.label, signed(row.amount)])));

  const alternativeSection = section('다른 방법은 어떨까요?');
  const comparison = element('div', 'strategies');
  [...(advice.alternatives || []), ...(advice.excluded || [])].forEach((item) => {
    const card = element('article', 'card strategy');
    const header = element('div', 'strategy-time');
    header.append(element('strong', '', item.label), element('span', 'age', item.net != null ? '대안' : '현재 어려움'));
    card.append(header, element('h3', '', item.net != null ? `월 ${format(item.net)}` : '조건을 먼저 확인해요'), element('p', '', item.oneLiner || [...new Set([item.reason, item.fact].filter(Boolean))].join(' ')));
    comparison.append(card);
  });
  alternativeSection.append(comparison);

  const actionSection = section('이 순서로 준비하시면 돼요');
  const actions = advice.recommended.actionPlan || [];
  const actionList = element('div', 'stack');
  actionList.style.gap = '0';
  actions.forEach((action, index) => {
    const row = element('div', 'final-action');
    const body = element('div');
    body.append(element('strong', '', action.title), element('p', '', action.desc || action.description));
    row.append(element('span', 'number', index + 1), body);
    actionList.append(row);
  });
  actionSection.append(actionList, infoBox('부모님께 이렇게 말씀드려 보세요', advice.familyNote));
}

function renderPensionDetail(advice, property) {
  const root = screen(15);
  const pension = advice.details.options.PENSION;
  text(root.querySelector('.hero-value'), pension.eligible ? format(pension.monthlyPayout) : '가입 기준 초과');
  text(root.querySelector('.hero-caption'), pension.eligible ? '종신 지급 방식 기준' : pension.reason);
  text(root.querySelector('.desc'), `${advice.meta?.houseCount || 1}채의 합산 공시가격과 부부의 실제 나이를 기준으로 확인했어요.`);
  text(rowValue(root, '가입 대상 주택'), advice.meta?.houseCount > 1 ? `보유 주택 ${advice.meta.houseCount}채 합산 검토` : `${property.complexName} ${property.dong || ''} ${property.ho || ''}`);
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
  text(document.querySelector('[data-home-cashflow-hint]'), advice.cashflow.monthlyShortage > 0 ? `월 ${format(advice.cashflow.monthlyShortage)} 부족` : '현재 생활비 충족');
  text(document.querySelector('[data-home-need]'), `필요 생활비 · ${format(advice.cashflow.targetExpense)}`);
  text(document.querySelector('[data-home-income]'), `예상 소득 · ${format(advice.cashflow.monthlyIncome)}`);
  const pension = advice.details.options.PENSION;
  text(document.querySelector('[data-home-pension]'), pension.eligible ? `주택연금 · ${format(pension.monthlyPayout)}` : '주택연금 · 가입 기준 초과');
  text(document.querySelector('[data-home-finance]'), `금융운용 · ${format(advice.details.options.SELL.monthlyNet)}`);
  const title = document.querySelector('.start-result-head .start-preview-title');
  text(title, advice.meta?.houseCount > 1 ? `보유 주택 ${advice.meta.houseCount}채` : (property.complexName || '분석한 주택'));
}

function renderChatIntro(advice) {
  const intro = document.querySelector('#ai-consulting-overlay .chat-bubble.ai');
  if (intro) intro.textContent = `${advice.cashflow.summary}\n${advice.recommended.why}`;
}

function appendChatBubble(role, content) {
  const messages = document.querySelector('[data-chat-messages]');
  if (!messages) return null;
  const bubble = element('div', `chat-bubble ${role === 'user' ? 'user' : 'ai'}`, content);
  messages.append(bubble);
  messages.scrollTop = messages.scrollHeight;
  return bubble;
}

async function sendChat(message) {
  if (!state.advice) throw new Error('먼저 부모님 분석을 완료해 주세요.');
  const previous = state.chatHistory.slice(-8);
  appendChatBubble('user', message);
  state.chatHistory.push({ role: 'user', content: message });
  const pending = appendChatBubble('assistant', '분석 결과와 세제 자료를 확인하고 있어요…');
  const response = await fetch('./api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history: previous, session: state }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'AI 답변을 불러오지 못했어요.');
  pending.textContent = body.answer;
  state.chatHistory.push({ role: 'assistant', content: body.answer });
  persist();
}

const chatForm = document.querySelector('[data-chat-form]');
chatForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = event.currentTarget.elements.message;
  const button = event.currentTarget.querySelector('.chat-send');
  const message = input.value.trim();
  if (!message || button.disabled) return;
  input.value = '';
  input.disabled = true;
  button.disabled = true;
  try {
    await sendChat(message);
  } catch (error) {
    appendChatBubble('assistant', error.message || '답변을 불러오지 못했어요. 잠시 후 다시 질문해 주세요.');
  } finally {
    input.disabled = false;
    button.disabled = false;
    input.focus();
  }
});

document.querySelector('#acquisition-fields')?.addEventListener('blur', (event) => {
  const input = event.target.closest('[data-acquisition-price]');
  if (!input) return;
  const amount = Number(input.value.replace(/[^0-9]/g, ''));
  if (amount > 0) input.value = amount.toLocaleString('ko-KR');
}, true);

document.querySelector('#lookup-items')?.addEventListener('blur', (event) => {
  const input = event.target.closest('[data-market-price], [data-official-price]');
  if (!input) return;
  const amount = Number(input.value.replace(/[^0-9]/g, ''));
  if (amount > 0) input.value = amount.toLocaleString('ko-KR');
}, true);

document.querySelector('#lookup-items')?.addEventListener('input', (event) => {
  const input = event.target.closest('[data-market-price], [data-official-price], [data-area-m2]');
  if (input) input.setCustomValidity('');
});

for (const selector of ['#new-home-market-price', '#new-home-official-price', '#rental-deposit', '#medical-reserve', '#partial-monthly-rent', '#monthly-income', '#target-expense']) {
  document.querySelector(selector)?.addEventListener('blur', (event) => {
    const amount = Number(String(event.target.value || '').replace(/[^0-9]/g, ''));
    if (amount > 0) event.target.value = amount.toLocaleString('ko-KR');
  });
}

document.querySelector('#address-fields')?.addEventListener('input', (event) => {
  const input = event.target.closest('[data-detail-input], [data-address-input]');
  const propertyNode = input?.closest('.property');
  if (propertyNode) {
    if (input.matches('[data-address-input]')) delete propertyNode.dataset.pnu;
    clearOfficialPrice(propertyNode);
  }
});

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
  return shareResult(state, { purpose: 'result' });
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
  const clean = new URL(location.href);
  clean.searchParams.delete('r');
  history.replaceState({ screen: 'result' }, '', `${clean.pathname}${clean.search}${clean.hash}`);
  return true;
}

function requiresAnalysisResult() {
  const current = shell?.getCurrent?.();
  return location.hash === '#ai-consulting' || (Number.isInteger(current) && current >= 10 && current <= 16);
}

function reportSharedRestoreError(error) {
  const message = error?.message || '공유 결과를 불러오지 못했어요.';
  window.SILVER_SHARED_RESTORE_ERROR = message;
  const clean = new URL(location.href);
  clean.searchParams.delete('r');
  history.replaceState({ screen: 'start' }, '', `${clean.pathname}${clean.search}#start`);
  shell?.showStart?.(false);
  document.dispatchEvent(new CustomEvent('silver:shared-restore-error', { detail: { message } }));
}

document.addEventListener('click', (event) => {
  const next = event.target.closest('[data-next]');
  if (next && next.closest('[data-screen="1"]')) {
    try {
      numericValue('#father-age', '아버지 만 나이', { min: 18, max: 120 });
      numericValue('#mother-age', '어머니 만 나이', { min: 18, max: 120 });
    } catch (error) {
      event.preventDefault();
      event.stopImmediatePropagation();
      alert(error.message);
    }
    return;
  }
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
  if (next && next.closest('[data-screen="4"]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const inputs = [...document.querySelectorAll('#lookup-items [data-market-price]')];
    const officialInputs = [...document.querySelectorAll('#lookup-items [data-official-price]')];
    const areaInputs = [...document.querySelectorAll('#lookup-items [data-area-m2]')];
    const missing = [...officialInputs, ...areaInputs, ...inputs].find((input) => !(Number(input.value.replace(/[^0-9.]/g, '')) > 0));
    if (missing) {
      missing.setCustomValidity('계산에 필요한 실제 값을 입력해 주세요.');
      missing.reportValidity();
      missing.focus();
      return;
    }
    inputs.forEach((input, index) => {
      input.setCustomValidity('');
      if (state.properties[index]) {
        state.properties[index].marketPrice = Number(input.value.replace(/[^0-9]/g, ''));
        const fetchedMarket = Number(input.dataset.fetchedMarketPrice || 0);
        state.properties[index].marketPriceSource = fetchedMarket === state.properties[index].marketPrice
          ? 'data.go.kr-trade'
          : 'user-input';
        const officialInput = officialInputs[index];
        const fetched = Number(document.querySelectorAll('#address-fields .property')[index]?.dataset.fetchedOfficialPrice || 0);
        const enteredOfficial = Number(officialInput.value.replace(/[^0-9]/g, ''));
        state.properties[index].officialPrice = enteredOfficial;
        state.properties[index].officialPriceSource = fetched === enteredOfficial ? 'data.go.kr' : 'user-input';
        state.properties[index].areaM2 = Number(areaInputs[index].value.replace(/[^0-9.]/g, ''));
      }
    });
    state.property = state.properties[0];
    const total = state.properties.reduce((sum, property) => sum + property.marketPrice, 0);
    text(document.querySelector('#total-assessed-value'), format(total));
    text(document.querySelector('#summary-assessed-value'), format(total));
    shell.show(5);
    return;
  }
  if (next && next.closest('[data-screen="5"]')) {
    try {
      const acquisitions = acquisitionValues();
      acquisitions.forEach((values, index) => Object.assign(state.properties[index] || {}, values));
    } catch (error) {
      event.preventDefault();
      event.stopImmediatePropagation();
      alert(error.message);
    }
    return;
  }
  if (next && next.closest('[data-screen="6"]')) {
    try {
      numericValue('#rental-deposit', '임차 보증금', { min: 0 });
      numericValue('#medical-reserve', '의료·간병 예비자금', { min: 0 });
    } catch (error) {
      event.preventDefault();
      event.stopImmediatePropagation();
      alert(error.message);
    }
    return;
  }
  if (next && next.closest('[data-screen="7"]')) {
    try {
      numericValue('#monthly-income', '월 연금·소득', { min: 0 });
      numericValue('#target-expense', '필요한 월 생활비', { min: 1 });
      const subject = collectSubject(state.properties);
      renderConfirm(subject, state.property);
    } catch (error) {
      event.preventDefault();
      event.stopImmediatePropagation();
      alert(error.message);
    }
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
    share()
      .then((result) => document.dispatchEvent(new CustomEvent('silver:share-complete', { detail: result })))
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        console.error('[silver] 공유 실패', error);
        document.dispatchEvent(new CustomEvent('silver:share-error', { detail: { message: error.message } }));
      });
  }
  if (event.target.closest('[data-reset-result]')) {
    localStorage.removeItem(SESSION_KEY);
    Object.assign(state, { property: null, properties: [], subject: null, answers: null, advice: null, refinements: {}, chatHistory: [] });
  }
}, true);

document.addEventListener('change', () => {
  if (!state.property) return;
  try {
    const subject = collectSubject(state.properties.length ? state.properties : [state.property]);
    renderConfirm(subject, state.property);
  } catch {
    /* 입력이 모두 끝나기 전에는 확인 화면 갱신을 미룬다. */
  }
});

const hasSharedToken = new URLSearchParams(location.search).has('r');
if (hasSharedToken) {
  try {
    await restoreShared();
  } catch (error) {
    console.error('[silver] 공유 결과 복원 실패', error);
    reportSharedRestoreError(error);
  }
} else {
  const restored = restore();
  if (!restored) {
    localStorage.removeItem('plus-parent-result-complete');
    if (requiresAnalysisResult()) shell?.showStart?.();
  }
}
