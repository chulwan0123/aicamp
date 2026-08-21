import test from 'node:test';
import assert from 'node:assert/strict';
import { fmtKoreanMoneyInput } from '../js/format.js';

test('입력 금액을 억·천만 단위로 읽기 쉽게 표시한다', () => {
  assert.equal(fmtKoreanMoneyInput('1,500,000,000'), '15억 원');
  assert.equal(fmtKoreanMoneyInput('50,000,000'), '5천만 원');
  assert.equal(fmtKoreanMoneyInput('1,550,000,000'), '15억 5천만 원');
});

test('비어 있거나 유효하지 않은 금액은 안내를 표시하지 않는다', () => {
  assert.equal(fmtKoreanMoneyInput(''), '');
  assert.equal(fmtKoreanMoneyInput('0'), '');
  assert.equal(fmtKoreanMoneyInput('가격 미정'), '');
});
