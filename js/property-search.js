import { estimateOfficialPriceFromArea } from './property.js';

const sheet = document.querySelector('#property-picker-sheet');
const sheetTitle = document.querySelector('#property-picker-title');
const sheetSubtitle = document.querySelector('#property-picker-subtitle');
const sheetOptions = document.querySelector('#property-picker-options');
const sheetClose = document.querySelector('#property-picker-close');
const propertyState = new WeakMap();

let manifestPromise = null;
let lastTrigger = null;

function manifest() {
  if (!manifestPromise) {
    manifestPromise = fetch('./api/complexes', { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || '지역 정보를 불러오지 못했어요.');
        return body;
      })
      .catch((error) => {
        manifestPromise = null;
        throw error;
      });
  }
  return manifestPromise;
}

function propertyNodes(property) {
  return {
    sido: property.querySelector('[data-property-sido]'),
    sigungu: property.querySelector('[data-property-sigungu]'),
    query: property.querySelector('[data-complex-query]'),
    search: property.querySelector('[data-complex-search]'),
    area: property.querySelector('[data-area-select]'),
    areaValue: property.querySelector('[data-area-value]'),
    summary: property.querySelector('[data-property-selection-summary]'),
    road: property.querySelector('[data-address-input]'),
  };
}

function selectTrigger(select) {
  return document.querySelector(`[data-select-id="${select.id}"]`);
}

function syncSelectTrigger(select) {
  const trigger = selectTrigger(select);
  const selected = select.options[select.selectedIndex];
  const value = trigger?.querySelector('[data-trigger-value]');
  if (value) value.textContent = selected?.text || '선택해 주세요';
  if (trigger) {
    trigger.disabled = select.disabled;
    trigger.setAttribute('aria-disabled', String(select.disabled));
  }
}

function setOptions(select, options, placeholder) {
  select.replaceChildren();
  select.append(new Option(placeholder, ''));
  options.forEach((item) => select.append(new Option(item.name, item.code || item.name)));
  select.value = '';
  syncSelectTrigger(select);
}

function clearOfficialData(property) {
  for (const key of [
    'officialPrice', 'fetchedOfficialPrice', 'officialPriceYear', 'officialComplexName', 'officialAreaM2',
    'officialDong', 'officialHo', 'officialPriceSource', 'officialPriceEstimated', 'officialPriceError',
  ]) delete property.dataset[key];
  property.dataset.priceConfirmed = 'false';
  document.dispatchEvent(new CustomEvent('silver:property-selection-changed', { detail: { property } }));
}

function resetComplex(property) {
  const nodes = propertyNodes(property);
  propertyState.delete(property);
  delete property.dataset.pnu;
  delete property.dataset.complexName;
  delete property.dataset.areaM2;
  delete property.dataset.selectedRoadAddress;
  nodes.road.value = '';
  nodes.area.disabled = true;
  nodes.areaValue.textContent = '단지를 먼저 선택해 주세요';
  nodes.summary.textContent = '';
  nodes.summary.dataset.visible = 'false';
  clearOfficialData(property);
}

function closeSheet() {
  if (!sheet || sheet.hidden) return;
  sheet.hidden = true;
  document.body.classList.remove('sheet-open');
  lastTrigger?.focus();
  lastTrigger = null;
}

function openSheet(trigger, title, subtitle) {
  lastTrigger = trigger;
  sheetTitle.textContent = title;
  sheetSubtitle.textContent = subtitle || '';
  sheet.hidden = false;
  document.body.classList.add('sheet-open');
  sheetOptions.querySelector('button')?.focus();
}

function status(message) {
  const node = document.createElement('p');
  node.className = 'property-picker-status';
  node.textContent = message;
  sheetOptions.replaceChildren(node);
}

