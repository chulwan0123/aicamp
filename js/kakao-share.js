let kakaoSdkPromise;
let kakaoConfigPromise;
let preparedShare;

const RESULT_HASHES = new Set([
  '#result',
  '#tax',
  '#cashflow',
  '#downsizing',
  '#recommendation',
  '#home-pension',
  '#inheritance',
]);

const SHARE_COPY = {
  result: {
    title: '부모님 노후 준비 결과가 도착했어요',
    text: '부동산과 생활비를 바탕으로 정리한 추천과 다음 단계를 함께 확인해 보세요.',
    buttonTitle: '결과 함께 보기',
  },
  invite: {
    title: '부모님, 함께 확인해 주세요',
    text: '우리 가족의 노후 준비 결과와 추천 내용을 안전한 링크에서 확인해 보세요.',
    buttonTitle: '초대 결과 보기',
  },
};

async function createShareToken(session) {
  if (preparedShare?.advice === session?.advice) return preparedShare.promise;
  const promise = fetch('./api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session }),
  }).then(async (response) => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.token) throw new Error(body.error || '공유 링크를 만들지 못했어요.');
    return body.token;
  });
  preparedShare = { advice: session?.advice, promise };
  promise.catch(() => {
    if (preparedShare?.promise === promise) preparedShare = undefined;
  });
  return promise;
}

function resultHash(hash) {
  const normalized = String(hash || '').startsWith('#') ? String(hash) : `#${hash || ''}`;
  return RESULT_HASHES.has(normalized) ? normalized : '#result';
}

async function publicResultUrl() {
  const config = await getKakaoConfig().catch(() => ({}));
  if (config.appUrl) return new URL(config.appUrl);
  return new URL(location.origin + location.pathname);
}

export async function createResultLink(session, options = {}) {
  const [token, url] = await Promise.all([createShareToken(session), publicResultUrl()]);
  url.searchParams.set('r', token);
  url.hash = resultHash(options.hash);
  return { token, url: url.toString() };
}

async function getKakaoConfig() {
  if (kakaoConfigPromise) return kakaoConfigPromise;
  kakaoConfigPromise = fetch('./api/client-config', { cache: 'no-store' }).then(async (response) => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || '카카오톡 공유 설정을 확인하지 못했어요.');
    return body.kakao || {};
  }).catch((error) => {
    kakaoConfigPromise = undefined;
    throw error;
  });
  return kakaoConfigPromise;
}

function appendKakaoSdk(config) {
  if (window.Kakao) return Promise.resolve(window.Kakao);
  if (kakaoSdkPromise) return kakaoSdkPromise;
  kakaoSdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-silver-kakao-sdk]');
    const script = existing || document.createElement('script');
    const done = () => window.Kakao ? resolve(window.Kakao) : reject(new Error('카카오 SDK를 불러오지 못했어요.'));
    script.addEventListener('load', done, { once: true });
    script.addEventListener('error', () => reject(new Error('카카오 SDK 연결에 실패했어요.')), { once: true });
    if (!existing) {
      script.src = config.sdkUrl;
      script.integrity = config.integrity;
      script.crossOrigin = 'anonymous';
      script.dataset.silverKakaoSdk = '';
      document.head.append(script);
    }
  }).catch((error) => {
    kakaoSdkPromise = undefined;
    throw error;
  });
  return kakaoSdkPromise;
}

async function openKakaoShare({ url, title, text, buttonTitle }) {
  const config = await getKakaoConfig();
  if (!config.configured || !config.javascriptKey) {
    const error = new Error('카카오 JavaScript 키가 아직 설정되지 않았어요.');
    error.code = 'KAKAO_NOT_CONFIGURED';
    throw error;
  }
  const Kakao = await appendKakaoSdk(config);
  if (!Kakao.isInitialized()) Kakao.init(config.javascriptKey);
  if (!Kakao.Share?.sendDefault) throw new Error('이 브라우저에서 카카오톡 공유를 시작하지 못했어요.');
  Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title,
      description: text,
      imageUrl: new URL('./assets/og-silver-share.png', url).toString(),
      imageWidth: 1200,
      imageHeight: 630,
      link: { webUrl: url, mobileWebUrl: url },
    },
    buttonTitle,
  });
  return { method: 'kakao', url };
}

export async function preloadKakaoShare() {
  const config = await getKakaoConfig();
  if (!config.configured || !config.javascriptKey) return false;
  const Kakao = await appendKakaoSdk(config);
  if (!Kakao.isInitialized()) Kakao.init(config.javascriptKey);
  return true;
}

export function prepareResultShare(session) {
  return createShareToken(session).then((token) => ({ token }));
}

function copyWithTextarea(value) {
  if (!document.body?.appendChild || !document.execCommand) return false;
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}

async function fallbackShare({ url, title, text }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return { method: 'native', url };
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
    }
  }
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return { method: 'clipboard', url };
    } catch {
      /* 권한이 제한된 WebView에서는 임시 입력 요소 복사를 시도한다. */
    }
  }
  if (copyWithTextarea(url)) return { method: 'clipboard', url };
  throw new Error('이 브라우저에서는 공유 링크를 복사할 수 없어요.');
}

export async function shareResult(session, options = {}) {
  const shared = await createResultLink(session, { hash: options.hash });
  const preset = SHARE_COPY[options.purpose] || SHARE_COPY.result;
  const payload = {
    url: shared.url,
    title: options.title || preset.title,
    text: options.text || preset.text,
    buttonTitle: options.buttonTitle || preset.buttonTitle,
  };
  try {
    return { ...await openKakaoShare(payload), token: shared.token };
  } catch (kakaoError) {
    if (options.kakaoOnly) throw kakaoError;
    const fallback = await fallbackShare(payload);
    return { ...fallback, token: shared.token, kakaoError };
  }
}
