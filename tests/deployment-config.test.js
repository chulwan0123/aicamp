import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const vercelIgnore = fs.readFileSync(new URL('../.vercelignore', import.meta.url), 'utf8').split(/\r?\n/);

test('루트 QA 이미지 제외 규칙이 assets의 SILVER 로고까지 제외하지 않는다', () => {
  assert.ok(vercelIgnore.includes('/silver-*.png'));
  assert.ok(vercelIgnore.includes('/exec-*.png'));
  assert.equal(vercelIgnore.includes('silver-*.png'), false);
  assert.equal(vercelIgnore.includes('exec-*.png'), false);
  assert.equal(fs.existsSync(new URL('../assets/silver-logo.png', import.meta.url)), true);
  assert.equal(fs.existsSync(new URL('../assets/silver-logo-white.png', import.meta.url)), true);
  assert.equal(fs.existsSync(new URL('../assets/silver-favicon.svg', import.meta.url)), true);
});

test('SILVER 로고와 파비콘은 배포 캐시를 갱신하는 경로로 연결된다', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(html, /silver-favicon\.svg\?v=20260821/);
  assert.match(html, /silver-logo\.png\?v=20260821/);
  assert.match(html, /silver-logo-white\.png\?v=20260821/);
});
