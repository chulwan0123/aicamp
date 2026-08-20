# GitHub·Vercel 운영 환경 인계

확인일: 2026-08-21 (KST)

## 1. 로컬 프로젝트

```text
/Users/chulwan/Documents/Codex/2026-08-20/https-github-com-chulwan0123-aicamp
```

비슷한 이름의 `...aicamp-2` 폴더와 혼동하지 않는다. 작업 시작 전 `git status --short`로 다른 에이전트의 변경을 확인한다.

## 2. 공식 GitHub 기준

| 항목 | 값 |
|---|---|
| GitHub 계정 | `chulwan0123` |
| Git 작성자 이메일 | `Oxaz1234@gmail.com` |
| 공식 저장소 | `https://github.com/chulwan0123/aicamp` |
| 배포 기준 브랜치 | `codex/fix-my-shortcut-font-14-5` |
| 배포 기준 커밋 | 운영 별칭을 `vercel inspect`로 확인 |
| 공식 remote | `origin` |

```bash
git remote -v
git branch --show-current
git rev-parse HEAD
git log -1 --format='%an <%ae>%n%cn <%ce>'
```

`wani3000` remote는 과거 인계 흔적으로 남아 있으며 현재 공식 배포 저장소로 사용하지 않는다. 푸시 전에는 대상 브랜치와 미커밋 파일을 반드시 다시 확인한다.

## 3. Vercel 운영 환경

| 항목 | 값 |
|---|---|
| 로그인 계정 | `oxaz1234-2461` |
| Vercel scope | `oxaz1234-gmailcoms-projects` |
| 운영 프로젝트 | `aicamp` |
| 프로젝트 ID | `prj_PyZ4DtcqJBFAKgRbN8My5VfvXAIX` |
| 운영 URL | `https://aicamp-sigma.vercel.app` |
| 불변 배포 URL·ID | `vercel inspect` 결과 기준 |
| 정상 상태 | `Ready` |

현재 운영 별칭은 깨끗한 커밋에서 생성한 Production 배포를 가리켜야 한다. Git 자동배포 브랜치는 별도 확인 전까지 운영 절차로 가정하지 않는다.

## 4. 운영 환경변수

Production에서 존재를 확인한 변수:

- `OPENAI_API_KEY`, `OPENAI_MODEL`, `USE_MOCK`
- `SHARE_SECRET`
- `DATA_GO_KR_API_KEY`
- `AUTH_SESSION_SECRET`
- `KAKAO_JAVASCRIPT_KEY`, `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `KAKAO_REDIRECT_URI`

상담 외부 전달을 사용하려면 `CONSULTATION_WEBHOOK_URL`이 추가로 필요하다. 수신 채널이 서명 검증을 지원하면 `CONSULTATION_WEBHOOK_SECRET`도 설정한다.

비밀값은 출력하거나 Git에 저장하지 않는다. 공동주택 공시가격은 2025년 서울·경기 압축 데이터 조각을 읽으므로 별도의 `PUBLIC_DATA_API_KEY`가 필요 없다. `DATA_GO_KR_API_KEY`는 매매·전월세 실거래 조회에만 사용한다.

## 5. 확인된 운영 상태

- `/api/health`: `{"ok":true,"service":"silver","engine":"plushome-v2"}`
- `/api/price`: 반포자이 101동 101호·84.943㎡의 2025년 공시가격 2,462,000,000원 조회 성공
- `/api/market`: 운영 `DATA_GO_KR_API_KEY`로 실제 실거래 조회 성공
- 공시가격 출처: 국토교통부 주택 공시가격 정보
- 반포자이는 검증용 스모크 예시이며 운영 폴백이 아니다.

## 6. 단지 검색 출시 범위

- `GET /api/complexes`
- `시/도 → 시/군/구 → 단지 → 전용면적 → 동·호` 입력
- 서울·경기 69개 시군구 gzip 조각, 192,195개 단지 색인
- 공시가격 저장소·화면 3·엔진·테스트·Vercel 설정 변경
- 모바일 편집 필드 16px 이상으로 iOS 포커스 확대 방지
- 현재 `npm run check`: 77개 통과

`index.html`의 문구·DOM·레이아웃 변경과 시각 QA 증거는 `design-qa.md`에 기록돼 있다.

## 7. 수정 후 필수 절차

```bash
npm run check
git diff --check
git status --short
git diff --stat
```

다른 작업자의 파일을 섞지 않도록 `git add .`, `git add -A`, `git add --all`을 사용하지 않는다. 승인된 파일만 명시해 커밋한다.

배포 시에는 깨끗한 커밋을 별도 확인한 뒤 Vercel 프로젝트와 scope를 명시한다. 배포 후 아래를 확인한다.

```bash
vercel inspect https://aicamp-sigma.vercel.app --scope oxaz1234-gmailcoms-projects
curl -fsS https://aicamp-sigma.vercel.app/api/health
```

마지막으로 운영 URL을 모바일 320px, 375px, 390px, 500px에서 QA하고 `/api/price`와 `/api/market`의 실제 주소 흐름을 점검한다.

## 8. 금지·주의사항

- API 키를 응답, 로그, 커밋, README에 노출하지 않는다.
- 공식 GitHub 대상은 `origin`의 `chulwan0123/aicamp`다.
- 운영 Vercel 대상은 `oxaz1234-gmailcoms-projects/aicamp`다.
- 로컬 QA 결과물, 스크린샷, 임시 ZIP, `.vercel`, `.env*`는 커밋하지 않는다.
- 단지 검색 데이터와 `/api/complexes`가 실제 배포 산출물에 포함됐는지 운영에서 확인한다.
- 다주택 양도세의 1주택 비과세 적용과 조정대상지역 전달 결함을 수정·검증하기 전 출시 완료로 판정하지 않는다.
