import { createResultLink, shareResult } from './kakao-share.js';

const SESSION_KEY = 'silver-analysis-session-v2';
const GUEST_SESSION_KEY = 'silver-analysis-session-guest-v2';
const NOTIFICATION_KEY = 'silver-notification-preference-v1';
const shell = window.SILVER_SHELL;

const ARTICLES = [
  {
    slug: 'tax-change',
    category: '자산관리 뉴스',
    image: './assets/news-tax-cash.png',
    title: '달라지는 부동산 세금, 부모님께 미치는 영향',
    description: '보유·거주·매각 단계에서 부모님 주택에 영향을 줄 수 있는 항목을 함께 확인해요.',
    points: ['공시가격과 주택 수에 따른 보유세', '취득가와 거주기간에 따른 매각 세금', '시행 전 개편안의 확정 여부'],
    sections: [
      ['집을 보유하는 동안', '보유세는 현재 매매가격이 아니라 공시가격, 주택 수, 명의와 거주 조건을 중심으로 살펴봐요. 여러 채를 보유했다면 한 채만 보지 않고 전체 주택을 함께 확인해야 해요.'],
      ['집을 매도할 때', '취득가와 필요경비, 실제 보유·거주기간이 매각 세금에 영향을 줘요. 계약 전에 등기와 취득 당시 서류를 먼저 모아 두는 것이 좋아요.'],
      ['개편안과 확정 법령 구분하기', '발표된 개편안은 시행 시점과 세부 요건이 달라질 수 있어요. 실행하는 연도의 확정 법령과 부모님의 실제 서류로 다시 계산해 주세요.'],
    ],
    action: 18,
  },
  {
    slug: 'home-pension-income',
    category: '자산관리 뉴스',
    image: './assets/news-home-pension.png',
    title: '주택연금으로 만드는 안정적인 월 생활비',
    description: '집에 계속 거주하면서 매달 받을 수 있는 금액과 가입 조건을 살펴봐요.',
    points: ['부부 중 연소자 연령', '대상 주택의 공시가격', '지급 방식과 실제 심사 조건'],
    sections: [
      ['연령을 함께 확인해요', '부부가 함께 이용하는 경우에는 두 분의 연령 조건을 같이 확인해야 해요. 같은 집이라도 가입 시점에 따라 예상 월 금액이 달라질 수 있어요.'],
      ['공시가격과 심사 조건을 봐요', '현재 시세만으로 가입 가능 여부를 판단하지 않아요. 대상 주택의 공시가격과 실제 권리관계, 거주 상태를 공식 심사에서 다시 확인해요.'],
      ['생활비 부족액과 비교해요', '예상 월 수령액이 크다는 이유만으로 결정하지 말고, 기존 연금소득과 보유세를 함께 반영해 실제로 쓸 수 있는 월 금액을 비교해 보세요.'],
    ],
    action: 15,
  },
  {
    slug: 'inheritance-family-check',
    category: '자산관리 뉴스',
    image: './assets/start-card-parents.png',
    title: '상속 전에 가족이 함께 확인해야 할 것들',
    description: '부모님의 거주 의향과 생활비를 먼저 확인한 뒤 자산 이전 순서를 정해요.',
    points: ['부모님의 장기 거주 의향', '현재와 향후의 월 생활비', '공동명의와 가족별 이전 계획'],
    sections: [
      ['거주 의향부터 들어요', '집을 언제 누구에게 이전할지보다 부모님이 현재 집에서 얼마나 더 살고 싶은지 먼저 확인해요. 거주 계획이 정해져야 다른 선택지도 비교할 수 있어요.'],
      ['평생 생활비를 먼저 남겨요', '증여나 상속 계획을 세우기 전에 생활비와 의료·돌봄비 재원을 분리해 두는 것이 중요해요. 자산 이전 뒤에도 부모님의 현금흐름이 유지돼야 해요.'],
      ['명의와 가족별 계획을 기록해요', '공동명의 여부와 자녀별 역할, 필요한 세금과 현금을 한 문서에 정리해요. 실행 전에는 세무·법률 전문가에게 실제 서류를 보여주고 확인해 주세요.'],
    ],
    action: 16,
  },
  {
    slug: 'jongbu-2027',
    category: '부모님과 함께 읽기',
    image: './assets/content/calculator.png',
    title: '2027년 종부세, 무엇이 달라질까요?',
    description: '거주 1주택 기본공제와 공정시장가액비율 변화를 현재 분석 결과와 함께 확인해요.',
    points: ['거주 여부에 따른 기본공제', '공정시장가액비율 적용 시점', '확정 법령과 실제 고지액 재확인'],
    sections: [
      ['확정된 내용과 예정 내용을 나눠요', '세제개편안의 수치와 시행 시기는 국회 심의와 후속 법령에 따라 바뀔 수 있어요. 서비스 결과에서는 예정 규칙을 별도로 표시하고 현재 규칙과 구분해요.'],
      ['우리 집 입력값으로 비교해요', '공시가격, 주택 수, 명의와 실제 거주 여부가 달라지면 같은 개편안도 결과가 달라져요. 부모님 주택 전체를 입력한 결과로 비교해 주세요.'],
      ['고지 전에 다시 확인해요', '예상 보유세는 의사결정을 돕는 값이에요. 실제 납부 전에는 해당 연도의 확정 법령과 공시가격, 세무서·지방자치단체 안내를 다시 확인해야 해요.'],
    ],
    action: 18,
  },
  {
    slug: 'home-pension-checklist',
    category: '부모님과 함께 읽기',
    image: './assets/content/house.png',
    title: '주택연금 가입 전 확인할 세 가지',
    description: '부모님 연령과 주택가격, 거주 계획에 따라 가입 가능 여부와 월 수령액이 달라져요.',
    points: ['연령과 주택가격 기준', '계속 거주할 계획', '심사 시점의 공식 예상액'],
    sections: [
      ['두 분의 연령을 확인해요', '부부가 함께 거주한다면 두 분의 연령과 가입 시점을 같이 살펴봐요. 예상 금액은 현재 입력한 연령대를 기준으로 한 값이므로 공식 상담에서는 생년월일로 다시 확인해요.'],
      ['집의 가격 기준을 구분해요', '현재 예상 매매가격과 공시가격은 쓰임이 달라요. 가입 가능 여부와 담보가치 판단에 어떤 가격이 사용되는지 공식 심사에서 확인해 주세요.'],
      ['지급 방식과 장기 계획을 비교해요', '매달 같은 금액을 받는 방식 외에도 선택 가능한 지급 구조와 중도 변경 조건을 확인해요. 보유세와 향후 상속 계획도 함께 비교해야 해요.'],
    ],
    action: 15,
  },
  {
    slug: 'downsizing-timing',
    category: '부모님과 함께 읽기',
    image: './assets/content/moving-box.png',
    title: '다운사이징, 언제 시작하면 좋을까요?',
    description: '현재 집의 매각 세금과 새 거주지 비용, 남는 생활비 재원을 함께 비교해요.',
    points: ['매각 후 세후 수령액', '새 주택 또는 임차 비용', '이사 후 남는 월 현금흐름'],
    sections: [
      ['세후 매각대금을 먼저 계산해요', '현재 시세에서 세금과 중개·이사 비용을 빼고 실제로 남는 금액을 확인해요. 매매가격만 보고 새 거주지 예산을 정하면 생활비가 부족해질 수 있어요.'],
      ['새 거주지 비용을 따로 잡아요', '새 주택 매입비나 임차보증금, 취득비용과 수리비를 구분해요. 부모님의 병원·교통·가족 접근성도 가격과 함께 살펴보세요.'],
      ['이사 후 월 현금흐름을 확인해요', '남은 자금을 생활비와 의료비, 금융운용 자금으로 나눠요. 이사 직후뿐 아니라 5년·10년 뒤에도 유지 가능한지 비교하는 것이 좋아요.'],
    ],
    action: 13,
  },
  {
    slug: 'family-conversation',
    category: '부모님과 함께 읽기',
    image: './assets/content/teacup.png',
    title: '상속과 증여를 준비하는 가족 대화법',
    description: '자산 이전보다 부모님의 생활비와 거주 의향을 먼저 이야기해 보세요.',
    points: ['부모님이 원하는 거주 방식', '자녀별 역할과 비용 분담', '실행 전 세무·법률 검토'],
    sections: [
      ['숫자보다 바라는 생활을 먼저 물어요', '어디에서 누구와 살고 싶은지, 매달 필요한 생활비는 얼마인지부터 이야기해요. 부모님의 우선순위를 들은 뒤 자산 이전 방법을 비교해요.'],
      ['가족별 역할을 분명히 해요', '상담 예약, 서류 준비, 비용 부담과 의사결정 참여자를 정해요. 한 사람이 모든 정보를 갖기보다 같은 분석 결과를 가족이 함께 보는 편이 좋아요.'],
      ['결정과 보류 사항을 나눠 기록해요', '합의한 내용, 더 확인할 내용, 전문가에게 물어볼 내용을 나눠 적어 두세요. 증여나 계약은 세금과 권리관계를 확인한 뒤 실행해요.'],
    ],
    action: 16,
  },
];

