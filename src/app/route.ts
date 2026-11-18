// 해시 라우팅: GitHub Pages와 COM's 하위 경로 어디서나 새로고침이 깨지지 않는다. (최종계획서 4장)
export type Route =
  | { name: 'home' }
  | { name: 'stages' }
  /** ms: 개발용. 실행한 뒤 대본의 그 위치(ms)를 그리고 멈춘다(#/play/v1-04?ms=5400, 순차 재생 계획 10장) */
  | { name: 'play'; id: string; ms?: number }
  /** 자유 Verilog(연습장, 순차 재생과 게이트 입구 계획 8.1) */
  | { name: 'free' }
  | { name: 'guide' }
  | { name: 'ui' }
  | { name: 'notFound' };

export function parseHash(hash: string): Route {
  const [rawPath = '', query = ''] = hash.split('?');
  const path = rawPath.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (path === '') return { name: 'home' };
  if (path === 'stages') return { name: 'stages' };
  if (path === 'free') return { name: 'free' };
  if (path === 'guide') return { name: 'guide' };
  if (path === 'ui') return { name: 'ui' }; // 컴포넌트 보기 (개발용, 메뉴에 없다)
  const play = /^play\/([A-Za-z0-9_-]+)$/.exec(path);
  if (play?.[1]) {
    const ms = /(?:^|&)ms=(\d+(?:\.\d+)?)(?:&|$)/.exec(query)?.[1];
    return ms === undefined ? { name: 'play', id: play[1] } : { name: 'play', id: play[1], ms: Number(ms) };
  }
  return { name: 'notFound' };
}
