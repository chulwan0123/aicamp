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
    unit: property.querySelector('[data-unit-select]'),
    unitValue: property.querySelector('[data-unit-value]'),
    detail: property.querySelector('[data-detail-input]'),
    summary: property.querySelector('[data-property-selection-summary]'),
    road: property.querySelector('[data-address-input]'),
  };
}

function clearUnitSelection(property, { disabled = true } = {}) {
  const nodes = propertyNodes(property);
  if (nodes.detail) nodes.detail.value = '';
  if (nodes.unit) nodes.unit.disabled = disabled;
  if (nodes.unitValue) nodes.unitValue.textContent = disabled
    ? '전용면적을 먼저 선택해 주세요'
    : '동·호수를 선택하면 정확한 가격을 확인해요';
  delete property.dataset.selectedDong;
  delete property.dataset.selectedHo;
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
  clearUnitSelection(property);
  clearOfficialData(property);
}

function resetSelectionForManualAddress(property) {
  const nodes = propertyNodes(property);
  const roadAddress = nodes.road.value;
  propertyState.delete(property);
  delete property.dataset.pnu;
  delete property.dataset.complexName;
  delete property.dataset.areaM2;
  delete property.dataset.selectedRoadAddress;
  nodes.query.value = '';
  nodes.area.disabled = true;
  nodes.areaValue.textContent = '단지를 먼저 선택해 주세요';
  nodes.summary.textContent = '';
  nodes.summary.dataset.visible = 'false';
  clearUnitSelection(property);
  clearOfficialData(property);
  nodes.road.value = roadAddress;
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
  state.area = area;
  delete state.units;
  nodes.areaValue.textContent = `${area.areaM2}㎡ (약 ${Math.round(area.areaM2 * 0.3025)}평)`;
  nodes.summary.textContent = `${state.complex.complexName} · ${nodes.areaValue.textContent}`;
  nodes.summary.dataset.visible = 'true';
  clearUnitSelection(property, { disabled: false });
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

function selectHome(property, dong, home) {
  const nodes = propertyNodes(property);
  const state = propertyState.get(property);
  const detail = `${dong}동 ${home.ho}호`;
  nodes.detail.value = detail;
  nodes.unitValue.textContent = detail;
  property.dataset.selectedDong = dong;
  property.dataset.selectedHo = home.ho;
  clearOfficialData(property);
  document.dispatchEvent(new CustomEvent('silver:property-unit-selected', {
    detail: {
      property,
      official: {
        pnu: state.complex.pnu,
        complexName: state.complex.complexName,
        officialPrice: home.officialPrice,
        officialPriceYear: home.officialPriceYear || '2025',
        areaM2: home.areaM2 || state.area.areaM2,
        dong: `${dong}동`,
        ho: `${home.ho}호`,
        _source: 'data.go.kr-file-shard',
      },
    },
  }));
  closeSheet();
}

function showHomes(property, dongGroup, trigger) {
  const state = propertyState.get(property);
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'property-picker-option property-unit-back';
  back.textContent = '← 동을 다시 선택할게요';
  back.addEventListener('click', () => showDongs(property, trigger));
  const options = dongGroup.homes.map((home) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'property-picker-option property-area-option';
    const title = document.createElement('strong');
    title.textContent = `${home.ho}호`;
    const price = document.createElement('span');
    price.className = 'area-price';
    price.textContent = `${home.officialPriceYear || '2025'}년 공시가격 ${formatWon(home.officialPrice)}`;
    button.append(title, price);
    button.addEventListener('click', () => selectHome(property, dongGroup.dong, home));
    return button;
  });
  sheetOptions.replaceChildren(back, ...options);
  sheetTitle.textContent = '호수 선택';
  sheetSubtitle.textContent = `${state.complex.complexName} · ${dongGroup.dong}동 · ${state.area.areaM2}㎡`;
  sheetOptions.querySelector('button')?.focus();
}