const CATEGORY_ACTIONS = {
  서비스: [
    { label: '내 노후 준비 결과', action: 'result' },
    { label: '부모님 정보 관리', action: 'parent-info' },
    { label: '알림 설정', action: 'notifications' },
    { label: '로그아웃', action: 'logout' },
  ],
  AI: [
    { label: 'AI 노후 컨설팅', action: 'ai' },
    { label: '추천 결과 자세히 보기', action: 'recommendation' },
  ],
  세금: [
    { label: '보유·매각 세금 결과', action: 'tax' },
    { label: '최신 세제개편안', action: 'tax-reform' },
  ],
  주택연금: [
    { label: '주택연금 예상 결과', action: 'pension' },
    { label: '전문가 상담 신청', action: 'consult' },
  ],
  '상속·증여': [
    { label: '상속·증여 시나리오', action: 'inheritance' },
    { label: '부모님 초대', action: 'invite' },
  ],
};

let lastFocus = null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildSheet() {
  const overlay = element('div', 'sheet-overlay');
  overlay.id = 'service-sheet';
  overlay.hidden = true;
  const panel = element('section', 'bottom-sheet');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'service-sheet-title');
  panel.append(element('div', 'sheet-handle'));
  const header = element('header', 'sheet-header');
  const title = element('h2', 'sheet-title');
  title.id = 'service-sheet-title';
  const close = element('button', 'sheet-close');
  close.type = 'button';
  close.setAttribute('aria-label', '닫기');
  close.dataset.serviceClose = '';
  const icon = document.createElement('img');
  icon.src = './assets/icons/lucide/x.svg';
  icon.alt = '';
  close.append(icon);
  header.append(title, close);
  const content = element('div', 'sheet-options');
  content.id = 'service-sheet-content';
  panel.append(header, content);
  overlay.append(panel);
  document.body.append(overlay);
  return { overlay, title, content, close };
}

