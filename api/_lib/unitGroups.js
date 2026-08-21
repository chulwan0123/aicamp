import { normalizeItem } from '../price.js';

const byUnitToken = (left, right) => String(left).localeCompare(String(right), 'ko-KR', {
  numeric: true,
  sensitivity: 'base',
});

export function groupUnitsByDong(items, areaM2) {
  const targetArea = Number(areaM2);
  if (!(targetArea > 0)) return [];

  const grouped = new Map();
  for (const raw of items) {
    const item = normalizeItem(raw);
    if (!item.dongNm || !item.hoNm || !(item.pblntfPc > 0)) continue;
    if (item.areaM2 !== null && Math.abs(item.areaM2 - targetArea) > 0.001) continue;
    if (!grouped.has(item.dongNm)) grouped.set(item.dongNm, new Map());
    grouped.get(item.dongNm).set(item.hoNm, {
      ho: item.hoNm,
      officialPrice: item.pblntfPc,
      officialPriceYear: item.stdrYear,
      areaM2: item.areaM2,
    });
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => byUnitToken(left, right))
    .map(([dong, homes]) => ({
      dong,
      homes: [...homes.values()].sort((left, right) => byUnitToken(left.ho, right.ho)),
    }));
}
