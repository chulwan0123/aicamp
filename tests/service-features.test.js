import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = fs.readFileSync(new URL('../js/service-features.js', import.meta.url), 'utf8');
const shareSource = fs.readFileSync(new URL('../js/kakao-share.js', import.meta.url), 'utf8');

test('상담·초대·콘텐츠 메뉴 모듈이 기존 화면 뒤에 연결된다', () => {
  assert.match(html, /<script type="module" src="\.\/js\/service-features\.js"><\/script>/);
  for (const selector of ['[data-consult]', '.my-shortcut', '.home-section-more', '.news-banner', '.content-item', '.my-category']) {
    assert.match(source, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('부모님 초대와 전문가 상담은 암호화 공유 결과를 재사용한다', () => {
  assert.match(source, /import \{ createResultLink, shareResult \} from '\.\/kakao-share\.js'/);
  assert.match(source, /fetch\('\.\/api\/consultations'/);
  assert.match(source, /resultToken: shared\.token/);
  assert.match(source, /링크는 7일 후 만료/);
});

test('결과 공유와 부모님 초대는 카카오 공식 SDK 호출을 우선 사용한다', () => {
  assert.match(shareSource, /Kakao\.Share\.sendDefault/);
  assert.match(shareSource, /objectType: 'feed'/);
  assert.match(shareSource, /fetch\('\.\/api\/client-config'/);
  assert.match(shareSource, /navigator\.share/);
  assert.match(shareSource, /navigator\.clipboard/);
  assert.doesNotMatch(shareSource, /[a-f0-9]{32}/i);
});

test('알림 설정과 로그아웃은 브라우저 기능과 저장 상태에 연결된다', () => {
  assert.match(source, /Notification\.requestPermission/);
  assert.match(source, /new Notification\('SILVER 알림 설정 완료'/);
  assert.match(source, /localStorage\.removeItem\(SESSION_KEY\)/);
  assert.match(source, /localStorage\.removeItem\('plus-parent-result-complete'\)/);
});

test('만료되거나 변조된 공유 링크 오류를 사용자에게 보여준다', () => {
  assert.match(source, /silver:shared-restore-error/);
  assert.match(source, /공유 결과를 열 수 없어요/);
  assert.match(source, /새 링크를 요청해 주세요/);
  assert.match(source, /window\.SILVER_SHARED_RESTORE_ERROR/);
});

test('홈의 일곱 콘텐츠는 각각 고유 상세 URL과 기존 에셋을 사용한다', () => {
  for (const slug of [
    'tax-change', 'home-pension-income', 'inheritance-family-check', 'jongbu-2027',
    'home-pension-checklist', 'downsizing-timing', 'family-conversation',
  ]) assert.match(source, new RegExp(`slug: '${slug}'`));
  for (const asset of [
    'news-tax-cash.png', 'news-home-pension.png', 'start-card-parents.png',
    'content/calculator.png', 'content/house.png', 'content/moving-box.png', 'content/teacup.png',
  ]) assert.match(source, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal((source.match(/slug: '/g) || []).length, 7);
  assert.match(source, /`#content\/\$\{article\.slug\}`/);
});

test('콘텐츠 상세화면은 19개 본 화면 밖에서 히스토리와 분석 결과를 보호한다', () => {
  assert.match(source, /screen\.id = 'content-detail-screen'/);
  assert.match(source, /window\.addEventListener\('popstate', syncContentRoute\)/);
  assert.match(source, /window\.addEventListener\('hashchange', syncContentRoute\)/);
  assert.match(source, /article\.action !== 18 && !requireResult\(\)/);
  assert.doesNotMatch(source, /content-detail-screen[^\n]*data-screen/);
});