const sheet = buildSheet();

function buildContentScreen() {
  const screen = element('section', 'screen content-detail-screen');
  screen.id = 'content-detail-screen';
  screen.hidden = true;
  screen.setAttribute('aria-labelledby', 'content-detail-title');

  const header = element('header', 'topbar');
  const back = element('button', 'back');
  back.type = 'button';
  back.dataset.contentBack = '';
  back.setAttribute('aria-label', '뒤로가기');
  const backIcon = document.createElement('img');
  backIcon.src = './assets/icons/lucide/arrow-left.svg';
  backIcon.alt = '';
  back.append(backIcon);
  const headerTitle = element('div', 'top-title', '읽을거리');
  const category = element('div', 'step');
  header.append(back, headerTitle, category);

  const body = element('div', 'content content-detail-body');
  const cta = element('div', 'cta');
  const action = element('button', 'primary', '내 결과에서 확인하기');
  action.type = 'button';
  action.dataset.contentAction = '';
  cta.append(action);
  screen.append(header, body, cta);
  document.querySelector('.app')?.append(screen);
  return { screen, body, category, action };
}

const contentScreen = buildContentScreen();

function closeSheet() {
  if (sheet.overlay.hidden) return;
  sheet.overlay.hidden = true;
  document.body.classList.remove('sheet-open');
  lastFocus?.focus?.();
}

function openSheet(title, render) {
  lastFocus = document.activeElement;
  sheet.title.textContent = title;
  sheet.content.replaceChildren();
  render(sheet.content);
  sheet.overlay.hidden = false;
  document.body.classList.add('sheet-open');
  sheet.close.focus();
}

