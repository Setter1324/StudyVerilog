import { describe, expect, it } from 'vitest';
import stage11 from '../content/verilog/stages/v1-01.json';
import stage14 from '../content/verilog/stages/v1-04.json';
import { delaysBySignal } from '../src/sim/delays';
import { buildScript, changesOf, signalLevels, type Step } from '../src/sim/script';
import type { Timeline } from '../src/sim/types';
import { buildTimeline, valueAt } from '../src/sim/vcd';
import { frameAt, layoutScript, msAtTime, pendingChanges, posAt, STEP_MAX_MS, walkingWave, type Layout } from '../src/world/beat';
import { topologyOf, type SceneSpec } from '../src/world/doors';
// 1-1은 골든 1과, 1-4는 골든 2와 게이트와 자극이 같다 (순차 재생 계획 5.6)
import vcd1 from '../engine/golden/01-assign-monitor/native/dump.vcd?raw';
import log1 from '../engine/golden/01-assign-monitor/native/log.txt?raw';
import vcd2 from '../engine/golden/02-gate-delay/native/dump.vcd?raw';
import log2 from '../engine/golden/02-gate-delay/native/log.txt?raw';
import src2 from '../engine/golden/02-gate-delay/testbench.sv?raw';

const script = (stage: { bind: Record<string, string>; scene: unknown }, tl: Timeline, delays: Record<string, number> = {}) =>
  buildScript(tl, stage.bind, topologyOf(stage.scene as SceneSpec), delays);

/** 구간마다 걷는 차례: "A·B·C → D → E" */
const order = (step: Step) => step.waves.map((w) => w.changes.map((c) => c.signal).join('·')).join(' → ');
const walks = (step: Step) => step.waves.reduce((n, w) => n + w.changes.length, 0);

/** 대본 위치 ms에서 화면이 보여 주는 값: 그 시각의 값이되 아직 걷지 않은 물결의 신호는 옛 값 */
function shownAt(layout: Layout, tl: Timeline, bind: Record<string, string>, ms: number) {
  const f = frameAt(layout, ms);
  const out: Record<string, string> = {};
  for (const [k, full] of Object.entries(bind)) out[k] = valueAt(tl.signals[full], f.t);
  for (const c of pendingChanges(layout, f)) out[c.signal] = c.from;
  return out;
}

