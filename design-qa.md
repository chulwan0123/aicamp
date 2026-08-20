# 결과 상세 디자인 QA

> 상태 갱신(2026-08-21): 첫 번째 구역은 추천 상세의 역사적 QA이고, 아래 두 번째 구역은 화면 3 검색 UI의 별도 QA다. 운영 기준은 `https://aicamp-sigma.vercel.app`이다.

- source visual truth: `/Users/chulwan/Documents/Codex/2026-08-20/https-github-com-chulwan0123-aicamp-2/output/silver-demo-qa-2026-08-20/21-recommended-detail.png`
- implementation screenshot: `/tmp/silver-recommendation-current-fixed.png`
- normalized app crop: `/tmp/silver-recommendation-app-fixed.png`
- source pixels: 390 × 844
- implementation pixels: 1280 × 720, 앱 영역 500 × 720 CSS px
- density: 두 캡처 모두 CSS 기준 1배. 구현 화면은 데스크톱 캔버스의 가운데 앱 영역을 500 × 720으로 잘라 비교했다.
- state: 실제 입력을 마친 뒤의 `종합 결과 > 추천 상세`, 다운사이징 추천 상태

## Findings

- P0/P1/P2 잔여 항목 없음.
- P3: 구현 화면에는 `추천 후 월 부족액`과 `현재 남는 전체 자산` 카드가 추가되어 있다. 외부 데모보다 근거가 분명해지는 의도적인 제품 개선이며 핵심 위계는 바꾸지 않는다.
- P3: 비교 입력의 계산 결과가 달라 제목과 금액 줄바꿈이 일부 다르다. 고정 문구가 아니라 실제 입력값에 따라 바뀌는 정상 동작이다.

## Full-view comparison evidence

- 상단 바, 주황색 보조 제목, 굵은 추천 제목, 설명, 검은 핵심 금액 카드, 살구색 진행선, 하단 고정 CTA의 순서와 표면 스타일이 외부 데모와 일치한다.
- 구현은 외부 데모와 같은 흑백·주황 팔레트, 카드 반경, 제목 대비, 섹션 흐름을 유지한다.
- 앱·활성 화면 모두 `scrollWidth === clientWidth`로 확인되어 가로 넘침이 없다.

## Focused region comparison evidence

- 별도 확대가 필요하지 않았다. 함께 연 이미지에서 상단 제목·설명·핵심 금액 카드·진행선·첫 CTA의 글자와 여백을 읽을 수 있는 크기로 비교했다.
- 결과 상세의 여섯 섹션 제목은 DOM 스냅샷으로 모두 확인했다.

## Required fidelity surfaces

- Fonts and typography: 같은 한국어 산세리프 계열, 강한 제목/보조 본문 대비, 해요체를 유지한다. 동적 금액은 외부와 같은 `억·만원` 표기로 렌더링한다.
- Spacing and layout: 20px 안팎의 좌우 여백, 큰 섹션 간격, 검은 핵심 카드와 하단 CTA의 비례가 일치한다. 추가 근거 카드는 의도적이다.
- Colors and tokens: 검정 핵심 카드, 주황색 보조 문구·CTA, 살구색 진행선, 흰 배경이 일치한다.
- Image quality: 이 화면은 사진·일러스트·로고 자산을 사용하지 않는다. 아이콘은 기존 Lucide 화살표 자산을 유지한다.
- Copy and content: 외부 데모의 쉬운 해요체와 여섯 설명 구역을 그대로 따르되, 숫자와 자격은 규칙 엔진 결과만 사용한다.
- Accessibility and behavior: 뒤로가기와 CTA는 실제 버튼이며, 화면 폭을 넘지 않는다. 브라우저 콘솔 error/warn은 0건이다.

## Comparison history

