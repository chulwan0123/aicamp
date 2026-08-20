const POSTCODE_SCRIPT_URL = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

let postcodeScriptPromise = null;

/**
 * 지번주소 마지막 토큰에서 본번과 부번을 추출한다.
 * 예: "서울특별시 서초구 반포동 20-43" → 0020 / 0043
 */
export function extractJibunNumber(jibunAddress) {
  const cleaned = String(jibunAddress || '').replace(/산\s*/g, '').trim();
  const lastToken = cleaned.split(/\s+/).at(-1) || '0';
  const [bonRaw, buRaw] = lastToken.split('-');
  const bon = (bonRaw || '0').replace(/\D/g, '').padStart(4, '0').slice(-4);
  const bu = (buRaw || '0').replace(/\D/g, '').padStart(4, '0').slice(-4);
  return { bon, bu };
}

/**
 * 다음 주소검색 결과로 19자리 PNU를 만든다.
 * 법정동코드(10) + 산여부(1) + 본번(4) + 부번(4)
 */
export function buildPnu(bcode, mountainYn, jibunAddress) {
  const legalCode = String(bcode || '');
  if (!/^\d{10}$/.test(legalCode)) throw new Error('법정동코드 10자리를 확인해 주세요.');
  const mountainDigit = mountainYn === 'Y' ? '1' : '0';
  const { bon, bu } = extractJibunNumber(jibunAddress);
  const pnu = `${legalCode}${mountainDigit}${bon}${bu}`;
  if (!/^\d{19}$/.test(pnu)) throw new Error('주소에서 PNU를 만들지 못했어요.');
  return pnu;
}

function loadPostcodeScript() {
  if (globalThis.daum?.Postcode) return Promise.resolve();
  if (postcodeScriptPromise) return postcodeScriptPromise;

  postcodeScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${POSTCODE_SCRIPT_URL}"]`);
    const script = existing || document.createElement('script');
    const done = () => globalThis.daum?.Postcode
      ? resolve()
      : reject(new Error('주소 검색 서비스를 불러오지 못했어요.'));

    script.addEventListener('load', done, { once: true });
    script.addEventListener('error', () => reject(new Error('주소 검색 서비스 연결에 실패했어요.')), { once: true });
    if (!existing) {
      script.src = POSTCODE_SCRIPT_URL;
      script.async = true;
      document.head.append(script);
    }
  }).catch((error) => {
    postcodeScriptPromise = null;
    throw error;
  });

  return postcodeScriptPromise;
}

/** 다음 주소검색 팝업을 열고 선택 결과와 PNU를 반환한다. 닫으면 null을 반환한다. */
export async function openAddressSearch() {
  await loadPostcodeScript();
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, 20_000);
    const postcode = new globalThis.daum.Postcode({
      oncomplete(data) {
        try {
          const roadAddress = data.roadAddress || data.jibunAddress || data.address;
          const pnu = buildPnu(data.bcode, data.mountainYn, data.jibunAddress);
          settled = true;
          clearTimeout(timeout);
          resolve({
            roadAddress,
            jibunAddress: data.jibunAddress,
            zonecode: data.zonecode,
            bcode: data.bcode,
            mountainYn: data.mountainYn,
            buildingName: data.buildingName || '',
            apartment: data.apartment || 'N',
            pnu,
          });
        } catch (error) {
          settled = true;
          clearTimeout(timeout);
          reject(error);
        }
      },
      onclose() {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolve(null);
        }
      },
    });

    try {
      postcode.open({ popupTitle: '주소 검색' });
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}
