const shell = window.SILVER_SHELL;
const GUEST_SESSION_KEY = 'silver-analysis-session-guest-v2';
const RESULT_FLAG_KEY = 'plus-parent-result-complete';
const authState = { authenticated: false, user: null };

function syncAuthUi() {
  const name = document.querySelector('[data-auth-name]');
  if (name) {
    name.textContent = authState.authenticated
      ? `${authState.user?.nickname || '플러스실버 회원'} 님`
      : '로그인 없이 이용 중';
  }

  const serviceButton = document.querySelector('.my-service-list [data-service-action="logout"],.my-service-list [data-auth-action]');
  if (!serviceButton) return;
  serviceButton.dataset.authAction = authState.authenticated ? 'logout' : 'login';
  serviceButton.textContent = authState.authenticated ? '로그아웃' : '카카오톡으로 로그인';
  if (authState.authenticated) {
    serviceButton.dataset.serviceAction = 'logout';
    serviceButton.dataset.logout = '';
    delete serviceButton.dataset.kakaoLogin;
  } else {
    delete serviceButton.dataset.serviceAction;
    delete serviceButton.dataset.logout;
    serviceButton.dataset.kakaoLogin = '';
  }
}

async function loadSession() {
  try {
    const response = await fetch('./api/auth/session', { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error('session');
    const result = await response.json();
    authState.authenticated = Boolean(result.authenticated);
    authState.user = result.user || null;
  } catch {
    authState.authenticated = false;
    authState.user = null;
  }
  window.SILVER_AUTH = authState;
  syncAuthUi();
  document.dispatchEvent(new CustomEvent('silver:auth-ready', { detail: authState }));
}

function startKakaoLogin(button) {
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  location.assign('./api/auth/kakao/start');
}

async function logout() {
  try {
    await fetch('./api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } finally {
    sessionStorage.removeItem(GUEST_SESSION_KEY);
    sessionStorage.removeItem(RESULT_FLAG_KEY);
    authState.authenticated = false;
    authState.user = null;
    window.SILVER_AUTH = authState;
    syncAuthUi();
    document.dispatchEvent(new CustomEvent('silver:auth-ready', { detail: authState }));
    shell?.showStart?.();
  }
}

document.addEventListener('click', (event) => {
  const guestButton = event.target.closest('[data-guest-start]');
  if (guestButton) {
    event.preventDefault();
    return shell?.show?.(0);
  }

  const loginButton = event.target.closest('[data-kakao-login]');
  if (loginButton) {
    event.preventDefault();
    return startKakaoLogin(loginButton);
  }

  if (authState.authenticated && event.target.closest('[data-logout]')) logout();
});

document.addEventListener('silver:service-list-rendered', syncAuthUi);

const authError = new URLSearchParams(location.search).get('auth');
if (authError) {
  history.replaceState(history.state, '', `${location.pathname}${location.hash || '#start'}`);
  queueMicrotask(() => document.dispatchEvent(new CustomEvent('silver:auth-error', { detail: { code: authError } })));
}

window.SILVER_AUTH_READY = loadSession();
