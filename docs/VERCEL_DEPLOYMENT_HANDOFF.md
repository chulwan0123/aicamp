# Vercel 운영 배포 현황 및 인계

확인일: 2026-08-21 (KST)

## 현재 운영

| 항목 | 값 |
|---|---|
| GitHub | `https://github.com/wani3000/aicamp-silver` |
| 운영 브랜치 | `main` |
| Vercel 계정 | `oxaz1234-2461` |
| Vercel 프로젝트 | `oxaz1234-gmailcoms-projects/aicamp` |
| 운영 URL | `https://aicamp-sigma.vercel.app` |
| 예비 URL | `https://aicamp-silver.vercel.app` |

GitHub 저장소와 Vercel 프로젝트는 Git Integration으로 연결되어 `main` 푸시 시 Production 자동배포가 실행된다. CLI 수동 Production 배포도 가능하다.

## 운영 환경변수

설정 완료:

- `OPENAI_API_KEY` — Sensitive
- `OPENAI_MODEL=gpt-5.6-terra`
- `USE_MOCK=false`
- `SHARE_SECRET` — Sensitive

추가 설정 필요:

- `PUBLIC_DATA_API_KEY` — 서울·경기 전체 공동주택 공시가격 조회
- `CONSULTATION_WEBHOOK_URL` — 실제 전문가 상담 전달
- `CONSULTATION_WEBHOOK_SECRET` — 상담 웹훅 서명 검증 시
- `KAKAO_JAVASCRIPT_KEY` — 카카오 공식 공유 SDK

## 검증 결과

- `npm run check`: 51개 테스트 통과
- `/api/health`: 정상
- 반포자이 101동 101호 공시가격 발췌 조회: 정상
- `/api/advise`: 실제 OpenAI 응답 `_source=llm`
- `/api/chat`: 실제 OpenAI 응답 `_source=llm`
- 390px 모바일 주소 → 가격 → 취득가 → 분석 → AI 채팅: 통과
- 문서 전체 가로 스크롤: 없음

## 확인 명령

```bash
npx --yes vercel@59.3.0 whoami
npx --yes vercel@59.3.0 project inspect aicamp
npx --yes vercel@59.3.0 inspect https://aicamp-sigma.vercel.app
npx --yes vercel@59.3.0 env ls production --project aicamp
curl -fsS https://aicamp-sigma.vercel.app/api/health
```

비밀값은 GitHub나 클라이언트 코드에 넣지 않고 Vercel Sensitive 환경변수로만 관리한다.
