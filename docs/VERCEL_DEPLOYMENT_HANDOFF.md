# Vercel 운영 배포 현황 및 인계

확인일: 2026-08-21 (KST)

## 현재 결론

두 저장소의 최신 `main`은 같은 추적 파일 트리를 유지한다. Vercel CLI는 `chulwan-8137` 계정과 `camp17` 팀으로 인증되어 있으며, 두 운영 프로젝트 모두 Production 배포가 가능하다. 다만 이 Vercel 계정에 GitHub Login Connection이 없어 Git 자동배포 연결은 아직 완료되지 않았다.

## 저장소와 운영 프로젝트

| 구분 | GitHub 저장소 | Vercel 프로젝트 | 운영 주소 |
|---|---|---|---|
| 주 저장소 | `chulwan0123/aicamp` | `camp17/aicamp-silver` | `https://aicamp-silver-weld.vercel.app` |
| 공동 저장소 | `hyeji0503/hanwhaAiCamp` | `camp17/hanwha-ai-camp-silver` | `https://hanwha-ai-camp-silver.vercel.app` |

최신 화면의 `index.html` SHA-256은 다음과 같다.

```text
c9addda854e3d0f71911794ec6ae89741e851e45129e6a8c02be0cfd83adaa4f
```

두 저장소는 커밋 해시와 과거 부모 이력이 서로 달라도 최종 추적 파일 트리는 같아야 한다. 동기화 여부는 커밋 해시가 아니라 트리 해시와 파일 diff로 판단한다.

## 인증과 프로젝트 확인 결과

- Vercel 사용자: `chulwan-8137`
- Vercel 팀: `camp17`
- 주 프로젝트: `aicamp-silver`
- 공동 프로젝트: `hanwha-ai-camp-silver`
- 두 프로젝트 모두 정적 루트와 `/api/advise`, `/api/chat`, `/api/client-config`, `/api/consultations`, `/api/health`, `/api/price`, `/api/share` Functions를 배포한다.

확인 명령은 다음과 같다.

```bash
npx --yes vercel@latest whoami --cwd /tmp
npx --yes vercel@latest teams ls
npx --yes vercel@latest project ls --scope camp17
npx --yes vercel@latest inspect https://aicamp-silver-weld.vercel.app --scope camp17
npx --yes vercel@latest inspect https://hanwha-ai-camp-silver.vercel.app --scope camp17
```

## 운영 환경변수

두 프로젝트의 Production 환경에 설정된 값:

- `USE_MOCK=true`
- 프로젝트별 `SHARE_SECRET`

아직 설정되지 않은 값:

- `OPENAI_API_KEY`
- `PUBLIC_DATA_API_KEY`
- `CONSULTATION_WEBHOOK_URL`
- `KAKAO_JAVASCRIPT_KEY`

따라서 AI 원격 호출은 현재 계산값을 이용한 규칙 기반 응답으로 대체된다. `/api/price`는 서버 함수까지 배포되지만 공공데이터 키가 설정될 때까지 명시적인 설정 오류를 반환한다. 상담은 운영 웹훅 설정 전까지 실제 담당자에게 전달되지 않으며, 카카오톡 공유는 JavaScript 키 설정 전까지 기기 공유·클립보드 방식으로 대체된다. 비밀값은 문서, GitHub, 클라이언트 코드에 기록하지 않는다.

### 카카오톡 공유 운영 설정

1. 카카오디벨로퍼스 앱의 JavaScript 키를 두 Vercel 프로젝트 Production 환경의 `KAKAO_JAVASCRIPT_KEY`에 설정한다.
2. `[앱] > [플랫폼 키] > [JavaScript 키] > [JavaScript SDK 도메인]`에 `https://aicamp-silver-weld.vercel.app`, `https://hanwha-ai-camp-silver.vercel.app`을 등록한다.
3. `[앱] > [제품 링크 관리] > [웹 도메인]`에도 같은 두 주소를 등록한다.
4. 운영 화면에서 결과 공유 버튼을 눌러 카카오톡 친구 선택 화면과 수신 메시지의 `분석 결과 확인하기` 링크를 확인한다.