function info(message) {
  return element('div', 'info', message);
}

function showShareFeedback(result, title = '결과 공유') {
  if (result?.method === 'kakao') {
    openSheet(title, (root) => {
      root.append(info('카카오톡 공유창을 열었어요. 공유창이 보이지 않으면 아래 버튼으로 링크를 복사해 주세요.'));
      const button = element('button', 'primary', '공유 링크 복사하기');
      button.type = 'button';
      button.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(result.url);
          button.textContent = '링크를 복사했어요';
        } catch {
          button.textContent = '링크 복사를 허용해 주세요';
        }
      });
      root.append(button);
    });
    return;
  }
  if (result?.method === 'clipboard') {
    openSheet(title, (root) => root.append(info('암호화된 결과 링크를 복사했어요. 링크는 7일 후 만료돼요.')));
  } else if (result?.kakaoError) {
    openSheet(title, (root) => root.append(info('카카오톡 공유창 대신 기기의 공유 화면으로 전달했어요.')));
  }
}

function getSession() {
  try {
    const temporary = sessionStorage.getItem(GUEST_SESSION_KEY);
    const permanent = window.SILVER_AUTH?.authenticated ? localStorage.getItem(SESSION_KEY) : null;
    const value = JSON.parse(temporary || permanent || 'null');
    return value?.advice && value?.property ? value : null;
  } catch {
    return null;
  }
}

function requireResult() {
  const session = getSession();
  if (session) return session;
  openSheet('분석 결과가 필요해요', (root) => {
    root.append(info('부모님 정보와 주택을 먼저 분석하면 이 기능을 이용할 수 있어요.'));
    const button = element('button', 'primary', '분석 시작하기');
    button.type = 'button';
    button.addEventListener('click', () => { closeSheet(); hideContentDetail(); shell?.show?.(1); });
    root.append(button);
  });
  return null;
}

async function inviteParent() {
  const session = requireResult();
  if (!session) return;
  try {
    const result = await shareResult(session, {
      purpose: 'invite',
    });
    showShareFeedback(result, '부모님 초대');
  } catch (error) {
    if (error?.name === 'AbortError') return;
    openSheet('부모님 초대', (root) => root.append(info(error.message || '초대 링크를 만들지 못했어요.')));
  }
}

function inputField(labelText, { name, type = 'text', inputmode, placeholder, maxLength } = {}) {
  const label = element('label', 'field');
  label.append(element('span', 'label', labelText));
  const input = element('input', 'input');
  input.name = name;
  input.type = type;
  if (inputmode) input.inputMode = inputmode;
  if (placeholder) input.placeholder = placeholder;
  if (maxLength) input.maxLength = maxLength;
  label.append(input);
  return { label, input };
}

function openConsultation() {
  const session = requireResult();
  if (!session) return;
  openSheet('전문가 상담 신청', (root) => {
    const form = element('form', 'property');
    const name = inputField('신청자 이름', { name: 'name', placeholder: '이름을 입력해 주세요', maxLength: 40 });
    const phone = inputField('연락처', { name: 'phone', type: 'tel', inputmode: 'tel', placeholder: '010-0000-0000', maxLength: 30 });
    const time = inputField('연락받기 편한 시간', { name: 'preferredTime', placeholder: '예: 평일 오후 2시 이후', maxLength: 80 });
    const note = inputField('상담받고 싶은 내용', { name: 'note', placeholder: '예: 보유세와 주택연금 비교', maxLength: 500 });
    const consent = element('label', 'choice');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'consent';
    consent.append(checkbox, document.createTextNode(' 상담을 위한 개인정보 수집·이용에 동의해요'));
    const status = info('연락처와 암호화된 분석 결과 링크만 상담 접수에 사용해요.');
    status.setAttribute('role', 'status');
    const submit = element('button', 'primary', '상담 신청하기');
    submit.type = 'submit';
    form.append(name.label, phone.label, time.label, note.label, consent, status, submit);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      submit.disabled = true;
      submit.textContent = '접수 중…';
      try {
        const shared = await createResultLink(session);
        const response = await fetch('./api/consultations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.input.value,
            phone: phone.input.value,
            preferredTime: time.input.value,
            note: note.input.value,
            consent: checkbox.checked,
            resultToken: shared.token,
          }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || '상담을 접수하지 못했어요.');
        localStorage.setItem('silver-last-consultation-v1', JSON.stringify({ id: body.id, submittedAt: body.submittedAt }));
        const message = body.preview
          ? '상담 신청 화면을 확인했어요. 운영 상담 채널을 연결하면 실제 접수가 시작돼요.'
          : `상담 신청을 접수했어요. 접수번호는 ${body.id}예요.`;
        form.replaceChildren(info(message));
      } catch (error) {
        status.textContent = error.message || '상담을 접수하지 못했어요.';
        submit.disabled = false;
        submit.textContent = '상담 신청하기';
      }
    });
    root.append(form);
  });
}

