# PLUS 부모님 노후 준비

부모님의 부동산, 연령, 거주 계획을 바탕으로 노후 현금흐름과 자산 유동화 대안을 살펴보는 모바일 중심 웹 서비스입니다.

## 배포 주소

- `chulwan0123/aicamp` Vercel: <https://aicamp-silver-weld.vercel.app>
- `hyeji0503/hanwhaAiCamp` Vercel: <https://hanwha-ai-camp-silver.vercel.app>
- 주 저장소: <https://github.com/chulwan0123/aicamp>
- 공동 작업 저장소: <https://github.com/hyeji0503/hanwhaAiCamp>

두 GitHub 저장소에는 같은 SILVER 통합 결과를 유지합니다. 화면·디자인 시스템·세금 및 추천 엔진은 `chulwan0123/aicamp`의 현행 구현을 기준으로 하며, 다음 주소검색·도로명주소 기반 PNU 생성·국토교통부 공동주택 공시가격 API 호출과 응답 처리는 `hyeji0503/hanwhaAiCamp` 구현을 통합했습니다.

## 실행 방법

Vercel 서버리스 API까지 함께 확인하려면 로컬 개발 서버를 실행합니다.

```bash
npm run dev
```

브라우저에서 `http://127.0.0.1:3000/`에 접속합니다. 환경변수는 `.env.example`을 참고해 `.env.local`에 설정하며 비밀키 파일은 저장소에 포함하지 않습니다.

## 현재 구현 범위

- 모바일 최적화 및 데스크톱 중앙 모바일 영역
- 해시 기반 화면 라우팅과 새로고침 시 현재 화면 복원
- 시작하기 전용 화면과 로그아웃 시 시작 화면 복귀
- 홈·마이 하단 탭과 고정 헤더
- 신규 사용자 시작 화면과 결과 경험 사용자 홈
- SILVER 로고, 자동 재생 영상, 로띠 애니메이션을 활용한 홈 비주얼
- plushome 기준 19개 본 화면과 부모님 연령, 주택 수·명의, 주소, 실거래가, 취득·거주, 희망 지역, 성향·소득, 최종 확인의 입력 8단계
- 모든 선택 필드의 하단 시트 UI와 심플 체크 상태
- 5초 분석 화면과 결과 요약
- 보유세, 양도소득세, 주택연금, 임차·금융운용, 다운사이징, 상속·증여 상세 화면
- 결과 화면의 AI 컨설팅 CTA와 대화형 상담 UI
- 결과 공유·상담 CTA
- 자산관리 뉴스 배너와 콘텐츠 목록
- 바로가기·추천·서비스 메뉴로 구성한 마이페이지
- 최신 세제개편안 안내 상세 화면
- 계산 입력·결과의 브라우저 저장과 인증 암호화된 7일 만료 공유 링크
- plushome 규칙 엔진 기반 재산세·종합부동산세·양도소득세·주택연금·다운사이징·금융운용·증여 계산
- OpenAI 응답 검증과 계산값 고정, AI 호출 실패 시 현재 입력값을 사용하는 규칙 기반 추천
- 다음 주소검색, 19자리 PNU 생성, 국토교통부 공동주택 공시가격 서버 API 조회
- 주소 데이터셋 미등록 시 다른 주택으로 대체하지 않는 명시적 오류 처리
- PLUS 디자인 토큰 기반 오렌지 600 핵심 액션 및 정보 강조 색상

계산 결과는 입력값과 포함된 규칙 버전을 바탕으로 한 예상값이며 실제 신고·심사 결과와 다를 수 있습니다.

## 문서

- [구현 현황과 보완 과제](./docs/IMPLEMENTATION.md)
- [세금 기준과 추천 알고리즘](./docs/TAX_AND_ALGORITHM.md)
- [반포자이 은퇴 부부 페르소나 및 자산관리 결론](./docs/반포자이_은퇴부부_페르소나_및_자산관리_결론.md)

## 기술 구성

- HTML5
- CSS3 및 PLUS 디자인 시스템 토큰·폰트
- Vanilla JavaScript
- Node.js 20 이상
- Vercel Functions (`/api/advise`, `/api/share`, `/api/price`, `/api/health`)
- Lottie 로컬 런타임과 MP4 미디어 에셋
- Lucide Icons 로컬 SVG 에셋
- Vercel

## 배포 방식

루트 정적 파일과 `api/**` 서버리스 함수를 Vercel에 함께 배포합니다. 운영 환경에는 `OPENAI_API_KEY`, `OPENAI_MODEL`, `USE_MOCK=false`, `SHARE_SECRET`, `PUBLIC_DATA_API_KEY`를 설정합니다. 비밀값은 저장소와 클라이언트 코드에 넣지 않습니다.

배포 전 `npm run check`를 실행하고, 운영 배포 후 `/`, `/api/health`, 모바일 320·375·390px 화면과 주소 검색 → PNU → `/api/price` 흐름을 확인합니다.

2026-08-20 배포는 Vercel `chulwan-8137` 계정의 `camp17` 범위에서 두 저장소를 각각 독립 프로젝트로 운영합니다. 현재 `USE_MOCK=true`와 프로젝트별 `SHARE_SECRET`은 설정되어 규칙 기반 분석과 암호화 공유를 사용할 수 있습니다. `OPENAI_API_KEY`와 `PUBLIC_DATA_API_KEY`는 제공되지 않아 AI 원격 호출은 규칙 기반 응답으로 대체되고, 실제 공동주택 공시가격 호출은 키 설정 전까지 명시적 오류를 반환합니다.