## Git 자동배포 상태

`vercel git connect`로 두 `camp17` 프로젝트에 GitHub 저장소 연결을 시도했지만, 현재 Vercel 계정에 GitHub Login Connection이 필요하다는 응답으로 완료되지 않았다. 공동 저장소의 GitHub 커밋에 표시되는 `SION` 팀 Vercel 실패 상태는 과거·별도 프로젝트 연결이며 `camp17/hanwha-ai-camp-silver`와 다른 범위다.

Git 자동배포를 복구하려면 다음 작업이 필요하다.

1. Vercel `chulwan-8137` 계정의 Login Connections에 권한 있는 GitHub 계정을 연결한다.
2. `aicamp-silver`를 `chulwan0123/aicamp`에 연결한다.
3. `hanwha-ai-camp-silver`를 `hyeji0503/hanwhaAiCamp`에 연결한다.
4. 두 프로젝트의 Production Branch를 `main`으로 지정한다.
5. GitHub App의 저장소 접근 범위와 실제 `main` 배포를 확인한다.

연결이 복구되기 전에는 아래 수동 CLI 절차가 운영 기준이다.

## 현재 수동 배포 절차

1. 두 저장소의 원격 `main`을 가져온다.
2. 두 `main`의 추적 파일 트리와 diff를 비교한다.
3. `npm run check`와 `git diff --check`를 통과시킨다.
4. 최신 문서까지 두 저장소 `main`에 푸시한다.
5. 각 Vercel 프로젝트에서 Production 빌드와 배포를 실행한다.

```bash
npx --yes vercel@latest build --prod --scope camp17
npx --yes vercel@latest deploy --prebuilt --prod --scope camp17
```

공동 프로젝트는 별도 checkout 또는 임시 디렉터리에서 `hanwha-ai-camp-silver`에 링크한 후 같은 명령을 실행한다. `.vercel/project.json`, `.env.local`, 토큰과 비밀값은 커밋하지 않는다.

## 배포 후 필수 검증

### 소스 반영

```bash
openssl dgst -sha256 index.html
curl -fsSL https://aicamp-silver-weld.vercel.app/ | openssl dgst -sha256
curl -fsSL https://hanwha-ai-camp-silver.vercel.app/ | openssl dgst -sha256
```

세 값이 모두 최신 로컬 `index.html` 해시와 같아야 한다.

### API와 배포 상태

```bash
curl -fsS https://aicamp-silver-weld.vercel.app/api/health
curl -fsS https://hanwha-ai-camp-silver.vercel.app/api/health
npx --yes vercel@latest inspect https://aicamp-silver-weld.vercel.app --scope camp17
npx --yes vercel@latest inspect https://hanwha-ai-camp-silver.vercel.app --scope camp17
```

- 두 Production 배포가 `Ready`여야 한다.
- 두 `/api/health`가 HTTP 200과 `plushome-v2` 엔진 상태를 반환해야 한다.
- `/api/price`의 키 미설정 오류는 현재 환경변수 상태에서 예상되는 응답이며 함수 배포 실패가 아니다.

### 화면

- 최초 진입은 `#home`이 아니라 `#start`다.
- 본 화면은 19개, 입력 화면은 1/8부터 8/8까지다.
- 320px, 375px, 390px, 500px에서 페이지 가로 스크롤이 없다.
- 뉴스 레일과 마이 카테고리만 내부 가로 스크롤된다.
- 홈 설명의 승인된 줄바꿈, 결과 CTA 17px/700, 마이 바로가기 10px, 두 줄 모달 닫기 버튼 정렬이 유지된다.
- 브라우저 콘솔 오류와 깨진 에셋 요청이 없다.

## 완료 기준

- 두 GitHub `main`의 최종 추적 파일 트리가 같다.
- `npm run check`의 전체 테스트가 통과한다.
- 두 운영 주소의 HTML 해시가 최신 로컬 소스와 같다.
- 두 Production 배포가 `Ready`이고 `/api/health`가 정상이다.
- 환경변수의 설정·미설정 상태와 Git 자동배포 제한이 문서에 사실대로 기록돼 있다.
