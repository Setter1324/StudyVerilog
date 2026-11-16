import { useSyncExternalStore } from 'react';
import { parseHash } from './route';

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}
const getHash = () => window.location.hash;

// 자리표시 화면. 첫 화면은 최종계획서 5장, 플레이 화면은 6장을 따라 만든다.
export function App() {
  const route = parseHash(useSyncExternalStore(subscribe, getHash));

  switch (route.name) {
    case 'home':
      return <main><h1>KW STUDY SITE</h1><p>코드를 채우면, 회로가 걷기 시작해요.</p></main>;
    case 'stages':
      return <main><h1>스테이지</h1></main>;
    case 'play':
      return <main><h1>플레이 {route.id}</h1></main>;
    case 'guide':
      return <main><h1>도감</h1></main>;
    default:
      return <main><h1>찾을 수 없어요</h1><a href="#/">첫 화면으로</a></main>;
  }
}
