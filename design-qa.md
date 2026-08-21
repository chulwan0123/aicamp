# AI 추천 결론형 제목 — Design QA

- Source visual truth: `/Users/hanwha/Downloads/IMG_3564.PNG`
- Implementation screenshot: `qa-ai-recommendation-mobile.png`
- Combined comparison: `qa-ai-recommendation-comparison.png`
- Source pixels: 1206 × 2718 (휴대전화 화면 캡처)
- Browser viewport override: 393 × 852 CSS px
- Implementation capture pixels: 378 × 819
- State: 분석 결과 화면, `DOWNSIZE` 추천, AI 추천 카드가 보이는 위치
- Density normalization: 소스의 추천 영역을 잘라 최대 393 × 852 안으로 축소하고 구현 캡처와 나란히 비교함

## Full-view comparison evidence

전체 결과 화면에서 추천 카드가 기존 위계와 색상, 여백을 유지하며 표시되는지 확인했어요. 결론형 제목은 카드 안에서 설명보다 먼저 보이고, 월 예상액은 카드 아래 별도 지표에 남아 있어 정보 위계가 분리돼요.

## Focused region comparison evidence

AI 추천 카드와 바로 아래 월 예상액 영역을 집중 비교했어요. 소스의 금액 중심 제목 대신 사용자가 요청한 행동 결론인 `작은 집으로 옮기면 좋아요`가 한 줄로 표시돼요. 카드 설명, 예상액, 상세 보기 버튼은 기존 위치와 스타일을 유지해요.

## Findings

- P0/P1/P2 없음.
- 타이포그래피: 393px 모바일 기준에서 결론 제목이 한 줄이며 굵기와 크기가 기존 AI 추천 제목 위계를 유지해요.
- 간격과 레이아웃: 카드 내부 여백과 제목·설명 간 간격에 변화가 없어요.
- 색상과 토큰: 기존 주황색 AI 라벨과 연한 배경을 그대로 사용해요.
- 이미지 품질: 이번 변경 영역에는 새 이미지가 없으며 기존 아이콘 에셋을 그대로 사용해요.
- 카피: 추천 금액보다 `어떤 행동이 유리한지`를 먼저 보여주고, 금액은 아래 지표에서 확인할 수 있어요.

## Comparison history

1. 첫 구현에서는 `작은 집으로 옮기는 게 가장 유리해요`가 393px 화면에서 두 줄로 나뉘는 P2 문제가 있었어요.
2. 제목을 `작은 집으로 옮기면 좋아요`로 줄였고, 다시 캡처해 한 줄 표시를 확인했어요.

## Implementation checklist

- [x] 네 추천 유형을 결론형 제목으로 매핑
- [x] AI 응답과 기존 저장 결과도 같은 제목 규칙 적용
- [x] 금액은 제목에서 제거하고 월 예상액 영역에 유지
- [x] 모바일 한 줄 표시 확인
- [x] 브라우저 콘솔 오류 없음

final result: passed
