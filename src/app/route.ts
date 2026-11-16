// 해시 라우팅: GitHub Pages와 COM's 하위 경로 어디서나 새로고침이 깨지지 않는다. (최종계획서 4장)
export type Route =
  | { name: 'home' }
  | { name: 'stages' }
  | { name: 'play'; id: string }
  | { name: 'guide' }
  | { name: 'notFound' };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (path === '') return { name: 'home' };
  if (path === 'stages') return { name: 'stages' };
  if (path === 'guide') return { name: 'guide' };
  const play = /^play\/([A-Za-z0-9_-]+)$/.exec(path);
  if (play?.[1]) return { name: 'play', id: play[1] };
  return { name: 'notFound' };
}