function articleButton(item, index) {
  const button = element('button', 'sheet-option', item.title);
  button.type = 'button';
  button.addEventListener('click', () => showArticle(index));
  return button;
}

function contentSlugFromUrl() {
  const match = location.hash.match(/^#content\/([^/?#]+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function renderArticle(article) {
  contentScreen.body.replaceChildren();
  contentScreen.category.textContent = '';

  const eyebrow = element('p', 'eyebrow', article.category);
  const title = element('h1', 'title', article.title);
  title.id = 'content-detail-title';
  const description = element('p', 'desc', article.description);
  const visual = element('div', 'content-detail-visual');
  const image = document.createElement('img');
  image.src = article.image;
  image.alt = '';
  visual.append(image);

  const checklist = element('article', 'card content-detail-card');
  checklist.append(element('h2', '', '먼저 확인할 내용'));
  const points = element('ul', 'points');
  article.points.forEach((point) => points.append(element('li', '', point)));
  checklist.append(points);

  contentScreen.body.append(eyebrow, title, description, visual, checklist);
  article.sections.forEach(([heading, copy]) => {
    const section = element('article', 'card content-detail-card');
    section.append(element('h2', '', heading), element('p', '', copy));
    contentScreen.body.append(section);
  });
  contentScreen.body.append(info('세금·연금·계약 조건은 실제 실행 시점의 공식 자료와 전문가 확인이 필요해요.'));
  contentScreen.action.textContent = article.action === 18 ? '세제개편안에서 확인하기' : '내 분석 결과에서 확인하기';
  contentScreen.action.dataset.articleSlug = article.slug;
  document.title = `${article.title} | SILVER`;
}

function hideContentDetail() {
  contentScreen.screen.hidden = true;
  document.title = '부모님 노후 준비 진단';
}

function showContentDetail(articleOrIndex, updateUrl = true) {
  const article = typeof articleOrIndex === 'number'
    ? ARTICLES[articleOrIndex]
    : ARTICLES.find((item) => item.slug === articleOrIndex);
  if (!article) return false;

  closeSheet();
  shell?.show?.(0, false);
  document.querySelectorAll('[data-screen]').forEach((screen) => { screen.hidden = true; });
  const startOverlay = document.querySelector('#start-overlay');
  const aiOverlay = document.querySelector('#ai-consulting-overlay');
  if (startOverlay) startOverlay.hidden = true;
  if (aiOverlay) aiOverlay.hidden = true;
  document.body.classList.remove('tab-mode');
  renderArticle(article);
  contentScreen.screen.hidden = false;
  const nextHash = `#content/${article.slug}`;
  if (updateUrl && location.hash !== nextHash) history.pushState({ content: article.slug }, '', nextHash);
  window.scrollTo({ top: 0, behavior: 'instant' });
  return true;
}

function showArticle(index) {
  showContentDetail(index);
}

function showAllNews() {
  openSheet('자산관리 뉴스', (root) => ARTICLES.forEach((item, index) => root.append(articleButton(item, index))));
}

function showNotices() {
  const notices = [
    ['분석 결과 저장 안내', '분석 결과는 이 기기의 브라우저에 저장되며 결과 초기화나 로그아웃으로 지울 수 있어요.'],
    ['공유 링크 이용 안내', '공유 결과는 암호화되며 링크는 만든 날부터 7일 동안 이용할 수 있어요.'],
    ['예상 금액 확인 안내', '세금과 연금 금액은 입력값에 따른 예상치이므로 실행 전 공식 심사와 전문가 확인이 필요해요.'],
  ];
  openSheet('공지사항', (root) => notices.forEach(([title, description]) => {
    const button = element('button', 'sheet-option', title);
    button.type = 'button';
    button.addEventListener('click', () => openSheet(title, (content) => content.append(info(description))));
    root.append(button);
  }));
}

function showCustomerCenter() {
  const faqs = [
    ['분석 결과는 어디에 저장되나요?', '현재 기기의 브라우저에 저장돼요. 다른 기기에서는 암호화된 공유 링크로 확인할 수 있어요.'],
    ['세금 예상액은 확정 금액인가요?', '입력값과 현재 규칙을 적용한 예상치예요. 실제 고지·신고 전에는 확정 법령과 서류로 다시 확인해 주세요.'],
    ['입력 정보를 바꾸고 싶어요.', '결과를 초기화한 뒤 주소·취득가·거주기간을 다시 입력해 주세요.'],
  ];
  openSheet('고객센터', (root) => {
    faqs.forEach(([question, answer]) => {
      const button = element('button', 'sheet-option', question);
      button.type = 'button';
      button.addEventListener('click', () => openSheet(question, (content) => content.append(info(answer))));
      root.append(button);
    });
    const consult = element('button', 'primary', '전문가 상담 신청');
    consult.type = 'button';
    consult.addEventListener('click', openConsultation);
    root.append(consult);
  });
}

async function requestBrowserNotification(checkbox, status) {
  if (!('Notification' in window)) {
    checkbox.checked = false;
    localStorage.setItem(NOTIFICATION_KEY, 'off');
    status.textContent = '이 브라우저에서는 알림을 사용할 수 없어요.';
    return;
  }
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') {
    checkbox.checked = false;
    localStorage.setItem(NOTIFICATION_KEY, 'off');
    status.textContent = permission === 'denied' ? '브라우저에서 알림이 차단되어 있어요. 사이트 설정에서 허용해 주세요.' : '알림 권한을 허용하지 않아 설정을 켜지 않았어요.';
    return;
  }
  localStorage.setItem(NOTIFICATION_KEY, 'on');
  status.textContent = '브라우저 알림을 받도록 설정했어요.';
  new Notification('SILVER 알림 설정 완료', {
    body: '세금·노후 준비 안내를 받을 수 있어요.',
    icon: new URL('./assets/start-card-parasol.png', document.baseURI).toString(),
  });
}