function formatWon(value) {
  const amount = Number(value) || 0;
  const eok = Math.floor(amount / 100_000_000);
  const man = Math.round((amount % 100_000_000) / 10_000);
  if (eok && man) return `${eok}억 ${man.toLocaleString('ko-KR')}만 원`;
  if (eok) return `${eok}억 원`;
  return `${man.toLocaleString('ko-KR')}만 원`;
}

function priceRange(area) {
  if (area.minOfficialPrice === area.maxOfficialPrice) return formatWon(area.minOfficialPrice);
  return `${formatWon(area.minOfficialPrice)} ~ ${formatWon(area.maxOfficialPrice)}`;
}

function selectArea(property, area) {
  const nodes = propertyNodes(property);
  const state = propertyState.get(property);
  const roadAddress = String(state?.complex?.roadAddress || property.dataset.selectedRoadAddress || '').trim();
  if (roadAddress) {
    property.dataset.selectedRoadAddress = roadAddress;
    nodes.road.value = roadAddress;
  }
  property.dataset.areaM2 = String(area.areaM2);
  nodes.areaValue.textContent = `${area.areaM2}㎡ (약 ${Math.round(area.areaM2 * 0.3025)}평)`;
  nodes.summary.textContent = `${state.complex.complexName} · ${nodes.areaValue.textContent}`;
  nodes.summary.dataset.visible = 'true';
  clearOfficialData(property);
  const estimatedOfficialPrice = estimateOfficialPriceFromArea(area);
  if (estimatedOfficialPrice) {
    document.dispatchEvent(new CustomEvent('silver:property-area-selected', {
      detail: {
        property,
        official: {
          pnu: state.complex.pnu,
          complexName: state.complex.complexName,
          officialPrice: estimatedOfficialPrice,
          officialPriceYear: '2025',
          areaM2: area.areaM2,
          dong: null,
          ho: null,
          _source: 'data.go.kr-area-estimate',
        },
      },
    }));
  }
  closeSheet();
}

function showAreas(property, trigger) {
  const state = propertyState.get(property);
  if (!state?.complex?.areas?.length) return;
  const options = state.complex.areas.map((area) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'property-picker-option property-area-option';
    const title = document.createElement('strong');
    title.textContent = `${area.areaM2}㎡ (약 ${Math.round(area.areaM2 * 0.3025)}평)`;
    const units = document.createElement('span');
    units.className = 'area-units';
    units.textContent = `${Number(area.unitCount).toLocaleString('ko-KR')}세대`;
    const prices = document.createElement('span');
    prices.className = 'area-price';
    prices.textContent = `2025년 공시가격 ${priceRange(area)}`;
    button.append(title, units, prices);
    button.addEventListener('click', () => selectArea(property, area));
    return button;
  });
  sheetOptions.replaceChildren(...options);
  openSheet(trigger, '전용면적 선택', `${state.complex.complexName} · 총 ${state.complex.areas.length}개 면적`);
}

function selectComplex(property, complex, trigger) {
  const nodes = propertyNodes(property);
  const roadAddress = String(complex.roadAddress || '').trim();
  if (!roadAddress) {
    status('이 단지의 도로명주소를 확인할 수 없어요. 다른 검색 결과를 선택해 주세요.');
    return;
  }
  clearOfficialData(property);
  propertyState.set(property, { complex });
  property.dataset.pnu = complex.pnu;
  property.dataset.complexName = complex.complexName;
  property.dataset.selectedRoadAddress = roadAddress;
  delete property.dataset.areaM2;
  nodes.query.value = complex.complexName;
  nodes.road.value = roadAddress;
  nodes.area.disabled = false;
  nodes.areaValue.textContent = '전용면적을 선택해 주세요';
  nodes.summary.textContent = `${complex.complexName} · 면적 선택 전`;
  nodes.summary.dataset.visible = 'true';
  document.dispatchEvent(new CustomEvent('silver:property-selection-applied', {
    detail: { property, pnu: complex.pnu, roadAddress },
  }));
  showAreas(property, trigger);
}

