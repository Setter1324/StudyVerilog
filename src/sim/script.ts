// 순차 재생의 대본: 타임라인과 장면의 연결(건물의 in·out)로 "누가 언제 어떤 차례로 걷는지"를 만든다.
// 시간(ms)은 모른다. 재생 길이는 src/world/beat.ts가 정한다. (순차 재생과 게이트 입구 계획 5.1, 5.2)
// 플레이 화면과 Node 검증이 같이 쓸 수 있게 import에 .ts를 붙이고 런타임 TS 문법을 쓰지 않는다.
import type { Timeline } from './types.ts';

/** 장면 건물의 연결. 문이 어느 면에 있는지와는 상관없다 */
export interface Topology {
  gates: { id: string; in?: string[]; out?: string[]; trigger?: string[] }[];
}

/** 신호 하나의 값이 바뀐 것. 신호 이름은 bind의 짧은 이름이다 */
export interface Change {
  signal: string;
  from: string;
  to: string;
}

/** 같은 시각, 같은 단계의 변화 묶음. 같이 걷는다 */
export interface Wave {
  t: number;
  level: number;
  changes: Change[];
  /** 이 물결을 내보낸 건물과 코드의 지연(없으면 0). 단계 0이면 비어 있다 */
  gates: { id: string; delay: number }[];
}

/** 구간: 단계 0 신호가 바뀐 시각부터 다음에 바뀌는 시각까지 */
export interface Step {
  start: number;
  /** 다음 자극 시각. 마지막 구간은 $finish */
  end: number;
  waves: Wave[];
  /** 입력은 바뀌었지만 출력은 그대로인 건물 id */
  quiet: string[];
}

/**
 * 신호마다 단계. 테스트벤치가 직접 바꾸는 신호(어느 건물의 출력도 아닌 신호)는 0,
 * 건물의 출력은 입력 단계의 최댓값 + 1이다. trigger가 있으면 그 입력으로만 센다(기억 소자).
 * 입력이 없는 건물(물레방아)의 출력과, trigger 없이 자기 입력으로 돌아오는 고리 위의 신호는 0이다.
 */
export function signalLevels(topo: Topology, signals: string[]): Record<string, number> {
  const producer = new Map<string, Topology['gates'][number]>();
  for (const g of topo.gates) for (const o of g.out ?? []) producer.set(o, g);
  const inputsOf = (s: string) => {
    const g = producer.get(s);
    return g ? (g.trigger ?? g.in ?? []) : [];
  };
  // 고리 위의 신호: 자기에게서 출발해 다시 자기에게 닿는다
  const onLoop = (s: string) => {
    const seen = new Set<string>();
    const stack = [...inputsOf(s)];
    while (stack.length) {
      const x = stack.pop()!;
      if (x === s) return true;
      if (seen.has(x)) continue;
      seen.add(x);
      stack.push(...inputsOf(x));
    }
    return false;
  };
  const memo = new Map<string, number>();
  const level = (s: string): number => {
    const hit = memo.get(s);
    if (hit !== undefined) return hit;
    memo.set(s, 0); // 고리를 돌다 다시 오면 0으로 본다
    const ins = inputsOf(s);
    const v = !ins.length || onLoop(s) ? 0 : Math.max(...ins.map(level)) + 1;
    memo.set(s, v);
    return v;
  };
  const out: Record<string, number> = {};
  for (const s of signals) out[s] = level(s);
  return out;
}

const allX = (v: string) => /^x+$/.test(v);

/** 신호의 변화. 처음 값이 x면 변화가 아니다(실행 전에도 안개였다) */
export function changesOf(changes: [number, string][]): { t: number; from: string; to: string }[] {
  const out: { t: number; from: string; to: string }[] = [];
  let prev: string | null = null;
  for (const [t, v] of changes) {
    if (prev === null) {
      prev = v;
      if (!allX(v)) out.push({ t, from: 'x'.repeat(v.length), to: v });
      continue;
    }
    if (v !== prev) out.push({ t, from: prev, to: v });
    prev = v;
  }
  return out;
}

/**
 * 재생 순서. 변화를 (시각, 단계) 순으로 늘어놓고 물결로 묶은 뒤 구간으로 자른다.
 * @param bind 장면의 짧은 이름 → 타임라인의 신호 이름
 * @param delays 짧은 이름 → 그 신호를 내보내는 코드의 지연 틱 수(delaysBySignal)
 */
export function buildScript(tl: Timeline, bind: Record<string, string>, topo: Topology, delays: Record<string, number>): Step[] {
  const names = Object.keys(bind);
  const levels = signalLevels(topo, names);
  const producers = new Map<string, string[]>();
  for (const g of topo.gates) for (const o of g.out ?? []) producers.set(o, [...(producers.get(o) ?? []), g.id]);

  // 변화를 모아 (시각, 단계)로 묶는다
  const byKey = new Map<string, Wave>();
  for (const s of names) {
    const track = tl.signals[bind[s]!];
    if (!track) continue;
    for (const c of changesOf(track.changes)) {
      if (c.t > tl.end) continue;
      const level = levels[s] ?? 0;
      const key = `${c.t}:${level}`;
      let w = byKey.get(key);
      if (!w) {
        w = { t: c.t, level, changes: [], gates: [] };
        byKey.set(key, w);
      }
      w.changes.push({ signal: s, from: c.from, to: c.to });
      if (level > 0) {
        for (const id of producers.get(s) ?? []) {
          const delay = delays[s] ?? 0;
          const had = w.gates.find((g) => g.id === id);
          if (had) had.delay = Math.max(had.delay, delay);
          else w.gates.push({ id, delay });
        }
      }
    }
  }
  const waves = [...byKey.values()].sort((a, b) => a.t - b.t || a.level - b.level);

  // 구간: 단계 0 신호가 바뀐 시각마다 자른다. 첫 구간은 t=0에서 시작한다
  const starts = [...new Set(waves.filter((w) => w.level === 0).map((w) => w.t))].sort((a, b) => a - b);
  if (starts[0] !== 0) starts.unshift(0);
  const steps: Step[] = starts.map((start, k) => ({ start, end: starts[k + 1] ?? tl.end, waves: [], quiet: [] }));
  for (const w of waves) {
    let k = steps.length - 1;
    while (k > 0 && steps[k]!.start > w.t) k--;
    steps[k]!.waves.push(w);
  }

  // 입력은 바뀌었지만 출력은 그대로인 건물
  for (const step of steps) {
    const changed = new Set(step.waves.flatMap((w) => w.changes.map((c) => c.signal)));
    for (const g of topo.gates) {
      const ins = g.trigger ?? g.in ?? [];
      if (ins.some((x) => changed.has(x)) && !(g.out ?? []).some((x) => changed.has(x))) step.quiet.push(g.id);
    }
  }
  return steps;
}
