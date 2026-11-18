import { describe, expect, it } from 'vitest';
import { checkScene, gateDoors, roadEnds, type SceneSpec } from '../src/world/doors';
import { SAMPLE_SCENES } from '../src/world/samples';

// 문 규칙 (순차 재생과 게이트 입구 계획 4.1, 4.6).
// "꼭 지키는 것"은 실패로, 배치 원칙은 경고로 적는다.

const stages = import.meta.glob<{ id: string; scene: SceneSpec }>('../content/verilog/stages/*.json', { eager: true, import: 'default' });

/** 고치기 전 main의 1-1 장면에 in·out만 적은 것. 이 배치는 문 규칙에 걸려야 한다 */
const OLD_1_1: SceneSpec = {
  cols: 10,
  rows: 6,
  gates: [
    { id: 'or', label: 'OR', at: [3, 2], in: ['A', 'B'], out: 'D' },
    { id: 'and', label: 'AND', at: [6, 3], in: ['D', 'C'], out: 'E' },
  ],
  roads: [
    { signal: 'A', cells: [[0, 1], [1, 1], [2, 1], [2, 2]] },
    { signal: 'B', cells: [[0, 3], [1, 3], [2, 3]] },
    { signal: 'D', cells: [[4, 2], [5, 2], [5, 3]] },
    { signal: 'C', cells: [[3, 5], [4, 5], [5, 5], [6, 5], [6, 4]] },
    { signal: 'E', cells: [[7, 3], [8, 3], [9, 3]] },
  ],
  houses: [{ signal: 'E', at: [9, 2] }],
};

describe('문 규칙: 스테이지 장면', () => {
  const all = Object.values(stages);

  it('스테이지 15개를 모두 읽는다', () => {
    expect(all.length).toBe(15);
  });

  for (const stage of all) {
    it(`${stage.id}: 꼭 지키는 것을 어기지 않는다`, () => {
      const { errors, warnings } = checkScene(stage.scene);
      if (warnings.length) console.warn(`${stage.id} 배치 원칙 경고:\n  ${warnings.join('\n  ')}`);
      expect(errors).toEqual([]);
    });
  }

  it('in·out을 적은 건물은 신호마다 문이 있다', () => {
    for (const stage of all) {
      for (const g of stage.scene.gates) {
        const doors = gateDoors(stage.scene, g);
        const want = [g.in, g.out].flatMap((p) => (p === undefined ? [] : typeof p === 'string' ? [p] : Array.isArray(p) ? p : Object.values(p)));
        for (const sig of want) expect(doors.some((d) => d.signal === sig), `${stage.id} ${g.id} ${sig}`).toBe(true);
      }
    }
  });

  it('고치기 전 1-1은 실패한다: OR에는 B의 문이 없고, AND의 입력 문은 뒤와 아래라 대칭이 아니다', () => {
    const { errors } = checkScene(OLD_1_1);
    expect(errors.some((e) => e.includes('건물 or') && e.includes('입력 B'))).toBe(true);
    expect(errors.some((e) => e.includes('건물 and') && e.includes('대칭'))).toBe(true);
  });

  it('1-1의 OR과 AND는 두 입력을 위와 아래 문으로 받는다', () => {
    const s = stages['../content/verilog/stages/v1-01.json']!.scene;
    const faces = (id: string) =>
      gateDoors(s, s.gates.find((g) => g.id === id)!)
        .map((d) => `${d.signal}:${d.face}`)
        .sort();
    expect(faces('or')).toEqual(['A:top', 'B:bottom', 'D:front']);
    expect(faces('and')).toEqual(['C:bottom', 'D:top', 'E:front']);
  });

  it('길의 양 끝은 문으로 드나든다: 입력 길은 건물로, 출력 길은 건물에서', () => {
    const s = stages['../content/verilog/stages/v1-01.json']!.scene;
    const ends = (sig: string) => roadEnds(s, s.roads.find((r) => r.signal === sig)!);
    expect(ends('A')).toEqual({ from: undefined, to: [3, 2] });
    expect(ends('C')).toEqual({ from: undefined, to: [6, 3] });
    expect(ends('D')).toEqual({ from: [3, 2], to: [6, 3] });
    expect(ends('E')).toEqual({ from: [6, 3], to: [9, 2] });
  });
});

