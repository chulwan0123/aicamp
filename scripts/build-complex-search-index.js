import fs from 'node:fs';
import path from 'node:path';
import { createGunzip, gzipSync } from 'node:zlib';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = path.join(ROOT, 'data', 'public-price', '2025');
const OUTPUT_DIR = path.join(ROOT, 'data', 'property-search', '2025');
const GYEONGGI_DISTRICT_NAMES = {
  41111: '수원시 장안구', 41113: '수원시 권선구', 41115: '수원시 팔달구', 41117: '수원시 영통구',
  41131: '성남시 수정구', 41133: '성남시 중원구', 41135: '성남시 분당구',
  41171: '안양시 만안구', 41173: '안양시 동안구',
  41192: '부천시 원미구', 41194: '부천시 소사구', 41196: '부천시 오정구',
  41271: '안산시 상록구', 41273: '안산시 단원구',
  41281: '고양시 덕양구', 41285: '고양시 일산동구', 41287: '고양시 일산서구',
  41461: '용인시 처인구', 41463: '용인시 기흥구', 41465: '용인시 수지구',
};

function regionFromAddress(address) {
  const tokens = String(address || '').trim().split(/\s+/);
  const sido = tokens[0] || '';
  const sigungu = sido === '경기도' && /시$/.test(tokens[1] || '') && /구$/.test(tokens[2] || '')
    ? `${tokens[1]} ${tokens[2]}`
    : tokens[1] || '';
  return { sido, sigungu };
}

function rounded(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

function sortKorean(a, b) {
  return String(a).localeCompare(String(b), 'ko');
}

async function readShard(filename, complexes) {
  const input = fs.createReadStream(path.join(SOURCE_DIR, filename)).pipe(createGunzip());
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    const [pnu, complexName, , , areaValue, priceValue, roadAddress] = line.split('\t');
    const areaM2 = Number(areaValue);
    const officialPrice = Number(priceValue);
    if (!pnu || !complexName || !roadAddress || !(areaM2 > 0) || !(officialPrice > 0)) continue;
    const key = `${pnu}\t${complexName}\t${roadAddress}`;
    let complex = complexes.get(key);
    if (!complex) {
      complex = { pnu, complexName, roadAddress, areas: new Map() };
      complexes.set(key, complex);
    }
    const areaKey = rounded(areaM2).toFixed(3);
    const area = complex.areas.get(areaKey) || {
      areaM2: rounded(areaM2), unitCount: 0, minOfficialPrice: officialPrice, maxOfficialPrice: officialPrice,
    };
    area.unitCount += 1;
    area.minOfficialPrice = Math.min(area.minOfficialPrice, officialPrice);
    area.maxOfficialPrice = Math.max(area.maxOfficialPrice, officialPrice);
    complex.areas.set(areaKey, area);
  }
}

async function main() {
  const sourceManifest = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, 'manifest.json'), 'utf8'));
  const districtShards = new Map();
  for (const shard of Object.keys(sourceManifest.shards || {})) {
    const districtCode = shard.slice(0, 5);
    if (!districtShards.has(districtCode)) districtShards.set(districtCode, []);
    districtShards.get(districtCode).push(`${shard}.tsv.gz`);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const regions = new Map();
  let complexCount = 0;
  for (const [districtCode, shards] of [...districtShards].sort(([a], [b]) => a.localeCompare(b))) {
    const complexes = new Map();
    for (const shard of shards.sort()) await readShard(shard, complexes);
    const items = [...complexes.values()].map((complex) => ({
      pnu: complex.pnu,
      complexName: complex.complexName,
      roadAddress: complex.roadAddress,
      areas: [...complex.areas.values()].sort((a, b) => a.areaM2 - b.areaM2),
    })).sort((a, b) => sortKorean(a.complexName, b.complexName));
    if (!items.length) continue;
    const { sido, sigungu: parsedSigungu } = regionFromAddress(items[0].roadAddress);
    const sigungu = GYEONGGI_DISTRICT_NAMES[districtCode] || parsedSigungu;
    if (!regions.has(sido)) regions.set(sido, []);
    regions.get(sido).push({ code: districtCode, name: sigungu, complexCount: items.length });
    complexCount += items.length;
    fs.writeFileSync(path.join(OUTPUT_DIR, `${districtCode}.json.gz`), gzipSync(JSON.stringify(items), { level: 9 }));
    process.stdout.write(`${districtCode} ${sigungu}: ${items.length.toLocaleString('ko-KR')}개 단지\n`);
  }

  const manifest = {
    schemaVersion: 1,
    baseYear: sourceManifest.baseYear,
    sourceName: sourceManifest.sourceName,
    sourceUrl: sourceManifest.sourceUrl,
    complexCount,
    regions: [...regions].map(([name, districts]) => ({
      name,
      districts: districts.sort((a, b) => sortKorean(a.name, b.name)),
    })),
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`총 ${complexCount.toLocaleString('ko-KR')}개 단지 검색 색인을 만들었습니다.\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
