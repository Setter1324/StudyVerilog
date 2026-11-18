import { useEffect, useSyncExternalStore } from 'react';
import { Free } from './free/Free';
import { Home } from './Home';
import { Play } from './play/Play';
import { parseHash } from './route';
import { Stages } from './Stages';
import { TopBar } from './TopBar';
import { UiGallery } from './UiGallery';

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}
const getHash = () => window.location.hash;

export function App() {
  const route = parseHash(useSyncExternalStore(subscribe, getHash));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.name]);

  switch (route.name) {
    case 'home':
      return <Home />;
    case 'stages':
      return <Stages />;
    case 'play':
      return <Play key={route.id} id={route.id} />;
    case 'free':
      return <Free />;
    case 'guide':
      return (
        <>
          <TopBar current="guide" />
          <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px clamp(20px, 4vw, 56px)' }}>
            <h1>도감</h1>
            <p>비유 체계와 문법 요약은 3단계에서 채워요.</p>
          </main>
        </>
      );
    case 'ui':
      return <UiGallery />;
    default:
      return (
        <main style={{ padding: 24 }}>
          <h1>찾을 수 없어요</h1>
          <a href="#/">첫 화면으로</a>
        </main>
      );
  }
}
