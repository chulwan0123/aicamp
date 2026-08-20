import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { createHash } from 'node:crypto';

const SOURCE_URL = 'https://www.data.go.kr/data/3073746/fileData.do';
const ALLOWED_SIDO = new Set(['서울특별시', '경기도']);
const SHARD_PREFIX_LENGTH = 7;

function parseCsvLine(line) {
  const fields = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      fields.push(value);
      value = '';
    } else {
      value += char;
    }
  }
  fields.push(value);
  return fields;
}

function clean(value) {
  return String(value || '').replace(/[\t\r\n]/g, ' ').trim();
}

function padLot(value) {
  return String(Number(value) || 0).padStart(4, '0');
}

async function finishStreams(streams) {
  await Promise.all([...streams.values()].map((stream) => new Promise((resolvePromise, reject) => {
    stream.once('error', reject);
    stream.end(resolvePromise);
  })));
}

async function mapLimit(items, limit, worker) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]);
    }
  }));
}

async function sha256File(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function main() {
  if (!process.argv[2]) throw new Error('공시가격 ZIP 경로가 필요합니다.');
  const sourceZip = resolve(process.argv[2]);
  const outputRoot = resolve(process.argv[3] || 'data/public-price/2025');
  await fs.access(sourceZip);

  const listing = spawnSync('bsdtar', ['-tf', sourceZip], { encoding: 'utf8' });
  if (listing.status !== 0) throw new Error(listing.stderr || 'ZIP 파일 목록을 읽지 못했습니다.');
  const entry = listing.stdout.split(/\r?\n/)
    .find((name) => name.endsWith('.csv') && !name.includes('샘플데이터'));
  if (!entry) throw new Error('ZIP에서 전체 공시가격 CSV를 찾지 못했습니다.');

  const tempRoot = await fs.mkdtemp(join(tmpdir(), 'silver-public-price-'));
  const streams = new Map();
  const shardCounts = new Map();
  const sidoCounts = { 서울특별시: 0, 경기도: 0 };
  let totalRows = 0;

  const archive = spawn('bsdtar', ['-xOf', sourceZip, entry], { stdio: ['ignore', 'pipe', 'inherit'] });
  const archiveExit = new Promise((resolvePromise, reject) => {
    archive.once('error', reject);
    archive.once('close', resolvePromise);
  });
  const lines = createInterface({ input: archive.stdout, crlfDelay: Infinity });
  let headerChecked = false;

  for await (const line of lines) {
    if (!line) continue;
    const fields = parseCsvLine(line);
    if (!headerChecked) {
      headerChecked = true;
      if (fields[0] !== '기준연도' || fields[16] !== '공시가격') {
        throw new Error('예상한 공시가격 CSV 헤더가 아닙니다.');
      }
      continue;
    }

    const [
      baseYear, , legalDongCode, roadAddress, sido, , , , specialCode,
      mainLot, subLot, , complexName, dongName, hoName, areaM2, officialPrice,
      complexCode, dongCode, hoCode, buildingLedgerPk,
    ] = fields;
    if (baseYear !== '2025' || !ALLOWED_SIDO.has(sido)) continue;
    if (!/^\d{10}$/.test(legalDongCode) || !officialPrice) continue;

    const pnu = `${legalDongCode}${specialCode === '1' ? '1' : '0'}${padLot(mainLot)}${padLot(subLot)}`;
    const shard = pnu.slice(0, SHARD_PREFIX_LENGTH);
    if (!streams.has(shard)) {
      streams.set(shard, createWriteStream(join(tempRoot, `${shard}.tsv`), { encoding: 'utf8' }));
    }
    const record = [
      pnu, complexName, dongName, hoName, areaM2, officialPrice, roadAddress,
      complexCode, dongCode, hoCode, buildingLedgerPk,
    ].map(clean).join('\t');
    if (!streams.get(shard).write(`${record}\n`)) {
      await new Promise((resolvePromise) => streams.get(shard).once('drain', resolvePromise));
    }
    shardCounts.set(shard, (shardCounts.get(shard) || 0) + 1);
    sidoCounts[sido] += 1;
    totalRows += 1;
  }

  const archiveExitCode = await archiveExit;
  if (archiveExitCode !== 0) throw new Error(`bsdtar가 ${archiveExitCode} 코드로 종료됐습니다.`);
  await finishStreams(streams);

  await fs.mkdir(outputRoot, { recursive: true });
  const existing = await fs.readdir(outputRoot).catch(() => []);
  await Promise.all(existing
    .filter((name) => /^\d{7}\.tsv\.gz$/.test(name))
    .map((name) => fs.unlink(join(outputRoot, name))));

  const shards = [...shardCounts.keys()].sort();
  await mapLimit(shards, 4, async (shard) => {
    await pipeline(
      createReadStream(join(tempRoot, `${shard}.tsv`)),
      createGzip({ level: 9 }),
      createWriteStream(join(outputRoot, `${shard}.tsv.gz`)),
    );
  });

  const shardMetadata = {};
  for (const shard of shards) {
    const stats = await fs.stat(join(outputRoot, `${shard}.tsv.gz`));
    shardMetadata[shard] = { rows: shardCounts.get(shard), bytes: stats.size };
  }
  const manifest = {
    schemaVersion: 1,
    baseYear: 2025,
    sourceName: '국토교통부_주택 공시가격 정보_20250626',
    sourceUrl: SOURCE_URL,
    sourceArchive: basename(sourceZip),
    sourceArchiveSha256: await sha256File(sourceZip),
    regions: ['서울특별시', '경기도'],
    rowCount: totalRows,
    regionCounts: sidoCounts,
    shardPrefixLength: SHARD_PREFIX_LENGTH,
    fields: ['pnu', 'complexName', 'dongName', 'hoName', 'areaM2', 'officialPrice', 'roadAddress', 'complexCode', 'dongCode', 'hoCode', 'buildingLedgerPk'],
    shards: shardMetadata,
  };
  await fs.writeFile(join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.rm(tempRoot, { recursive: true, force: true });

  const totalBytes = Object.values(shardMetadata).reduce((sum, item) => sum + item.bytes, 0);
  console.log(JSON.stringify({ outputRoot, rowCount: totalRows, shardCount: shards.length, totalBytes, regionCounts: sidoCounts }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
