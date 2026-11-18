// 대본 시계. 플레이 장면의 모든 움직임은 "대본 위의 위치(ms)" 하나의 함수다. 컴포넌트마다 타이머를 두지 않는다.
// 원칙: 바뀐 값만, 차례대로, 한 번씩 걷는다. 걷는 동안 시간은 멈추고, 시간은 건물에서 숫자로 읽는다.
// (순차 재생과 게이트 입구 계획 3장, 5.3)
import type { Change, Step, Wave } from '../sim/script';

/** 물결 하나가 걷는 시간. 길 길이와 상관없다(거리는 속도가 흡수한다) */
export const WALK_MS = 700;
/** 건물이 문 앞의 값을 읽는 시간 */
export const GATE_MS = 250;
/** 지연 1틱마다 더하는 시간이자 지연 칸 하나가 차는 시간 */
export const GATE_TICK_MS = 150;
/** 지연을 이 틱 수까지만 시간에 더한다 */
export const GATE_TICKS_MAX = 6;
/** 구간 사이. 시각이 다음 자극 시각까지 넘어간다 */
export const GAP_MS = 300;
/** 한 구간의 상한. 넘으면 그 구간만 같은 비율로 줄인다 */
export const STEP_MAX_MS = 6000;
/** 한 번 걷는 걸음 수 */
export const STEPS_PER_WALK = 4;
/** 걷기의 앞 이 비율 동안 나타난다 */
export const FADE = 0.08;
/** 서는 자세로 돌아가는 시간(ms). tokens.css의 --dur-ui와 같다 */
export const BLEND_MS = 180;

export type PieceKind = 'gate' | 'walk' | 'gap';

/** 대본의 조각. 시각 t는 건물에서 한 틱씩 오르고, 걷는 동안 멈추고, 기다림에서 다음 자극까지 넘어간다 */
export interface Piece {
  kind: PieceKind;
  step: number;
  /** 구간 안의 물결 번호. 기다림은 -1 */
  wave: number;
  /** 대본 위의 시작(ms)과 길이 */
  start: number;
  dur: number;
  /** 건물: 값을 읽는 시간(ms). 그 뒤로 시각이 한 틱씩 오른다 */
  hold: number;
  /** 조각의 처음과 끝 시각 */
  t0: number;
  t1: number;
}

export interface Layout {
  steps: Step[];
  pieces: Piece[];
  /** 대본 전체 길이(ms) */
  total: number;
  /** $finish 시각 */
  end: number;
  /** 구간마다 시작 위치(ms) */
  stepStarts: number[];
}

/**
 * 조각마다 시작 위치를 미리 계산한다.
 * @param reduced 움직임 줄이기: 걷지 않고 새 값의 알파카가 문 앞에 바로 선다. 걷기 조각은 절반 길이다
 */
export function layoutScript(steps: Step[], end: number, { reduced = false } = {}): Layout {
  const pieces: Piece[] = [];
  const stepStarts: number[] = [];
  let at = 0;
  steps.forEach((step, si) => {
    const own: Omit<Piece, 'start'>[] = [];
    let prevT = step.start;
    step.waves.forEach((w, wi) => {
      if (w.gates.length) {
        // 시각은 뒤로 가지 않는다: 건물 조각은 max(앞 물결의 시각, t − N)에서 시작한다
        const delay = Math.max(...w.gates.map((g) => g.delay));
        const t0 = Math.min(w.t, Math.max(prevT, w.t - delay));
        const ticks = Math.min(w.t - t0, GATE_TICKS_MAX);
        own.push({ kind: 'gate', step: si, wave: wi, dur: GATE_MS + GATE_TICK_MS * ticks, hold: GATE_MS, t0, t1: w.t });
      }
      own.push({ kind: 'walk', step: si, wave: wi, dur: reduced ? WALK_MS / 2 : WALK_MS, hold: 0, t0: w.t, t1: w.t });
      prevT = w.t;
    });
    own.push({ kind: 'gap', step: si, wave: -1, dur: GAP_MS, hold: 0, t0: prevT, t1: Math.max(prevT, step.end) });
    const sum = own.reduce((a, p) => a + p.dur, 0);
    const k = sum > STEP_MAX_MS ? STEP_MAX_MS / sum : 1;
    stepStarts.push(at);
    for (const p of own) {
      pieces.push({ ...p, start: at, dur: p.dur * k, hold: p.hold * k });
      at += p.dur * k;
    }
  });
  return { steps, pieces, total: at, end, stepStarts };
}

