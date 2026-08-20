import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const engine = fs.readFileSync(new URL('../js/silver-engine.js', import.meta.url), 'utf8');

test('본 화면은 plushome 계약대로 19개다', () => {
  const screens = [...html.matchAll(/<section\b[^>]*\bdata-screen="(\d+)"[^>]*>/g)].map((match) => Number(match[1]));
  assert.deepEqual(screens, Array.from({ length: 19 }, (_, index) => index));
});

test('입력 흐름은 1/8부터 8/8까지다', () => {
  for (let step = 1; step <= 8; step += 1) assert.match(html, new RegExp(`${step}/8`));
  assert.match(html, /name="q-inheritance"/);
  assert.match(html, /name="q-income"/);
  assert.match(html, /id="residency-years"/);
});

test('스플래시는 본 화면 번호와 분리되고 엔진 모듈이 연결된다', () => {
  assert.match(html, /id="start-overlay"/);
  assert.doesNotMatch(html, /id="start-overlay"[^>]*data-screen/);
  assert.match(html, /src="\.\/js\/silver-engine\.js"/);
});

test('도로명주소는 다음 주소검색으로만 변경해 PNU와 어긋나지 않는다', () => {
  assert.match(html, /data-address-input readonly/);
  assert.match(html, /aria-haspopup="dialog">주소 검색/);
  assert.match(html, /pnu:"1165010700000200043"/);
});

test('ZIP 엔진의 전체 결과 계약이 요약과 상세 화면에 연결된다', () => {
  for (const token of [
    '부모님 성향 분석', '네 가지 선택지를 모두 비교했어요', '추천 판단을 자세히 볼까요?',
    '계산 근거와 산식', '2027년 매도 특례 비교',
    '매도·임차 계산 전체 내역', '다운사이징 계산 전체 내역', '추천 근거와 다른 선택지',
    '주택연금 계산 전체 내역', '증여 시 필요한 세금과 현금',
  ]) assert.match(engine, new RegExp(token));
  for (const field of ['profile', 'alternatives', 'excluded', 'evidence', 'refine', 'familyNote']) {
    assert.match(engine, new RegExp(`advice\\.${field}`));
  }
  assert.match(engine, /advice\.refine\.title/);
});
