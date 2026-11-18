import { describe, expect, it } from 'vitest';
import stage11 from '../content/verilog/stages/v1-01.json';
import stage14 from '../content/verilog/stages/v1-04.json';
import { delaysBySignal } from '../src/sim/delays';
import { buildScript } from '../src/sim/script';
import { buildTimeline } from '../src/sim/vcd';
import { frameAt, layoutScript, scriptView, type Layout } from '../src/world/beat';
import { captionAt, type CaptionGate } from '../src/world/caption';
import { gateOuts, topologyOf, type SceneSpec } from '../src/world/doors';
import vcd1 from '../engine/golden/01-assign-monitor/native/dump.vcd?raw';
import log1 from '../engine/golden/01-assign-monitor/native/log.txt?raw';
import vcd2 from '../engine/golden/02-gate-delay/native/dump.vcd?raw';
import log2 from '../engine/golden/02-gate-delay/native/log.txt?raw';
import src2 from '../engine/golden/02-gate-delay/testbench.sv?raw';

// 자막 여섯 문장 (순차 재생 계획 6.3). 1-1은 골든 1, 1-4는 골든 2와 같은 회로다
const scene11 = stage11.scene as SceneSpec;
const scene14 = stage14.scene as SceneSpec;
const gatesOf = (scene: SceneSpec): CaptionGate[] => scene.gates.map((g) => ({ id: g.id, label: g.label, outs: gateOuts(g) }));
const tl1 = buildTimeline(vcd1, log1);
const tl2 = buildTimeline(vcd2, log2);
const L1 = layoutScript(buildScript(tl1, stage11.bind, topologyOf(scene11), {}), tl1.end);
const L4 = layoutScript(buildScript(tl2, stage14.bind, topologyOf(scene14), delaysBySignal(src2)), tl2.end);

/** 구간 step의 kind 조각(n번째) 가운데에서의 자막 */
function at(layout: Layout, scene: SceneSpec, step: number, kind: string, n = 0) {
  const pc = layout.pieces.filter((p) => p.step === step && p.kind === kind)[n]!;
  return captionAt(layout, frameAt(layout, pc.start + pc.dur / 2), gatesOf(scene));
}

describe('자막 (6.3)', () => {
  it('구간 시작', () => {
    expect(at(L1, scene11, 1, 'walk', 0)).toBe('구간 2/4 · t=10 · 입력이 바뀌었어요 (A: 0 → 1)');
  });

  it('건물, 지연 있음: 코드에서 읽은 지연을 붙인다', () => {
    expect(at(L4, scene14, 1, 'gate', 0)).toBe('OR #3 · 3틱 뒤 t=13에 w1: 0 → 1');
    // AND의 이름표에는 #이 없지만 빈칸에 쓴 #2를 읽는다
    expect(at(L4, scene14, 1, 'gate', 1)).toBe('AND #2 · 2틱 뒤 t=15에 E: 0 → 1');
    // 그 출력이 걷는 동안에도 같은 자막
    expect(at(L4, scene14, 1, 'walk', 1)).toBe('OR #3 · 3틱 뒤 t=13에 w1: 0 → 1');
  });

  it('건물, 지연 없음', () => {
    expect(at(L1, scene11, 1, 'gate', 0)).toBe('OR · 바로 D: 0 → 1');
  });

  it('출력 그대로', () => {
    expect(at(L1, scene11, 1, 'gap')).toBe('AND · 입력이 바뀌어도 출력(E)은 그대로예요');
  });

  it('기다림', () => {
    expect(at(L4, scene14, 1, 'gap')).toBe('다음 입력까지 5틱 · t=20');
  });

  it('해가 짐', () => {
    expect(captionAt(L1, frameAt(L1, L1.total), gatesOf(scene11))).toBe('t=40 · 해가 졌어요');
  });
});

describe('네온과 꼬리표 (6.1, 6.2)', () => {
  const roads = scene14.roads.map((r) => r.signal); // A, B, w1, C, E
  const gateIds = scene14.gates.map((g) => g.id); // or, and

  it('1-4의 구간 2: 네온이 A의 길 → OR → w1의 길 → AND → E의 길 순서로 이어진다', () => {
    const lit = (kind: string, n: number) => {
      const pc = L4.pieces.filter((p) => p.step === 1 && p.kind === kind)[n]!;
      const v = scriptView(L4, pc.start + pc.dur / 2, roads, gateIds);
      return {
        roads: roads.filter((_, k) => v.trail[k] !== null),
        gates: gateIds.filter((_, k) => v.gates[k]),
        tags: roads.filter((_, k) => v.tags[k]),
      };
    };
    expect(lit('walk', 0)).toEqual({ roads: ['A'], gates: [], tags: [] });
    expect(lit('gate', 0)).toEqual({ roads: ['A'], gates: ['or'], tags: [] });
    expect(lit('walk', 1)).toEqual({ roads: ['A', 'w1'], gates: ['or'], tags: ['w1'] });
    expect(lit('gate', 1)).toEqual({ roads: ['A', 'w1'], gates: ['or', 'and'], tags: ['w1'] });
    expect(lit('walk', 2)).toEqual({ roads: ['A', 'w1', 'E'], gates: ['or', 'and'], tags: ['w1', 'E'] });
  });

  it('걷는 길의 선은 알파카를 따라 그어지고, 구간이 끝나면 꺼진다', () => {
    const walk = L4.pieces.find((p) => p.step === 1 && p.kind === 'walk')!;
    const v = scriptView(L4, walk.start + walk.dur * 0.25, roads, gateIds);
    expect(v.trail[0]).toBeCloseTo(0.25, 6);
    expect(v.walk[0]).toBeCloseTo(0.25, 6);
    const gap = L4.pieces.find((p) => p.step === 1 && p.kind === 'gap')!;
    expect(scriptView(L4, gap.start + 10, roads, gateIds).glow).toBe(1);
    expect(scriptView(L4, gap.start + gap.dur - 90, roads, gateIds).glow).toBeCloseTo(0.5, 6);
    expect(scriptView(L4, L4.total, roads, gateIds).glow).toBe(0);
  });

  it('움직임 줄이기: 걷지 않고 선은 바로 켜진다', () => {
    const walk = L4.pieces.find((p) => p.step === 1 && p.kind === 'walk')!;
    const v = scriptView(L4, walk.start + 10, roads, gateIds, { reduced: true });
    expect(v.walk[0]).toBeNull();
    expect(v.trail[0]).toBe(1);
  });
});
