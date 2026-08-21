/** 금액·비율 표기 유틸. 70세가 읽는 화면이므로 억/만원 한글 단위를 쓴다. */

/**
 * 표시용 반올림 — 모두 예상치이므로 끝자리까지 보여줄 이유가 없다.
 * 1,000만원 이상은 만원 단위, 그 미만은 천원 단위로 맞춘다.
 */
function displayRound(n) {
  const abs = Math.abs(n);
  if (abs >= 10_000_000) return Math.round(n / 10_000) * 10_000;
  if (abs >= 10_000) return Math.round(n / 1_000) * 1_000;
  return Math.round(n);
}

export function fmtKRW(value, { exact = false } = {}) {
  const raw = Number(value) || 0;
  const negative = raw < 0;
  const n = Math.abs(exact ? Math.round(raw) : displayRound(raw));
  if (n === 0) return '0원';

  const eok = Math.floor(n / 1e8);
  const man = Math.floor((n % 1e8) / 1e4);
  const won = n % 1e4;
  const parts = [];

  if (eok) parts.push(`${eok.toLocaleString('ko-KR')}억`);
  if (man) parts.push(`${man.toLocaleString('ko-KR')}만`);
  if (won) parts.push((eok || man) && won % 1000 === 0 ? `${won / 1000}천` : won.toLocaleString('ko-KR'));

  return `${negative ? '-' : ''}${parts.join(' ')}원`;
}

/**
 * 입력 중인 원 단위 금액을 바로 읽을 수 있는 큰 단위로 바꾼다.
 * 예: 1,500,000,000 → 15억 원, 50,000,000 → 5천만 원
 */
export function fmtKoreanMoneyInput(value) {
  const digits = String(value ?? '').replace(/[^0-9]/g, '');
  const amount = Number(digits);
  if (!Number.isSafeInteger(amount) || amount <= 0) return '';

  const eok = Math.floor(amount / 100_000_000);
  const man = Math.floor((amount % 100_000_000) / 10_000);
  const won = amount % 10_000;
  const parts = [];

  if (eok) parts.push(`${eok.toLocaleString('ko-KR')}억`);
  if (man) {
    const readableMan = man >= 1_000 && man % 1_000 === 0
      ? `${man / 1_000}천`
      : man.toLocaleString('ko-KR');
    parts.push(`${readableMan}만`);
  }
  if (won) parts.push(`${won.toLocaleString('ko-KR')}원`);

  return won ? parts.join(' ') : `${parts.join(' ')} 원`;
}

/** 부호를 앞에 붙여 차감 항목임을 드러낸다. */
export function fmtSigned(value, options) {
  return value < 0 ? `- ${fmtKRW(Math.abs(value), options)}` : fmtKRW(value, options);
}

export function fmtPercent(ratio, digits = 0) {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** 줄바꿈을 <br>로 — LLM이 준 문단 텍스트를 안전하게 표시할 때 쓴다. */
export function escapeMultiline(value) {
  return escapeHtml(value).replace(/\n/g, '<br>');
}
