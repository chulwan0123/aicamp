import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPnu, extractJibunNumber, openAddressSearch } from '../js/address.js';

test('일반 지번 주소로 19자리 PNU를 만든다', () => {
  assert.deepEqual(extractJibunNumber('서울특별시 서초구 반포동 20-43'), { bon: '0020', bu: '0043' });
  assert.equal(buildPnu('1165010700', 'N', '서울특별시 서초구 반포동 20-43'), '1165010700000200043');
});

test('산 지번은 PNU 산 여부 자리를 1로 만든다', () => {
  assert.equal(buildPnu('4215013800', 'Y', '강원특별자치도 강릉시 성산면 산 123'), '4215013800101230000');
});

test('잘못된 법정동코드는 PNU로 만들지 않는다', () => {
  assert.throws(() => buildPnu('123', 'N', '1-1'), /법정동코드/);
});

test('다음 주소검색 선택 결과를 도로명주소와 PNU로 함께 반환한다', async () => {
  const originalDaum = globalThis.daum;
  globalThis.daum = {
    Postcode: function Postcode(options) {
      return {
        open() {
          options.oncomplete({
            roadAddress: '서울특별시 서초구 신반포로 270',
            jibunAddress: '서울특별시 서초구 반포동 20-43',
            address: '서울특별시 서초구 반포동 20-43',
            zonecode: '06544',
            bcode: '1165010700',
            mountainYn: 'N',
          });
        },
      };
    },
  };

  try {
    assert.deepEqual(await openAddressSearch(), {
      roadAddress: '서울특별시 서초구 신반포로 270',
      jibunAddress: '서울특별시 서초구 반포동 20-43',
      zonecode: '06544',
      bcode: '1165010700',
      mountainYn: 'N',
      pnu: '1165010700000200043',
    });
  } finally {
    if (originalDaum === undefined) delete globalThis.daum;
    else globalThis.daum = originalDaum;
  }
});

test('다음 주소검색을 선택하지 않고 닫으면 null을 반환한다', async () => {
  const originalDaum = globalThis.daum;
  globalThis.daum = {
    Postcode: function Postcode(options) {
      return { open() { options.onclose(); } };
    },
  };

  try {
    assert.equal(await openAddressSearch(), null);
  } finally {
    if (originalDaum === undefined) delete globalThis.daum;
    else globalThis.daum = originalDaum;
  }
});
