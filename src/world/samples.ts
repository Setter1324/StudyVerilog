// 넓은 건물 견본 세 개(순차 재생과 게이트 입구 계획 4.4). 구역 1에는 쓰지 않는다.
// 문이 많은 건물을 배치 원칙대로 놓을 수 있는지 보여 주고, 넓은 건물 코드가 쓰이지 않은 채 남지 않게 한다.
// tests/doors.test.ts가 문 검사를 돌리고, #/ui가 그려 보인다. 소문자는 길 이름의 첫 글자다.
import type { Cell, SceneSpec } from './doors';

const row = (j: number, i0: number, i1: number): Cell[] => {
  const out: Cell[] = [];
  if (i0 <= i1) for (let i = i0; i <= i1; i++) out.push([i, j]);
  else for (let i = i0; i >= i1; i--) out.push([i, j]);
  return out;
};

/**
 * 입력 4개 AND, 2×1. 이름 없는 문이라 위 2, 아래 2로 대칭이다.
 * ```
 * ...BBB...
 * .....B...
 * .AAAAB..H
 * ....##YYY
 * .CCCCD...
 * .....D...
 * ...DDD...
 * ```
 */
const and4: SceneSpec = {
  cols: 9,
  rows: 7,
  gates: [{ id: 'and4', label: 'AND', at: [4, 3], size: [2, 1], roof: 'blue', in: ['A', 'B', 'C', 'D'], out: 'Y' }],
  roads: [
    { signal: 'A', cells: row(2, 1, 4) },
    { signal: 'B', cells: [...row(0, 3, 5), [5, 1], [5, 2]] },
    { signal: 'C', cells: row(4, 1, 4) },
    { signal: 'D', cells: [...row(6, 3, 5), [5, 5], [5, 4]] },
    { signal: 'Y', cells: row(3, 6, 8) },
  ],
  houses: [{ signal: 'Y', at: [8, 2] }],
};

/**
 * 전가산기 릴레이, 1×3 두 채. 캐리 입력(cin)을 위 문으로 받아 앞 건물의 캐리 출력이 곧은 길로 닿는다.
 * ```
 * .ccc..H....
 * ...#sss....
 * bbb#.......
 * ...#cccc...
 * .aaa...#sss
 * ....bbb#...
 * .......#ccc
 * .....aaa...
 * ```
 */
const adder: SceneSpec = {
  cols: 11,
  rows: 8,
  gates: [
    { id: 'fa0', label: 'FA', at: [3, 1], size: [1, 3], roof: 'teal', in: { cin: 'c0', b: 'b0', a: 'a0' }, out: { s: 's0', cout: 'c1' } },
    { id: 'fa1', label: 'FA', at: [7, 4], size: [1, 3], roof: 'teal', in: { cin: 'c1', b: 'b1', a: 'a1' }, out: { s: 's1', cout: 'c2' } },
  ],
  roads: [
    { signal: 'c0', cells: row(0, 1, 3) },
    { signal: 'b0', cells: row(2, 0, 2) },
    { signal: 'a0', cells: row(4, 1, 3) },
    { signal: 's0', cells: row(1, 4, 6) },
    { signal: 'c1', cells: row(3, 4, 7) },
    { signal: 'b1', cells: row(5, 4, 6) },
    { signal: 'a1', cells: row(7, 5, 7) },
    { signal: 's1', cells: row(4, 8, 10) },
    { signal: 'c2', cells: row(6, 8, 10) },
  ],
  houses: [{ signal: 's0', at: [6, 0] }],
};

/**
 * 메모리, 1×3. 데이터(addr, din)는 뒤, 제어 we는 위, clk는 아래, dout은 앞. 문 다섯 개에 이름표가 붙는다.
 * ```
 * ..www....
 * ....w....
 * aaaa#....
 * ....#oooH
 * dddd#....
 * ....k....
 * ..kkk....
 * ```
 */
const ram: SceneSpec = {
  cols: 9,
  rows: 7,
  gates: [
    {
      id: 'ram',
      label: 'RAM',
      at: [4, 2],
      size: [1, 3],
      roof: 'gray',
      in: { we: 'we', addr: 'addr', din: 'din', clk: 'clk' },
      out: { dout: 'dout' },
      trigger: ['clk'],
    },
  ],
  roads: [
    { signal: 'we', cells: [...row(0, 2, 4), [4, 1]] },
    { signal: 'addr', cells: row(2, 0, 3) },
    { signal: 'din', cells: row(4, 0, 3) },
    { signal: 'clk', cells: [...row(6, 2, 4), [4, 5]] },
    { signal: 'dout', cells: row(3, 5, 7) },
  ],
  houses: [{ signal: 'dout', at: [8, 3] }],
};

export interface SampleScene {
  id: string;
  title: string;
  scene: SceneSpec;
  values: Record<string, string>;
}

export const SAMPLE_SCENES: SampleScene[] = [
  { id: 'and4', title: '입력 4개 AND (2×1)', scene: and4, values: { A: '1', B: '1', C: '1', D: '0', Y: '0' } },
  {
    id: 'adder',
    title: '전가산기 릴레이 (1×3 두 채)',
    scene: adder,
    values: { c0: '0', b0: '1', a0: '1', s0: '0', c1: '1', b1: '0', a1: '0', s1: '1', c2: '0' },
  },
  { id: 'ram', title: '메모리 (1×3, 이름 있는 문 다섯 개)', scene: ram, values: { we: '1', addr: '0', din: '1', clk: '0', dout: 'x' } },
];
