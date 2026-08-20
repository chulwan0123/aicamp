import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const engine = fs.readFileSync(new URL('../js/silver-engine.js', import.meta.url), 'utf8');
const ogImage = fs.readFileSync(new URL('../assets/og-silver-share.png', import.meta.url));

test('본 화면은 plushome 계약대로 19개다', () => {
  const screens = [...html.matchAll(/<section\b[^>]*\bdata-screen="(\d+)"[^>]*>/g)].map((match) => Number(match[1]));
  assert.deepEqual(screens, Array.from({ length: 19 }, (_, index) => index));
});

test('공유 미리보기는 1200×630 전용 이미지와 일관된 OG 문구를 사용한다', () => {
  assert.equal(ogImage.readUInt32BE(16), 1200);
  assert.equal(ogImage.readUInt32BE(20), 630);
  assert.match(html, /property="og:title" content="부모님 노후 준비, 함께 확인해요"/);
  assert.match(html, /property="og:image" content="https:\/\/aicamp-sigma\.vercel\.app\/assets\/og-silver-share\.png"/);
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(engine, /purpose: 'result'/);
});

test('신규 콘텐츠 상세화면은 기존 카드와 디자인 토큰을 재사용한다', () => {
  assert.match(html, /\.content-detail-visual\{[^}]*border-radius:var\(--radius-xl\);[^}]*background:var\(--color-blue-100\)/);
  assert.match(html, /\.content-detail-card\{[^}]*padding:20px\}/);
  assert.match(html, /\.content-detail-screen \.info\{margin-top:22px\}/);
});

test('입력 흐름은 1/8부터 8/8까지다', () => {
  for (let step = 1; step <= 8; step += 1) assert.match(html, new RegExp(`${step}/8`));
  assert.match(html, /name="q-inheritance"/);
  assert.match(html, /id="monthly-income"/);
  assert.match(html, /id="target-expense"/);
  assert.match(html, /data-residency-years/);
});

test('스플래시는 본 화면 번호와 분리되고 엔진 모듈이 연결된다', () => {
  assert.match(html, /id="start-overlay"/);
  assert.doesNotMatch(html, /id="start-overlay"[^>]*data-screen/);
  assert.match(html, /src="\.\/js\/silver-engine\.js"/);
});

test('주택 입력은 시도·시군구·단지·전용면적 순서이며 도로명주소는 보조 정보로 유지한다', () => {
  assert.match(html, /data-property-sido/);
  assert.match(html, /data-property-sigungu disabled/);
  assert.match(html, /data-complex-query placeholder="단지명을 입력해 주세요"/);
  assert.match(html, /data-area-select disabled/);
  assert.match(html, /data-address-input placeholder="단지를 선택하면 자동으로 입력돼요" readonly/);
  assert.doesNotMatch(html, /value="서울특별시 서초구 신반포로 270"/);
  assert.match(engine, /selectedAreaM2/);
});

test('모바일 탭 화면은 페이지 가로 스크롤을 막고 내부 레일만 유지한다', () => {
  assert.match(html, /\.tab-screen\{[^}]*overflow-x:hidden;[^}]*overflow-y:auto;[^}]*overscroll-behavior-x:none/);
  assert.match(html, /\.content-item\{[^}]*width:100%;[^}]*min-width:0/);
  assert.match(html, /\.news-rail\{[^}]*overflow-x:auto/);
  assert.match(html, /\.my-categories\{[^}]*overflow-x:auto/);
});

test('모바일 편집 필드는 iOS 포커스 확대를 막도록 16px 이상을 사용한다', () => {
  assert.match(html, /@media\(max-width:500px\)\{input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):not\(\[type="hidden"\]\):not\(\[readonly\]\),select,textarea\{font-size:16px\}\}/);
});

test('결과 공유와 상담 버튼 글자는 AI 컨설팅 버튼과 같은 크기와 굵기다', () => {
  assert.match(html, /\.result-status \.ai-consult-button\{[^}]*font-size:17px/);
  assert.match(html, /\.result-cta \.share-primary,\.result-cta \.share-secondary\{font-size:17px;font-weight:700\}/);
});

test('마이페이지의 다섯 바로가기 메뉴 글자는 기존 16px보다 1.5px 작게 표시한다', () => {
  assert.match(html, /\.my-shortcuts \.my-shortcut\{font-size:14\.5px\}/);
  for (const label of ['내 결과', '부모님 초대', '세제 안내', '공지사항', '고객센터']) assert.match(html, new RegExp(label));
});

test('두 줄 모달 제목에서도 닫기 버튼은 첫 줄에 맞춘다', () => {
  assert.match(html, /\.sheet-header\{align-items:flex-start\}\.sheet-close\{flex:0 0 44px;margin-top:-8px\}/);
});

test('홈 소개 문구는 부모님의 뒤에서 두 줄로 나눈다', () => {
  assert.match(html, /부동산과 생활비를 바탕으로 부모님의<br>다음 계획을 살펴보세요\./);
});

test('ZIP 엔진의 전체 결과 계약이 요약과 상세 화면에 연결된다', () => {
  for (const token of [
    '부모님 성향 분석', '네 가지 선택지를 모두 비교했어요', '추천 판단을 자세히 볼까요?',
    '계산 근거와 산식', '2027년 매도 특례 비교',
    '매도·임차 계산 전체 내역', '다운사이징 계산 전체 내역', '왜 이 방법일까요?',
    '대신 이런 점은 감수하셔야 해요', '이건 꼭 확인해 주세요', '매달 이렇게 들어와요',
    '다른 방법은 어떨까요?', '이 순서로 준비하시면 돼요',
    '주택연금 계산 전체 내역', '증여 시 필요한 세금과 현금',
  ]) assert.match(engine, new RegExp(token));
  for (const field of ['profile', 'alternatives', 'excluded', 'evidence', 'refine', 'familyNote']) {
    assert.match(engine, new RegExp(`advice\\.${field}`));
  }
  assert.match(engine, /advice\.refine\.title/);
});

test('분석값 없는 결과 딥링크와 잘못된 공유 토큰은 샘플 결과를 노출하지 않는다', () => {
  assert.match(engine, /current >= 10 && current <= 16/);
  assert.match(engine, /location\.hash === '#ai-consulting'/);
  assert.match(engine, /shell\?\.showStart\?\./);
  assert.match(engine, /clean\.searchParams\.delete\('r'\)/);
  assert.match(engine, /history\.replaceState/);
});
