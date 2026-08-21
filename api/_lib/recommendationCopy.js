const CONCLUSION_HEADLINE = {
  HOLD: '지금 집을 계속 보유해도 좋아요',
  SELL: '집을 파는 게 더 유리해요',
  DOWNSIZE: '작은 집으로 옮기면 좋아요',
  PARTIAL: '집 일부를 임대하면 좋아요',
  PENSION: '주택연금이 가장 잘 맞아요',
};

/** 추천 카드의 첫 문장은 금액보다 사용자가 취할 행동을 먼저 알려준다. */
export function recommendationHeadline(id) {
  return CONCLUSION_HEADLINE[id] || '이 방법이 현재 가장 잘 맞아요';
}
