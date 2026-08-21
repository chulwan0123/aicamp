# 기능 연결 QA — 2026-08-21

## 확인 범위

- 추천 상세: 추천 이유, 월 총유입·차감·세후 활용액, 감수할 점, 주의사항, 대안·제외 사유, 실행 순서
- AI 상담: 저장된 분석 결과를 사용하는 `/api/chat` 요청과 규칙 기반 fallback
- 전문가 상담: `/api/share` 200 응답 후 `/api/consultations` 202 응답
- 부모님 초대: 7일 만료 암호화 결과 링크 생성
- 뉴스·콘텐츠 전체보기, 공지사항, 고객센터, 마이 분류 메뉴

## 반응형 결과

| 너비 | 가로 넘침 | 서비스 시트 폭 | 추천 상세 |
|---:|---|---|---|
| 320px | 없음 | 320px | 정상 |
| 375px | 없음 | 375px | 정상 |
| 390px | 없음 | 390px | 정상 |
| 500px | 없음 | 500px | 정상 |

검증 중 `body.scrollWidth`, `.app.scrollWidth`는 모든 너비에서 viewport와 같았습니다. 브라우저 콘솔의 앱 오류와 프레임워크 오류 오버레이는 없었습니다.

## 스크린샷

- `silver-news-sheet-390.png`
- `silver-notices-320.png`
- `silver-notices-375.png`
- `silver-notices-500.png`
- `silver-recommendation-320.png`
- `silver-recommendation-375.png`
- `silver-recommendation-390.png`
- `silver-recommendation-500.png`

`playwright-mcp/`에는 접근성 스냅샷과 브라우저 점검 로그가 있습니다.