async function search(property, trigger) {
  const nodes = propertyNodes(property);
  const districtCode = nodes.sigungu.value;
  const query = nodes.query.value.trim();
  if (!districtCode) {
    nodes.sigungu.setCustomValidity('시/군/구를 선택해 주세요.');
    selectTrigger(nodes.sigungu)?.focus();
    return;
  }
  if (!query) {
    nodes.query.setCustomValidity('단지명을 입력해 주세요.');
    nodes.query.reportValidity();
    return;
  }

  nodes.query.setCustomValidity('');
  status('단지를 찾고 있어요…');
  openSheet(trigger, '단지 선택', `${nodes.sido.value} ${nodes.sigungu.options[nodes.sigungu.selectedIndex]?.text || ''}`);
  trigger.disabled = true;
  try {
    const params = new URLSearchParams({ districtCode, q: query });
    const response = await fetch(`./api/complexes?${params}`, { headers: { Accept: 'application/json' } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || '단지 검색에 실패했어요.');
    if (!body.items?.length) {
      status('입력한 이름과 일치하는 단지를 찾지 못했어요.');
      return;
    }
    const options = body.items.map((complex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'property-picker-option';
      const name = document.createElement('strong');
      name.textContent = complex.complexName;
      const address = document.createElement('span');
      address.textContent = `${complex.roadAddress} · 전용면적 ${complex.areas.length}개`;
      button.append(name, address);
      button.addEventListener('click', () => selectComplex(property, complex, trigger));
      return button;
    });
    sheetOptions.replaceChildren(...options);
    sheetOptions.querySelector('button')?.focus();
  } catch (error) {
    status(error.message || '단지 검색에 실패했어요.');
  } finally {
    trigger.disabled = false;
  }
}

async function populateDistricts(property) {
  const nodes = propertyNodes(property);
  nodes.sigungu.disabled = true;
  setOptions(nodes.sigungu, [], '불러오는 중…');
  try {
    const data = await manifest();
    const region = data.regions?.find((item) => item.name === nodes.sido.value);
    setOptions(nodes.sigungu, region?.districts || [], '시/군/구 선택');
    nodes.sigungu.disabled = !region?.districts?.length;
  } catch (error) {
    setOptions(nodes.sigungu, [], '지역을 불러오지 못했어요');
    nodes.sigungu.disabled = true;
  }
  syncSelectTrigger(nodes.sigungu);
}

function initializeProperty(property) {
  const nodes = propertyNodes(property);
  if (!nodes.sido || property.dataset.propertySearchReady === 'true') return;
  property.dataset.propertySearchReady = 'true';
  syncSelectTrigger(nodes.sido);
  syncSelectTrigger(nodes.sigungu);
  nodes.search.disabled = true;

  nodes.sido.addEventListener('change', async () => {
    resetComplex(property);
    nodes.query.value = '';
    await populateDistricts(property);
    nodes.search.disabled = !nodes.sigungu.value;
  });
  nodes.sigungu.addEventListener('change', () => {
    nodes.sigungu.setCustomValidity('');
    resetComplex(property);
    nodes.query.value = '';
    nodes.search.disabled = !nodes.sigungu.value;
  });
  nodes.query.addEventListener('input', () => {
    nodes.query.setCustomValidity('');
    nodes.search.disabled = !nodes.sigungu.value;
  });
  nodes.query.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    search(property, nodes.search);
  });
  nodes.search.addEventListener('click', () => search(property, nodes.search));
  nodes.area.addEventListener('click', () => showAreas(property, nodes.area));
}

function initialize() {
  document.querySelectorAll('#address-fields .property').forEach(initializeProperty);
}

sheetClose?.addEventListener('click', closeSheet);
sheet?.addEventListener('click', (event) => { if (event.target === sheet) closeSheet(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !sheet?.hidden) closeSheet(); });
document.addEventListener('silver:property-fields-rendered', initialize);
initialize();