1. 첫 비교에서 추천 이름과 제목이 반복되고, 검은 카드가 여러 행으로 나뉘며, 이유·감수점 설명 카드 표면이 외부 데모와 달랐다(P2).
2. 정적 제목 중복을 제거하고 `권해 드리는 방법` 보조 제목으로 통일했다. 검은 카드를 `매달 쓰실 수 있는 돈 + 생활비 대비 비율 + 진행선` 구조로 바꾸고 이유·감수점에 외곽선 카드를 적용했다.
3. 수정 후 같은 결과 상태를 다시 캡처해 외부 데모와 한 입력에서 함께 비교했다. 상단 정보 위계, 카드 표면, 설명 어투, CTA 위치에 남은 P0/P1/P2 차이가 없음을 확인했다.

## Primary interactions tested

- 8단계 실제 입력 및 최종 확인
- 1주택 실제 주소·동·호·공시가격·시세·취득가 입력
- 결과 요약 생성
- 추천 상세 진입 및 여섯 설명 구역 렌더링
- 저장된 결과 복원 후 상세 딥링크 재진입
- 모바일 가로 넘침 검사
- 브라우저 콘솔 오류·경고 검사

final result: 추천 상세 기준 passed.

---

# 2026-08-21 주택 검색 UI 디자인 QA

- source visual truth: `/tmp/codex-remote-attachments/01a01d40-ee5b-7f52-a92e-cb410ce494e2/3FE70AD3-C862-4215-87E4-635F155DBBA2/2-사진-2.jpg`
- implementation screenshots: `output/property-search-qa-2026-08-21/updated-390.jpg`, `output/property-search-qa-2026-08-21/area-sheet-390.jpg`
- combined comparison: `output/property-search-qa-2026-08-21/comparison.jpg`
- state: `3/8 주택 입력 → 서울특별시 → 서초구 → 반포자이 → 전용 84.943㎡`

## Findings

- P0/P1/P2 잔여 항목 없음.
- 참고 화면의 `닫기` 텍스트는 서비스의 기존 바텀시트 계약인 Lucide `x` 아이콘으로 유지했다. 닫기 기능과 44px 터치 영역은 같다.
- 참고 화면에는 2026 예상 공시가격이 표시되지만, 구현은 실제 보유세 과세표준에 사용하는 2025년 국토교통부 호별 공시가격의 최소·최대 범위를 표시한다. 데이터 의미를 보존하기 위한 의도적인 차이다.

## Comparison evidence

- 입력 순서는 참고 화면과 같은 `시/도 → 시/군/구 → 단지명 검색 → 전용면적 선택`이다.
- 전용면적 바텀시트는 상단 핸들, 제목, 단지명·면적 개수, 둥근 면적 카드, 세대수, 가격 범위의 위계를 맞췄다.
- 도로명주소는 13px 라벨·44px 읽기 전용 필드로 축소해 주 입력 흐름 아래 보조 정보로 배치했다.
- 검색 아이콘과 화살표·닫기 아이콘은 기존 `assets/icons/lucide/**` 자산을 사용했다. CSS 도형이나 새 인라인 SVG는 없다.

## Responsive and behavior verification

- 320·375·390·500px 요청 너비에서 브라우저 뷰포트 검증과 스크린샷을 수행했다. 인앱 브라우저의 화면 배율이 적용된 상태에서도 각 검사에서 `scrollWidth === clientWidth`였다.
- 시/도 변경 시 시/군/구가 실제 서울·경기 목록으로 갱신되고, 하위 단지·면적·PNU 선택은 초기화된다.
- 서초구 `반포자이` 검색은 실제 PNU `1165010700000200043`, 도로명주소, 16개 전용면적을 반환했다.
- 전용 84.943㎡와 101동 101호 선택 후 다음 단계에서 2025년 공시가격 2,462,000,000원이 자동 조회됐다.
- 키보드 Enter 검색, Escape/배경/닫기 버튼으로 시트 닫기, 선택 후 동·호수 포커스 이동을 확인했다.
- 단지 선택 주소를 별도 상태에 보존해 입력칸 값이 유실돼도 다음 단계에서 도로명주소를 복원한다.
- `npm run check`: 도로명주소 복원, 거주기간 구간 하한값, 현재 거주 자동 판정 방지, 간소화 가정 노출 회귀 테스트를 포함해 84개 테스트 통과.

final result: passed
