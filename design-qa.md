# 결과 상세 디자인 QA

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

final result: passed
