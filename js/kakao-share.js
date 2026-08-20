let kakaoSdkPromise;

export async function createResultLink(session) {
  const response = await fetch('./api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.token) throw new Error(body.error || '공유 링크를 만들지 못했어요.');
  const url = new URL(location.origin + location.pathname);
  url.searchParams.set('r', body.token);
  url.hash = 'result';
  return { token: body.token, url: url.toString() };
}

async function getKakaoConfig() {
  const response = await fetch('./api/client-config', { cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || '카카오톡 공유 설정을 확인하지 못했어요.');
  return body.kakao || {};
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

async function openKakaoShare({ url, title, text }) {
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
      imageUrl: new URL('./assets/start-card-parents.png', document.baseURI).toString(),
      link: { webUrl: url },
    },
    buttonTitle: '분석 결과 확인하기',
  });
  return { method: 'kakao', url };
}

async function fallbackShare({ url, title, text }) {
  if (navigator.share) {
    await navigator.share({ title, text, url });
    return { method: 'native', url };
  }
  if (!navigator.clipboard?.writeText) throw new Error('이 브라우저에서는 공유 링크를 복사할 수 없어요.');
  await navigator.clipboard.writeText(url);
  return { method: 'clipboard', url };
}

export async function shareResult(session, options = {}) {
  const shared = await createResultLink(session);
  const payload = {
    url: shared.url,
    title: options.title || '부모님 노후 준비 결과',
    text: options.text || session?.advice?.familyNote || '부모님과 함께 노후 준비 결과를 확인해 보세요.',
  };
  try {
    return { ...await openKakaoShare(payload), token: shared.token };
  } catch (kakaoError) {
    if (options.kakaoOnly) throw kakaoError;
    const fallback = await fallbackShare(payload);
    return { ...fallback, token: shared.token, kakaoError };
  }
}
