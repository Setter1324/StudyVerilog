// 효과음: 음원 파일 없이 Web Audio로 코드에서 만든다. (최종계획서 7.8)
// 계획서는 ZzFX를 적었지만, 소리 다섯 가지면 오실레이터와 노이즈로 충분해 의존성을 더하지 않았다.
// 소리는 기본이 꺼짐이고, 상단 바의 소리 버튼(진행도 저장소의 sound)이 켜고 끈다.
import { useProgress } from '../state/progress';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!useProgress.getState().sound) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface Note {
  freq: number;
  to?: number; // 끝 주파수(미끄러짐)
  at?: number; // 시작(초)
  dur: number;
  type?: OscillatorType;
  gain?: number;
}

function play(notes: Note[]) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + 0.01;
  for (const n of notes) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    const start = t0 + (n.at ?? 0);
    const end = start + n.dur;
    osc.type = n.type ?? 'triangle';
    osc.frequency.setValueAtTime(n.freq, start);
    if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, end);
    const peak = n.gain ?? 0.12;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(g).connect(ac.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

function noise(dur: number, gain: number, from: number, to: number) {
  const ac = audio();
  if (!ac) return;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  const t0 = ac.currentTime + 0.01;
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(t0);
}

export const sfx = {
  /** 실행을 눌렀다 */
  run: () => play([{ freq: 520, to: 780, dur: 0.09, type: 'square', gain: 0.05 }]),
  /** 신호 값이 바뀌어 알파카가 건물을 지났다 */
  step: (up: boolean) => play([{ freq: up ? 660 : 440, dur: 0.07, type: 'triangle', gain: 0.07 }]),
  /** x(안개)가 생겼다 */
  fog: () => noise(0.35, 0.06, 1800, 400),
  /** 정답: 종 */
  pass: () =>
    play([
      { freq: 784, dur: 0.18, type: 'sine', gain: 0.12 },
      { freq: 988, at: 0.1, dur: 0.18, type: 'sine', gain: 0.12 },
      { freq: 1319, at: 0.2, dur: 0.45, type: 'sine', gain: 0.12 },
    ]),
  /** 오답: 낮게 떨어지는 소리 */
  fail: () =>
    play([
      { freq: 330, to: 196, dur: 0.28, type: 'sawtooth', gain: 0.05 },
      { freq: 247, to: 147, at: 0.16, dur: 0.32, type: 'sawtooth', gain: 0.05 },
    ]),
  /** 컴파일 오류 */
  error: () => play([{ freq: 180, dur: 0.18, type: 'square', gain: 0.05 }]),
};
