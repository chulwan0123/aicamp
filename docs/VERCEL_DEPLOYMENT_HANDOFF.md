# GitHub·Vercel 운영 환경 인계

확인일: 2026-08-21 (KST)

## 1. 로컬 프로젝트

현재 작업 대상은 아래 폴더다.

```text
/Users/chulwan/Documents/Codex/2026-08-20/https-github-com-chulwan0123-aicamp
```

비슷한 이름의 `...aicamp-2` 폴더와 혼동하지 않는다.

## 2. 공식 GitHub 저장소

| 항목 | 값 |
|---|---|
| GitHub 계정 | `wani3000` |
| 연결 이메일 | `oxaz1234@gmail.com` |
| 공식 저장소 | `https://github.com/wani3000/aicamp-silver` |
| 공개 범위 | Private |
| 기본 브랜치 | `main` |
| 배포용 remote | `wani3000` |
| 인계 기준 커밋 | `e18a038323fc3fdcf7aa5921c4437b50edc85d8d` |

로컬에는 과거 저장소용 `origin`이 남아 있다. 운영 반영은 반드시 `wani3000` remote를 사용한다.

```bash
git remote -v
git rev-parse HEAD
git rev-parse wani3000/main
git push wani3000 HEAD:main
```

`git push origin`은 과거 `chulwan0123/aicamp` 저장소를 수정할 수 있으므로 운영 배포에 사용하지 않는다.

## 3. Vercel 운영 환경

| 항목 | 값 |
|---|---|
| 로그인 계정 | `oxaz1234-2461` |
| Vercel scope | `oxaz1234-gmailcoms-projects` |
| 운영 프로젝트 | `aicamp` |
| 프로젝트 ID | `prj_PyZ4DtcqJBFAKgRbN8My5VfvXAIX` |
| 운영 URL | `https://aicamp-sigma.vercel.app` |
| 보조 URL | `https://aicamp-silver.vercel.app` |

운영 프로젝트 `aicamp`는 `wani3000/aicamp-silver`의 `main`과 연결되어 있다.

```text
로컬 커밋
→ git push wani3000 HEAD:main
→ Vercel aicamp Production 자동배포
→ https://aicamp-sigma.vercel.app 갱신
```

`aicamp-silver`라는 보조 Vercel 프로젝트는 운영 대상이 아니다. AI 기능과 최종 QA는 반드시 `aicamp-sigma.vercel.app`에서 수행한다.

## 4. 운영 환경변수

설정 완료:

- `OPENAI_API_KEY` — Sensitive, 값을 출력하거나 Git에 저장하지 않는다.
- `OPENAI_MODEL=gpt-5.6-terra`
- `USE_MOCK=false`
- `SHARE_SECRET` — Sensitive, 값을 출력하거나 Git에 저장하지 않는다.

추가 설정 필요:

- `PUBLIC_DATA_API_KEY` — 서울·경기 전체 공동주택 공시가격 조회
- `KAKAO_JAVASCRIPT_KEY` — 카카오톡 친구 선택 공유
- `CONSULTATION_WEBHOOK_URL` — 실제 전문가 상담 전달
- `CONSULTATION_WEBHOOK_SECRET` — 상담 웹훅 서명 검증 시

새 값은 GitHub 소스나 커밋되는 `.env` 파일에 넣지 않고 Vercel `aicamp` 프로젝트의 Production 환경변수로 등록한다.

## 5. 확인된 운영 상태

- `/api/health`: `{"ok":true,"service":"silver","engine":"plushome-v2"}`
- 실제 AI 분석: 정상, `_source=llm`
- 실제 AI 채팅: 정상, `_source=llm`
- 반포자이 101동 101호, 전용면적 84.943㎡, 2025년 공시가격 2,462,000,000원 발췌 조회: 정상
- 공시가격 출처: 국토교통부 주택 공시가격 정보

`PUBLIC_DATA_API_KEY`가 없으므로 현재는 검증된 반포자이 기본 호 발췌 데이터만 조회할 수 있다.

## 6. 수정 후 필수 절차

```bash
npm run check
git status --short
git add -- <수정한 파일만 명시>
git commit -m "<변경 내용>"
git push wani3000 HEAD:main
```

`git add .`, `git add -A`, `git add --all`을 사용하지 않는다. 다른 에이전트의 변경과 로컬 QA 산출물을 함께 커밋하지 않는다.

자동배포와 운영 상태를 확인한다.

```bash
npx --yes vercel@59.3.0 ls aicamp --scope oxaz1234-gmailcoms-projects
npx --yes vercel@59.3.0 inspect https://aicamp-sigma.vercel.app --scope oxaz1234-gmailcoms-projects
curl -fsS https://aicamp-sigma.vercel.app/api/health
```

마지막으로 운영 URL을 모바일 320px, 375px, 390px, 500px에서 직접 QA한다.

## 7. 금지·주의사항

- API 키를 응답, 로그, 커밋, README에 노출하지 않는다.
- 운영 푸시는 `origin`이 아니라 `wani3000` remote를 사용한다.
- Vercel `aicamp-silver`가 아니라 `aicamp` 프로젝트를 운영 대상으로 사용한다.
- 로컬 QA 결과물, 스크린샷, 임시 ZIP, `.vercel`, `.env*`는 커밋하지 않는다.
- 과거 GitHub 저장소와 기존 Vercel 계정은 수정하지 않는다.