describe('대본: 1-4 (or #3, and #2, 20틱)', () => {
  const tl = buildTimeline(vcd2, log2);
  const delays = delaysBySignal(src2);
  const steps = script(stage14, tl, delays);
  const layout = layoutScript(steps, tl.end);

  it('구간 둘, 차례는 입력 → OR → w1 → AND → E', () => {
    expect(steps.map((s) => [s.start, s.end])).toEqual([
      [0, 10],
      [10, 20],
    ]);
    expect(steps.map(order)).toEqual(['A·B·C → w1 → E', 'A → w1 → E']);
    expect(steps[1]!.waves.map((w) => w.t)).toEqual([10, 13, 15]);
    expect(steps[1]!.waves.map((w) => w.gates)).toEqual([[], [{ id: 'or', delay: 3 }], [{ id: 'and', delay: 2 }]]);
  });

  it('1× 재생은 7.3초다', () => {
    expect(layout.total).toBe(7300);
  });

  it('구간 2에서 걷는 시각은 10, 13, 15이고 시각은 뒤로 가지 않는다', () => {
    const walksAt: number[] = [];
    const ts: number[] = [];
    for (let ms = layout.stepStarts[1]!; ms < layout.total; ms += 10) {
      const f = frameAt(layout, ms);
      const w = walkingWave(layout, f);
      if (w && !walksAt.includes(f.t)) walksAt.push(f.t);
      if (ts[ts.length - 1] !== f.t) ts.push(f.t);
    }
    expect(walksAt).toEqual([10, 13, 15]);
    expect(ts).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });

  it('OR #3의 지연 칸은 한 틱에 하나씩 찬다: 건물 조각에서 t가 10, 11, 12로 오른다', () => {
    const gate = layout.pieces.find((p) => p.kind === 'gate' && p.step === 1)!;
    expect(gate.dur).toBe(250 + 150 * 3);
    expect(frameAt(layout, gate.start + 100).t).toBe(10);
    expect(frameAt(layout, gate.start + 250 + 10).t).toBe(10);
    expect(frameAt(layout, gate.start + 250 + 160).t).toBe(11);
    expect(frameAt(layout, gate.start + 250 + 310).t).toBe(12);
    expect(frameAt(layout, gate.start + gate.dur).t).toBe(13);
  });

  it('msAtTime(13)에서 w1은 1, E는 0이다', () => {
    const ms = msAtTime(layout, 13);
    expect(frameAt(layout, ms).t).toBe(13);
    const v = shownAt(layout, tl, stage14.bind, ms);
    expect([v.w1, v.E]).toEqual(['1', '0']);
  });

  it('msAtTime(11)은 OR이 지나는 중이다(e2e의 슬라이더 t=11)', () => {
    const f = frameAt(layout, msAtTime(layout, 11));
    expect(f.t).toBe(11);
    expect(f.kind).toBe('gate');
  });

  it('구간 2에서 w1이 걷는 때는 5,050~5,750ms다(?ms=5400의 장면)', () => {
    const w1 = layout.pieces.find((p) => p.kind === 'walk' && p.step === 1 && p.t0 === 13)!;
    expect([w1.start, w1.start + w1.dur]).toEqual([5050, 5750]);
    const f = frameAt(layout, 5400);
    expect(walkingWave(layout, f)?.changes.map((c) => c.signal)).toEqual(['w1']);
  });

  it('속도 2×에서 대본 위치는 두 배로 간다', () => {
    // 기준점(대본 1,000ms, 페이지 시각 500ms)에서 1초가 지났다
    expect(posAt({ ms: 1000, at: 500, speed: 1 }, 1500)).toBe(2000);
    expect(posAt({ ms: 1000, at: 500, speed: 2 }, 1500)).toBe(3000);
    expect(posAt({ ms: 1000, at: 500, speed: 0.5 }, 1500)).toBe(1500);
  });

  it('끝 위치는 해가 진 장면이다', () => {
    expect(frameAt(layout, layout.total)).toMatchObject({ kind: 'end', t: 20 });
    expect(frameAt(layout, Infinity)).toMatchObject({ kind: 'end', t: 20 });
    expect(msAtTime(layout, 20)).toBe(layout.total);
  });
});

describe('대본: 1-1 (assign, 지연 없음, 40틱)', () => {
  const tl = buildTimeline(vcd1, log1);
  const steps = script(stage11, tl);
  const layout = layoutScript(steps, tl.end);

  it('걷기는 구간마다 5, 2, 2, 2번이다', () => {
    expect(steps.map((s) => s.start)).toEqual([0, 10, 20, 30]);
    expect(steps.map(walks)).toEqual([5, 2, 2, 2]);
    expect(steps.map(order)).toEqual(['A·B·C → D → E', 'A → D', 'C → E', 'A·B']);
  });

  it('입력이 바뀌어도 출력이 그대로인 건물: 구간 2의 AND, 구간 4의 OR', () => {
    expect(steps.map((s) => s.quiet)).toEqual([[], ['and'], [], ['or']]);
  });

  it('1× 재생은 7.8초다', () => {
    expect(layout.total).toBe(7800);
  });

  it('지연이 없어도 차례대로 보인다: 입력이 걷는 동안 D와 E는 옛 값(안개)이다', () => {
    expect(shownAt(layout, tl, stage11.bind, 100)).toMatchObject({ A: '0', B: '0', C: '0', D: 'x', E: 'x' });
    const dWalk = layout.pieces.find((p) => p.kind === 'walk' && p.step === 0 && p.wave === 1)!;
    expect(shownAt(layout, tl, stage11.bind, dWalk.start + 10)).toMatchObject({ D: '0', E: 'x' });
    // 구간 2: A가 걷는 동안 D는 아직 0
    expect(shownAt(layout, tl, stage11.bind, layout.stepStarts[1]! + 10)).toMatchObject({ A: '1', D: '0' });
  });
});