export interface Frame {
  /** 조각 번호. 끝이면 pieces.length */
  piece: number;
  step: number;
  /** 구간 안의 물결 번호. 기다림과 끝은 -1 */
  wave: number;
  kind: PieceKind | 'end';
  /** 조각 안의 진행률 0~1 */
  p: number;
  /** 화면의 시각 */
  t: number;
}

const EPS = 1e-9;

/** 대본 위의 위치 ms에서의 장면 */
export function frameAt(layout: Layout, ms: number): Frame {
  const { pieces } = layout;
  if (!pieces.length || ms >= layout.total) {
    return { piece: pieces.length, step: Math.max(0, layout.steps.length - 1), wave: -1, kind: 'end', p: 1, t: layout.end };
  }
  const x = Math.max(0, ms);
  // 시작이 x 이하인 마지막 조각
  let lo = 0;
  let hi = pieces.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (pieces[mid]!.start <= x) lo = mid;
    else hi = mid - 1;
  }
  const pc = pieces[lo]!;
  const e = x - pc.start;
  const p = pc.dur > 0 ? Math.min(1, e / pc.dur) : 1;
  let t = pc.t0;
  if (pc.kind === 'gate' && pc.t1 > pc.t0) {
    const rise = pc.dur - pc.hold;
    const f = rise > 0 ? Math.max(0, Math.min(1, (e - pc.hold) / rise)) : 1;
    t = pc.t0 + Math.floor((pc.t1 - pc.t0) * f + EPS);
  } else if (pc.kind === 'gap') {
    t = pc.t0 + Math.floor((pc.t1 - pc.t0) * p + EPS);
  }
  return { piece: lo, step: pc.step, wave: pc.wave, kind: pc.kind, p, t: Math.min(t, pc.t1) };
}

/** 시각 T까지의 변화가 모두 끝난 자리(ms). 건너뛰기(슬라이더, 파형 클릭)에 쓴다 */
export function msAtTime(layout: Layout, T: number): number {
  const { pieces } = layout;
  if (T >= layout.end) return layout.total;
  const waveOf = (pc: Piece): Wave | undefined => layout.steps[pc.step]?.waves[pc.wave];
  // 시각이 T 이하인 물결이 모두 걷고 난 자리
  let from = 0;
  pieces.forEach((pc, k) => {
    if (pc.kind === 'walk' && (waveOf(pc)?.t ?? Infinity) <= T) from = k + 1;
  });
  for (let k = from; k < pieces.length; k++) {
    const pc = pieces[k]!;
    if (pc.t0 >= T) return pc.start;
    if (pc.t1 < T) continue;
    const f = (T - pc.t0) / (pc.t1 - pc.t0);
    if (pc.kind === 'gate') return pc.start + pc.hold + f * (pc.dur - pc.hold);
    if (pc.kind === 'gap') return pc.start + f * pc.dur;
  }
  return layout.total;
}

/**
 * 아직 걷지 않은 물결의 변화. 이 신호들은 시각이 이미 바뀐 때여도 옛 값(from)을 보여 준다.
 * 지연이 없는 건물(assign)은 입력과 출력이 같은 시각에 바뀌어서, 차례를 시각만으로는 나눌 수 없다.
 */
export function pendingChanges(layout: Layout, f: Frame): Change[] {
  if (f.kind === 'end') return [];
  const step = layout.steps[f.step];
  if (!step) return [];
  const first = f.kind === 'gap' ? step.waves.length : f.kind === 'gate' ? f.wave : f.wave + 1;
  return step.waves.slice(first).flatMap((w) => (w.t === f.t ? w.changes : []));
}

/** 지금 걷는 물결(걷기 조각일 때) */
export function walkingWave(layout: Layout, f: Frame): Wave | null {
  return f.kind === 'walk' ? (layout.steps[f.step]?.waves[f.wave] ?? null) : null;
}

