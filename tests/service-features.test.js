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
