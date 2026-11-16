// 배경음: content/audio.json의 bgm에 적은 public/audio/ 파일을 반복 재생한다. 없으면 아무것도 하지 않는다.
// 소리 버튼이 켜져 있고, 사용자가 한 번이라도 화면을 누른 뒤에만 재생된다(브라우저 자동 재생 정책).
import config from '../../content/audio.json';
import { useProgress } from '../state/progress';

const BGM = config as { bgm: string | null; bgmVolume: number };
let el: HTMLAudioElement | null = null;

function element(): HTMLAudioElement | null {
  const file = BGM.bgm;
  if (!file) return null;
  if (!el) {
    el = new Audio(`${import.meta.env.BASE_URL}audio/${file}`);
    el.loop = true;
    el.volume = BGM.bgmVolume;
  }
  return el;
}

function sync() {
  const a = element();
  if (!a) return;
  if (useProgress.getState().sound) void a.play().catch(() => undefined);
  else a.pause();
}

/** 앱 시작 때 한 번 부른다 */
export function initBgm() {
  if (!BGM.bgm || typeof window === 'undefined') return;
  useProgress.subscribe(sync);
  // 첫 입력 뒤에 재생을 시도한다
  const first = () => {
    sync();
    window.removeEventListener('pointerdown', first);
    window.removeEventListener('keydown', first);
  };
  window.addEventListener('pointerdown', first);
  window.addEventListener('keydown', first);
}
