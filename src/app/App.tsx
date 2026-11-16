import { useEffect, useSyncExternalStore } from 'react';
import { stageById } from '../state/content';
import { useProgress } from '../state/progress';
import { Home } from './Home';
import { parseHash } from './route';
import { Stages } from './Stages';
import { TopBar } from './TopBar';
import { UiGallery } from './UiGallery';

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}
const getHash = () => window.location.hash;

/** 플레이 화면 자리표시. 6장(플레이 화면)은 14.2의 5~6번에서 만든다 */
function PlayPlaceholder({ id }: { id: string }) {
  const open = useProgress((p) => p.open);
  const stage = stageById(id);
  useEffect(() => {
    if (stage) open(stage.id);
  }, [stage, open]);
  return (
    <>
      <TopBar current="play" />
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '24px clamp(20px, 4vw, 56px)' }}>
        <h1>{stage ? `${stage.no} ${stage.title}` : '찾을 수 없는 스테이지예요'}</h1>
        <p>플레이 화면은 준비 중이에요.</p>
        <a href="#/stages">스테이지 목록으로</a>
      </main>
    </>
  );
}

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
      return <PlayPlaceholder id={route.id} />;
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
