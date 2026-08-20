# Vercel 자동배포 장애 및 인계

확인일: 2026-08-20 (KST)

## 한 줄 결론

두 저장소의 최신 수정은 GitHub `main`까지 푸시됐지만, 운영 Vercel 프로젝트의 계정·팀 권한과 Git 연결이 확보되지 않아 두 운영 주소 모두 이전 버전을 제공하고 있다.

## 배포 대상

| 구분 | GitHub 저장소 | 배포가 필요한 UI 기준 커밋 | 운영 주소 |
|---|---|---|---|
| 주 저장소 | `chulwan0123/aicamp` | `6fc28629be2f6c061f3a36332bbaa752ea6a8117` | `https://aicamp-silver-weld.vercel.app` |
| 공동 저장소 | `hyeji0503/hanwhaAiCamp` | `089fa346a82642f27f58e9ab9875faea98a12a4e` | `https://hanwha-ai-camp-silver.vercel.app` |

두 커밋의 추적 파일 내용은 동일하며, `npm run check`는 두 저장소에서 모두 통과했다. 최신 로컬 `index.html` SHA-256은 다음과 같다.

```text
52f9d117651502e3f04f96cf6cd6f7fa043c1895cfe7a2ba00a2312cb00df4ae
```

2026-08-20 확인 당시 두 운영 주소가 반환한 `index.html` SHA-256은 모두 다음 값으로, 최신 소스와 다르다.

```text
43e6f245a988a054919b4c0d899689260f8850f31c4f6520415be37c4458d0e1
```

## 현재 확인된 장애

### 1. 주 저장소

- GitHub `main`은 `6fc28629...`까지 푸시됐다.
- 커밋 상태는 `pending`이지만 연결된 Vercel 상태 항목이 없다.
- 운영 프로젝트가 저장소의 `main` 푸시를 자동으로 받지 못하는 상태로 판단된다.

### 2. 공동 저장소

- GitHub `main`은 `089fa346...`까지 푸시됐다.
- Vercel 상태 검사가 다음 두 항목에서 실패했다.
  - `Vercel – hanwha-ai-camp-vhjx`: Git 작성자 `wani3000`이 Vercel 프로젝트 접근 권한을 가져야 한다는 오류
  - `Vercel – hanwha-ai-camp`: `Deployment was blocked`
- 실패 상태가 가리키는 범위는 Vercel 팀 `SION`과 `sion11/hanwha-ai-camp`다. 이는 문서에 기록된 실제 운영 범위와 다른 중복 또는 과거 연결일 수 있으므로, 소유권을 확인하기 전에 삭제하지 않는다.

### 3. Vercel 계정 불일치

- 현재 로컬 Vercel CLI 및 확인된 브라우저 계정은 `oxaz1234-2461`이다.
- 이 계정의 개인 범위는 `oxaz1234-gmailcoms-projects`이며, 두 운영 주소를 소유한 프로젝트가 보이지 않는다.
- 기존 문서에는 운영 범위가 Vercel `chulwan-8137` 계정의 `camp17`로 기록돼 있다.
- 현재 계정으로 `chulwan-8137` 범위에 접근하면 존재하지 않는 범위 또는 404로 처리된다.
- `chulwan@hanwha.plus` Google 계정 로그인도 시도했지만, 연결된 외부 Chrome 프로필에서는 자동 로그인이 확인되지 않아 완료하지 못했다.

## 다음 에이전트의 우선 작업

### 권장안: Vercel Git 자동배포 복구

1. `aicamp-silver-weld.vercel.app`과 `hanwha-ai-camp-silver.vercel.app`을 실제로 소유한 Vercel 계정 또는 팀에 로그인한다.
2. 두 운영 주소가 연결된 정확한 Vercel 프로젝트 이름과 프로젝트 ID를 확인한다.
3. 각 프로젝트의 **Settings → Git**에서 다음 저장소를 연결한다.
   - 주 운영 프로젝트 → `chulwan0123/aicamp`
   - 공동 운영 프로젝트 → `hyeji0503/hanwhaAiCamp`
4. 두 프로젝트의 Production Branch를 `main`으로 지정한다.
5. Vercel GitHub App이 두 저장소에 접근할 수 있는지 확인한다.
6. Git 작성자 `wani3000`을 실제 운영 Vercel 팀 또는 프로젝트에 추가하거나, 해당 GitHub 계정이 권한 있는 Vercel 사용자에 연결됐는지 확인한다.
7. `main`의 위 커밋으로 Production 배포를 실행한다.
8. 새 커밋 푸시가 자동으로 Production 배포를 만드는지 작은 문서 커밋으로 재검증한다.

Vercel 공식 동작상 Git 저장소가 프로젝트에 연결되고 `main`이 Production Branch이면 `main` 푸시마다 Production 배포가 생성된다.

### 대안: GitHub Actions에서 Vercel CLI 배포

운영 Vercel 계정의 Git 연동을 복구하기 어렵다면 각 저장소에 GitHub Actions 배포를 구성한다.

필요한 GitHub Actions Secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

두 저장소가 서로 다른 Vercel 프로젝트이므로 `VERCEL_PROJECT_ID`는 각각 다르게 설정한다. 비밀값, `.vercel/project.json`, Deploy Hook URL을 저장소에 커밋하지 않는다.

권장 작업 흐름은 다음과 같다.

```text
push main
  → npm ci
  → npm run check
  → vercel pull --yes --environment=production
  → vercel build --prod
  → vercel deploy --prebuilt --prod
```

## 인계받은 에이전트의 확인 명령

각 저장소에서 다음을 먼저 확인한다.

```bash
git status --short
git fetch origin
git rev-parse origin/main
npm ci
npm run check
vercel whoami
vercel teams ls
```

운영 계정과 프로젝트를 확인한 뒤에만 `vercel link`, 환경변수 변경 또는 Production 배포를 수행한다. 이름이 비슷한 신규 프로젝트를 임의로 만들거나 새 URL을 운영 주소로 대체하지 않는다.

## 배포 후 필수 검증

### 소스 반영

```bash
shasum -a 256 index.html
curl -fsSL https://aicamp-silver-weld.vercel.app/ | shasum -a 256
curl -fsSL https://hanwha-ai-camp-silver.vercel.app/ | shasum -a 256
```

세 값이 최신 소스의 `index.html` 해시와 같아야 한다.

### API 상태

```bash
curl -i https://aicamp-silver-weld.vercel.app/api/health
curl -i https://hanwha-ai-camp-silver.vercel.app/api/health
```

두 요청이 HTTP 200을 반환해야 한다.

### 화면 상태

- 320px, 375px, 390px, 500px에서 가로 스크롤이 없어야 한다.
- 홈 설명은 `부동산과 생활비를 바탕으로 부모님의` 다음에 줄바꿈되어야 한다.
- 결과 공유·상담 버튼은 `AI 컨설팅 받아보기`와 같은 17px/700 타이포그래피여야 한다.
- 마이 바로가기 5개 라벨은 10px이어야 한다.
- 모달 닫기 버튼은 제목이 두 줄이어도 첫 줄에 정렬돼야 한다.
- 브라우저 콘솔 오류와 깨진 에셋 요청이 없어야 한다.

## 완료 기준

- 두 운영 주소가 각각 위의 최신 `main` 커밋 내용을 제공한다.
- Vercel Production 배포 상태가 `READY`다.
- 두 `/api/health`가 HTTP 200이다.
- 모바일 가로 스크롤과 이번 UI 수정 사항이 실제 운영 화면에서 검증됐다.
- 이후 `main` 푸시 한 번으로 별도 수동 조작 없이 Production 배포가 생성된다.