function renderDongs(property, trigger) {
  const state = propertyState.get(property);
  const options = state.units.dongs.map((dongGroup) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'property-picker-option property-area-option';
    const title = document.createElement('strong');
    title.textContent = `${dongGroup.dong}동`;
    const count = document.createElement('span');
    count.className = 'area-units';
    count.textContent = `${dongGroup.homes.length.toLocaleString('ko-KR')}개 호수`;
    button.append(title, count);
    button.addEventListener('click', () => showHomes(property, dongGroup, trigger));
    return button;
  });
  sheetOptions.replaceChildren(...options);
  openSheet(trigger, '동 선택', `${state.complex.complexName} · ${state.area.areaM2}㎡`);
}

async function showDongs(property, trigger) {
  const state = propertyState.get(property);
  if (!state?.complex || !state?.area) return;
  if (state.units?.dongs?.length) {
    renderDongs(property, trigger);
    return;
  }
  status('선택할 수 있는 동·호수를 찾고 있어요…');
  openSheet(trigger, '동 선택', `${state.complex.complexName} · ${state.area.areaM2}㎡`);
  try {
    const params = new URLSearchParams({ pnu: state.complex.pnu, areaM2: String(state.area.areaM2) });
    const response = await fetch(`./api/units?${params}`, { headers: { Accept: 'application/json' } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || '동·호수 목록을 불러오지 못했어요.');
    state.units = body;
    renderDongs(property, trigger);
  } catch (error) {
    status(error.message || '동·호수 목록을 불러오지 못했어요. 유사 공시가격으로 계속할 수 있어요.');
  }
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
  clearUnitSelection(property);
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

async function applyAddressSelection(property, selected, trigger) {
  const nodes = propertyNodes(property);
  const sidoName = selected.roadAddress.startsWith('서울') ? '서울특별시' : '경기도';
  const districtCode = String(selected.pnu || '').slice(0, 5);
  nodes.sido.value = sidoName;
  syncSelectTrigger(nodes.sido);
  await populateDistricts(property);
  nodes.sigungu.value = districtCode;
  syncSelectTrigger(nodes.sigungu);
  nodes.search.disabled = false;
  nodes.road.value = selected.roadAddress;
  property.dataset.selectedRoadAddress = selected.roadAddress;
  property.dataset.pnu = selected.pnu;

  status('주소와 일치하는 단지를 찾고 있어요…');
  openSheet(trigger, '단지 확인', selected.roadAddress);
  try {
    const params = new URLSearchParams({ districtCode, pnu: selected.pnu });
    const response = await fetch(`./api/complexes?${params}`, { headers: { Accept: 'application/json' } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || '주소와 일치하는 단지를 찾지 못했어요.');
    const complex = body.items?.[0];
    if (!complex) {
      nodes.query.value = selected.buildingName || '';
      status('주소는 입력했어요. 단지명을 확인한 뒤 검색해 주세요.');
      return;
    }
    nodes.query.value = complex.complexName;
    selectComplex(property, complex, trigger);
  } catch (error) {
    nodes.query.value = selected.buildingName || '';
    status(error.message || '주소는 입력했어요. 단지명을 확인한 뒤 검색해 주세요.');
  }
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
  nodes.unit.addEventListener('click', () => showDongs(property, nodes.unit));
  nodes.road.addEventListener('input', () => {
    if (nodes.road.value.trim() !== String(property.dataset.selectedRoadAddress || '').trim()) {
      resetSelectionForManualAddress(property);
    }
  });
}

function initialize() {
  document.querySelectorAll('#address-fields .property').forEach(initializeProperty);
}

sheetClose?.addEventListener('click', closeSheet);
sheet?.addEventListener('click', (event) => { if (event.target === sheet) closeSheet(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !sheet?.hidden) closeSheet(); });
document.addEventListener('silver:property-fields-rendered', initialize);
document.addEventListener('silver:address-search-selected', (event) => {
  const property = event.detail?.property;
  const selected = event.detail?.selected;
  const trigger = event.detail?.trigger;
  if (property && selected && trigger) applyAddressSelection(property, selected, trigger);
});
initialize();