function showNotifications() {
  openSheet('알림 설정', (root) => {
    const label = element('label', 'choice');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = localStorage.getItem(NOTIFICATION_KEY) === 'on';
    label.append(checkbox, document.createTextNode(' 세금·노후 준비 안내를 받아볼게요'));
    const status = info(checkbox.checked ? '알림 안내를 받도록 설정되어 있어요.' : '현재 알림 안내가 꺼져 있어요.');
    checkbox.addEventListener('change', async () => {
      checkbox.disabled = true;
      if (checkbox.checked) await requestBrowserNotification(checkbox, status);
      else {
        localStorage.setItem(NOTIFICATION_KEY, 'off');
        status.textContent = '알림 안내를 껐어요.';
      }
      checkbox.disabled = false;
    });
    root.append(label, status);
  });
}

function go(screen) {
  closeSheet();
  shell?.show?.(screen);
}

function handleAction(action) {
  if (action === 'result') return requireResult() && go(10);
  if (action === 'parent-info') return go(8);
  if (action === 'notifications') return showNotifications();
  if (action === 'ai') return requireResult() && (closeSheet(), shell?.showAi?.());
  if (action === 'recommendation') return requireResult() && go(14);
  if (action === 'tax') return requireResult() && go(11);
  if (action === 'tax-reform') return go(18);
  if (action === 'pension') return requireResult() && go(15);
  if (action === 'consult') return openConsultation();
  if (action === 'inheritance') return requireResult() && go(16);
  if (action === 'invite') return inviteParent();
  if (action === 'logout') return undefined;
}

function renderCategory(label) {
  const list = document.querySelector('.my-service-list');
  if (!list) return;
  list.replaceChildren();
  (CATEGORY_ACTIONS[label] || []).forEach((item) => {
    const button = element('button', 'my-service-row', item.label);
    button.type = 'button';
    button.dataset.serviceAction = item.action;
    if (item.action === 'logout') button.dataset.logout = '';
    list.append(button);
  });
  document.dispatchEvent(new CustomEvent('silver:service-list-rendered'));
}

