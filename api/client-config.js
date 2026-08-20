const KAKAO_SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.2/kakao.min.js';
const KAKAO_SDK_INTEGRITY = 'sha384-zt/G7/KfaRQ9dT/QIkS0ujMtzouJqzuSJcXVQu50x0rl/+mD1dc70AeOejVbMD9E';

export function clientConfig(env = process.env) {
  const javascriptKey = String(env.KAKAO_JAVASCRIPT_KEY || '').trim();
  return {
    kakao: {
      configured: Boolean(javascriptKey),
      ...(javascriptKey ? { javascriptKey } : {}),
      sdkUrl: KAKAO_SDK_URL,
      integrity: KAKAO_SDK_INTEGRITY,
    },
  };
}

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET 요청만 지원해요.' });
  return res.status(200).json(clientConfig());
}
