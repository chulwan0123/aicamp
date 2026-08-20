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
});
