# PLUS 부모님 노후 준비

부모님의 부동산, 연령, 거주 계획을 바탕으로 노후 현금흐름과 자산 유동화 대안을 살펴보는 모바일 중심 웹 서비스입니다.

## 배포 주소

- 현재 운영: <https://aicamp-sigma.vercel.app>
- 현재 운영 배포 원본: <https://aicamp-4t9tvxm64-oxaz1234-gmailcoms-projects.vercel.app>
- 현재 저장소: <https://github.com/chulwan0123/aicamp>
- 배포 기준 브랜치·커밋: `codex/fix-my-shortcut-font-14-5` · `197fb528f5765beb98795a3e9524c74d308bd661`
- Vercel 프로젝트: `oxaz1234-gmailcoms-projects/aicamp`
- 운영 계정 이메일: `Oxaz1234@gmail.com`

2026-08-21 현재 운영 별칭은 Vercel 배포 `dpl_CZpJ8mVZeuKon5D9GLpeNyx8YFCH`를 가리키며 상태는 `Ready`입니다. 이 배포는 위 커밋의 깨끗한 작업 트리에서 수동 생성했습니다. 로컬의 미커밋 단지 검색 변경은 아직 운영에 포함되지 않았습니다.

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
- 현재 계산값만 답변에 허용하는 `/api/chat` 기반 AI 컨설팅
- 카카오 JavaScript SDK를 우선 사용하고 일반 공유·클립보드로 대체 가능한 암호화 결과 공유와 부모님 초대
- 검증된 연락처와 암호화 결과 링크를 운영 웹훅으로 전달하는 전문가 상담 접수
- 상세 내용이 연결된 자산관리 뉴스 배너와 콘텐츠 목록
- 공지·고객센터·분류별 바로가기가 연결된 마이페이지
- 최신 세제개편안 안내 상세 화면
- 계산 입력·결과의 브라우저 저장과 인증 암호화된 7일 만료 공유 링크
- plushome 규칙 엔진 기반 재산세·종합부동산세·양도소득세·주택연금·다운사이징·금융운용·증여 계산
- OpenAI 응답 검증과 계산값 고정, AI 호출 실패 시 현재 입력값을 사용하는 규칙 기반 추천
- 서울·경기 2025년 공동주택 공시가격 7,138,888세대의 PNU·동·호·전용면적 일치 조회
- 동일 PNU 지번·단지명·전용면적 기준 매매·전월세 실거래 조회와 취소 매매 제외
- 주소 데이터셋 미등록 시 다른 주택으로 대체하지 않는 명시적 오류 처리
- PLUS 디자인 토큰 기반 오렌지 600 핵심 액션 및 정보 강조 색상

계산 결과는 입력값과 포함된 규칙 버전을 바탕으로 한 예상값이며 실제 신고·심사 결과와 다를 수 있습니다.

## 문서

- [구현 현황과 보완 과제](./docs/IMPLEMENTATION.md)
- [서울·경기 공공데이터 3종 출시 구현 보고서](./docs/SEOUL_GYEONGGI_PUBLIC_DATA_IMPLEMENTATION.md)
- [Vercel 운영 배포 현황 및 인계 문서](./docs/VERCEL_DEPLOYMENT_HANDOFF.md)
- [세금 기준과 추천 알고리즘](./docs/TAX_AND_ALGORITHM.md)
- [반포자이 은퇴 부부 페르소나 및 자산관리 결론](./docs/반포자이_은퇴부부_페르소나_및_자산관리_결론.md)

## 기술 구성

- HTML5
- CSS3 및 PLUS 디자인 시스템 토큰·폰트
- Vanilla JavaScript
- Node.js 22
- Vercel Functions (`/api/advise`, `/api/chat`, `/api/client-config`, `/api/consultations`, `/api/share`, `/api/price`, `/api/market`, `/api/auth/**`, `/api/health`)
- Lottie 로컬 런타임과 MP4 미디어 에셋
- Lucide Icons 로컬 SVG 에셋
- Vercel

## 배포 방식

루트 정적 파일과 `api/**` 서버리스 함수를 Vercel에 함께 배포합니다. 운영 환경에는 `OPENAI_API_KEY`, `OPENAI_MODEL`, `USE_MOCK=false`, `SHARE_SECRET`, `DATA_GO_KR_API_KEY`, `AUTH_SESSION_SECRET`, `KAKAO_JAVASCRIPT_KEY`, `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`, `KAKAO_REDIRECT_URI`가 설정돼 있습니다. 상담 실접수에는 `CONSULTATION_WEBHOOK_URL`이 추가로 필요하며, 수신 채널이 서명을 지원하면 `CONSULTATION_WEBHOOK_SECRET`도 설정합니다. 비밀값은 저장소와 클라이언트 코드에 넣지 않습니다.

카카오디벨로퍼스 앱의 JavaScript 키에는 운영 주소를 `JavaScript SDK 도메인`으로 등록하고, 같은 주소를 `제품 링크 관리 > 웹 도메인`에도 등록해야 합니다. 키가 없거나 SDK 연결에 실패하면 기존 버튼은 기기 공유 화면을 열고, 그것도 지원하지 않는 환경에서는 암호화 링크를 클립보드에 복사합니다.

배포 전 `npm run check`를 실행하고, 운영 배포 후 `/`, `/api/health`, 모바일 320·375·390px 화면과 주소 검색 → PNU → `/api/price`·`/api/market` 흐름을 확인합니다.

공시가격은 저장소의 2025년 서울·경기 전체 압축 조각을 조회하므로 API 키가 필요 없습니다. 매매·전월세 실거래만 서버의 `DATA_GO_KR_API_KEY`를 사용합니다. 반포자이는 테스트·스모크 예시일 뿐 운영 폴백이 아닙니다.

## 현재 미커밋 개발 상태

2026-08-21 로컬 작업 트리에는 `시/도 → 시/군/구 → 단지 → 전용면적 → 동·호` 검색과 `/api/complexes`를 추가하는 별도 변경이 있습니다. 2025년 서울·경기 69개 시군구 조각, 192,195개 단지 색인을 사용하며 현재 `npm run check` 75개가 통과합니다. 시각 QA 증거는 `design-qa.md`에 추가됐지만 아직 미커밋·미배포 상태이므로 운영 기능으로 간주하지 않습니다.

## 알려진 계산 출시 차단 항목

- 다주택 양도세에도 1주택용 12억원 초과분 과세비율이 적용됩니다.
- 주택별 `isAdjustedArea`가 양도세 계산 호출에 전달되지 않습니다.

보유세 포트폴리오 계산과 별개인 양도세 엔진 문제입니다. 수정·회귀 테스트·세무 검증 전에는 다주택 양도세 결과를 출시 확정값으로 사용하지 않습니다.