function initializeContentCards() {
  document.querySelectorAll('.news-banner,.content-item').forEach((node) => {
    node.setAttribute('role', 'button');
    node.tabIndex = 0;
  });
}

document.addEventListener('click', (event) => {
  if (event.target === sheet.overlay || event.target.closest('[data-service-close]')) return closeSheet();
  if (event.target.closest('[data-content-back]')) {
    hideContentDetail();
    return shell?.show?.(0);
  }
  if (event.target.closest('[data-content-action]')) {
    const article = ARTICLES.find((item) => item.slug === contentScreen.action.dataset.articleSlug);
    if (!article) return;
    if (article.action !== 18 && !requireResult()) return;
    hideContentDetail();
    return shell?.show?.(article.action);
  }
  if (event.target.closest('[data-consult]')) {
    event.preventDefault();
    return openConsultation();
  }
  const shortcut = event.target.closest('.my-shortcut');
  const shortcutLabel = shortcut?.textContent?.trim();
  if (shortcutLabel === '부모님 초대') return inviteParent();
  if (shortcutLabel === '공지사항') return showNotices();
  if (shortcutLabel === '고객센터') return showCustomerCenter();
  if (event.target.closest('[aria-label="알림"]')) return showNotices();
  if (event.target.closest('.home-section-more')) return showAllNews();

  const banner = event.target.closest('.news-banner');
  if (banner) return showArticle([...document.querySelectorAll('.news-banner')].indexOf(banner));
  const content = event.target.closest('.content-item');
  if (content) return showArticle(3 + [...document.querySelectorAll('.content-item')].indexOf(content));

  const category = event.target.closest('.my-category');
  if (category) {
    document.querySelectorAll('.my-category').forEach((button) => button.classList.toggle('active', button === category));
    renderCategory(category.textContent.trim());
    return;
  }
  const action = event.target.closest('[data-service-action]')?.dataset.serviceAction;
  if (action) handleAction(action);
});

document.addEventListener('silver:share-complete', (event) => {
  showShareFeedback(event.detail);
});

document.addEventListener('silver:share-error', (event) => {
  openSheet('공유할 수 없어요', (root) => root.append(info(event.detail?.message || '공유 링크를 만들지 못했어요.')));
});

document.addEventListener('silver:auth-error', (event) => {
  const messages = {
    cancelled: '카카오 로그인을 취소했어요. 로그인 없이도 서비스를 둘러볼 수 있어요.',
    config: '카카오 로그인 설정을 확인하고 있어요. 잠시 후 다시 시도해 주세요.',
    state: '로그인 요청이 만료되었어요. 카카오톡으로 시작하기를 다시 눌러 주세요.',
    failed: '카카오 로그인을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.',
  };
  openSheet('카카오 로그인', (root) => root.append(info(messages[event.detail?.code] || messages.failed)));
});

function showSharedRestoreError(message) {
  openSheet('공유 결과를 열 수 없어요', (root) => root.append(info(`${message || '공유 링크가 올바르지 않아요.'} 링크가 만료되었거나 변경되었다면 보낸 분께 새 링크를 요청해 주세요.`)));
}

document.addEventListener('silver:shared-restore-error', (event) => {
  window.SILVER_SHARED_RESTORE_ERROR = null;
  showSharedRestoreError(event.detail?.message);
});

if (window.SILVER_SHARED_RESTORE_ERROR) {
  const pendingSharedError = window.SILVER_SHARED_RESTORE_ERROR;
  window.SILVER_SHARED_RESTORE_ERROR = null;
  showSharedRestoreError(pendingSharedError);
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !sheet.overlay.hidden) return closeSheet();
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.news-banner,.content-item')) {
    event.preventDefault();
    event.target.click();
  }
});

function syncContentRoute() {
  const slug = contentSlugFromUrl();
  if (slug) return showContentDetail(slug, false);
  hideContentDetail();
  return false;
}

window.addEventListener('popstate', syncContentRoute);
window.addEventListener('hashchange', syncContentRoute);

initializeContentCards();
renderCategory('서비스');
syncContentRoute();
if (window.SILVER_SHARED_RESTORE_ERROR) showSharedRestoreError(window.SILVER_SHARED_RESTORE_ERROR);