/** 재생 시계의 기준점: 재생을 시작한(속도를 바꾸거나 건너뛴) 순간의 대본 위치와 시각(ms), 속도 */
export interface PlayBase {
  ms: number;
  at: number;
  speed: number;
}

/** 기준점에서 시각 now의 대본 위치. 매 프레임 기준점에서 계산하므로 늦어진 시간이 쌓이지 않는다 */
export const posAt = (base: PlayBase, now: number) => base.ms + (now - base.at) * base.speed;

/** 구간이 끝날 때 네온이 꺼지는 시간(ms). --dur-ui와 같다 */
export const NEON_FADE_MS = 180;

/** 대본 위치에서 월드가 그릴 것: 걷기, 네온, 꼬리표. 길과 건물의 순서는 장면 JSON과 같다 (계획 5.5, 6.1, 6.2) */
export interface ScriptView {
  /** 길마다 걷는 진행률(0~1). null이면 문 앞에 선다 */
  walk: (number | null)[];
  /** 길마다 네온 선의 진행률. 이번 구간에 걸었으면 1, 걷는 중이면 진행률, 아니면 null */
  trail: (number | null)[];
  /** 건물마다 바닥 테두리가 켜졌는지(이번 구간에 지났거나 지나는 중) */
  gates: boolean[];
  /** 네온의 세기 0~1. 구간 끝에서 꺼진다 */
  glow: number;
  /** 길마다 꼬리표를 보일지(이번 구간에 건물을 나와 걸었거나 걷는 출력) */
  tags: boolean[];
}

/**
 * @param roads 장면의 길마다 신호 이름
 * @param gateIds 장면의 건물 id
 * @param reduced 움직임 줄이기: 걷지 않고, 선은 그어지는 움직임 없이 바로 켠다
 */
export function scriptView(layout: Layout, ms: number, roads: string[], gateIds: string[], { reduced = false } = {}): ScriptView {
  const f = frameAt(layout, ms);
  const none: ScriptView = { walk: roads.map(() => null), trail: roads.map(() => null), gates: gateIds.map(() => false), glow: 0, tags: roads.map(() => false) };
  if (f.kind === 'end') return none;
  const step = layout.steps[f.step];
  if (!step) return none;
  // 다 걸은 물결, 걷는 물결, 지나는 건물
  const walked = f.kind === 'gap' ? step.waves.length : f.wave;
  const done = step.waves.slice(0, walked);
  const walking = f.kind === 'walk' ? step.waves[f.wave] : undefined;
  const passing = f.kind === 'gate' || f.kind === 'walk' ? step.waves[f.wave] : undefined;
  const doneSig = new Set(done.flatMap((w) => w.changes.map((c) => c.signal)));
  const walkSig = new Set((walking?.changes ?? []).map((c) => c.signal));
  const outSig = new Set([...done, ...(walking ? [walking] : [])].filter((w) => w.level > 0).flatMap((w) => w.changes.map((c) => c.signal)));
  const lit = new Set([...done, ...(passing ? [passing] : [])].flatMap((w) => w.gates.map((g) => g.id)));
  const pc = layout.pieces[f.piece]!;
  const glow = f.kind === 'gap' ? Math.max(0, Math.min(1, (pc.start + pc.dur - ms) / NEON_FADE_MS)) : 1;
  return {
    walk: roads.map((s) => (walkSig.has(s) && !reduced ? f.p : null)),
    trail: roads.map((s) => (walkSig.has(s) ? (reduced ? 1 : f.p) : doneSig.has(s) ? 1 : null)),
    gates: gateIds.map((id) => lit.has(id)),
    glow,
    tags: roads.map((s) => outSig.has(s)),
  };
}

/** 이번 구간에서 지금까지 바뀐 신호(걸었거나 걷는 중). 파형의 줄 이름에 네온을 단다 */
export function changedSoFar(layout: Layout, f: Frame): Set<string> {
  const step = layout.steps[f.step];
  if (f.kind === 'end' || !step) return new Set();
  const upto = f.kind === 'gap' ? step.waves.length : f.kind === 'walk' ? f.wave + 1 : f.wave;
  return new Set(step.waves.slice(0, upto).flatMap((w) => w.changes.map((c) => c.signal)));
}