describe('문 규칙: 넓은 건물 견본 (계획 4.4)', () => {
  for (const sample of SAMPLE_SCENES) {
    it(`${sample.id}: 오류와 경고가 없다`, () => {
      expect(checkScene(sample.scene)).toEqual({ errors: [], warnings: [] });
    });
  }

  const doorsOf = (id: string, gate: string) => {
    const s = SAMPLE_SCENES.find((x) => x.id === id)!.scene;
    return gateDoors(s, s.gates.find((g) => g.id === gate)!)
      .map((d) => `${d.port ?? d.signal}:${d.face}`)
      .sort();
  };

  it('2×1 AND는 위 2, 아래 2로 받고 앞으로 낸다', () => {
    expect(doorsOf('and4', 'and4')).toEqual(['A:top', 'B:top', 'C:bottom', 'D:bottom', 'Y:front']);
  });

  it('전가산기는 위 cin, 뒤 b, 아래 a, 앞 s와 cout이다', () => {
    for (const fa of ['fa0', 'fa1']) expect(doorsOf('adder', fa)).toEqual(['a:bottom', 'b:back', 'cin:top', 'cout:front', 's:front']);
  });

  it('메모리는 문 다섯 개를 모두 찾는다', () => {
    expect(doorsOf('ram', 'ram')).toEqual(['addr:back', 'clk:bottom', 'din:back', 'dout:front', 'we:top']);
  });
});

describe('문 규칙: 검사가 잡는 것', () => {
  const base = (): SceneSpec => ({
    cols: 6,
    rows: 3,
    gates: [{ id: 'and', label: 'AND', at: [2, 1], in: ['A', 'B'], out: 'Y' }],
    roads: [
      { signal: 'A', cells: [[0, 0], [1, 0], [2, 0]] },
      { signal: 'B', cells: [[0, 2], [1, 2], [2, 2]] },
      { signal: 'Y', cells: [[3, 1], [4, 1], [5, 1]] },
    ],
  });

  it('맞는 장면은 통과한다', () => {
    expect(checkScene(base()).errors).toEqual([]);
  });

  it('끊긴 길', () => {
    const s = base();
    s.roads[0]!.cells = [[0, 0], [2, 0]];
    expect(checkScene(s).errors.join()).toContain('이어지지 않는다');
  });

  it('겹친 길', () => {
    const s = base();
    s.roads[1]!.cells = [[1, 0], [1, 1], [1, 2], [2, 2]];
    expect(checkScene(s).errors.join()).toContain('겹친다');
  });

  it('대각선 칸에서 끝나는 길은 문이 아니다', () => {
    const s = base();
    s.roads[1]!.cells = [[0, 2], [1, 2]];
    expect(checkScene(s).errors.join()).toContain('입력 B');
  });

  it('이름 없는 문 둘이 뒤와 아래면 대칭이 아니다', () => {
    const s = base();
    s.roads[0]!.cells = [[0, 1], [1, 1]];
    expect(checkScene(s).errors.join()).toContain('대칭');
  });

  it('이름 있는 문은 자리가 자유다', () => {
    const s = base();
    s.gates[0]!.in = { a: 'A', b: 'B' };
    s.roads[0]!.cells = [[0, 1], [1, 1]];
    expect(checkScene(s).errors).toEqual([]);
  });

  it('맞닿은 길은 경고다', () => {
    const s = base();
    s.roads.push({ signal: 'Z', cells: [[3, 0], [4, 0]] });
    const { errors, warnings } = checkScene(s);
    expect(errors).toEqual([]);
    expect(warnings.join()).toContain('맞닿아');
  });

  it('앞면이 아닌 출력은 경고다', () => {
    const s = base();
    s.gates[0]!.in = { a: 'A' };
    s.roads = [
      { signal: 'A', cells: [[0, 1], [1, 1]] },
      { signal: 'Y', cells: [[2, 0], [3, 0], [4, 0]] },
    ];
    const { errors, warnings } = checkScene(s);
    expect(errors).toEqual([]);
    expect(warnings.join()).toContain('앞면이 아닌');
  });

  it('값을 받는 집은 길 끝이 아래쪽 옆 칸이나 뒤 칸에 닿아야 한다', () => {
    const s = base();
    s.houses = [{ signal: 'Y', at: [5, 0] }];
    expect(checkScene(s).errors).toEqual([]); // Y의 끝 (5,1)이 집의 아래쪽 옆 칸
    s.houses = [{ signal: 'Y', at: [5, 2] }];
    expect(checkScene(s).errors.join()).toContain('집 Y');
  });
});