describe('대본 규칙', () => {
  const tl = (signals: Record<string, [number, string][]>, end: number): Timeline => ({
    end,
    signals: Object.fromEntries(Object.entries(signals).map(([k, changes]) => [k, { width: 1, changes }])),
    log: [],
  });

  it('처음 값이 x면 변화가 아니다', () => {
    expect(changesOf([[0, 'x'], [3, '0']])).toEqual([{ t: 3, from: 'x', to: '0' }]);
    expect(changesOf([[0, '0'], [10, '1'], [10, '1']])).toEqual([
      { t: 0, from: 'x', to: '0' },
      { t: 10, from: '0', to: '1' },
    ]);
  });

  it('변화의 수가 같으면 #5 간격의 구간과 #10 간격의 구간이 같은 길이로 재생된다', () => {
    const steps = buildScript(tl({ A: [[0, '0'], [5, '1'], [15, '0']] }, 25), { A: 'A' }, { gates: [] }, {});
    const layout = layoutScript(steps, 25);
    const lens = layout.stepStarts.map((s, k) => (layout.stepStarts[k + 1] ?? layout.total) - s);
    expect(steps.map((s) => s.end - s.start)).toEqual([5, 10, 10]);
    expect(new Set(lens).size).toBe(1);
  });

  it('한 구간이 6초를 넘으면 그 구간만 같은 비율로 줄인다', () => {
    // 지연 없는 버퍼 열 개가 줄지어 있다: 걷기 11번
    const names = Array.from({ length: 11 }, (_, k) => `s${k}`);
    const gates = names.slice(1).map((o, k) => ({ id: `g${k}`, in: [names[k]!], out: [o] }));
    const signals = Object.fromEntries(names.map((n) => [n, [[0, '0'] as [number, string]]]));
    const steps = buildScript(tl(signals, 10), Object.fromEntries(names.map((n) => [n, n])), { gates }, {});
    expect(steps[0]!.waves.length).toBe(11);
    const layout = layoutScript(steps, 10);
    expect(layout.total).toBeCloseTo(STEP_MAX_MS, 6);
  });

  it('trigger가 있으면 클럭만 원인으로 센다: 클럭 → 건물 → Q → NOT → D', () => {
    const topo = {
      gates: [
        { id: 'ff', in: ['D', 'clk'], out: ['Q'], trigger: ['clk'] },
        { id: 'not', in: ['Q'], out: ['D'] },
      ],
    };
    expect(signalLevels(topo, ['clk', 'Q', 'D'])).toEqual({ clk: 0, Q: 1, D: 2 });
    // trigger 없이 자기 입력으로 돌아오는 고리는 단계 0으로 둔다
    const loop = { gates: [{ id: 'ff', in: ['D', 'clk'], out: ['Q'] }, topo.gates[1]!] };
    expect(signalLevels(loop, ['clk', 'Q', 'D'])).toEqual({ clk: 0, Q: 0, D: 0 });
  });

  it('입력이 없는 건물(물레방아)의 출력은 단계 0이라 변화마다 한 구간이다', () => {
    const steps = buildScript(
      tl({ clk: [[0, '0'], [5, '1'], [10, '0']] }, 12),
      { clk: 'clk' },
      { gates: [{ id: 'wheel', in: [], out: ['clk'] }] },
      {},
    );
    expect(steps.map((s) => s.start)).toEqual([0, 5, 10]);
  });
});
