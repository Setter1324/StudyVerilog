// 장면 형식과 건물의 문. 길이 건물에 닿는 칸이 문이다. (순차 재생과 게이트 입구 계획 4장)
// 그리기(circuit.ts), 걷는 길(walkers.ts), 장면 검사(tests/doors.test.ts)가 모두 여기의 gateDoors를 쓴다.
// 그림 코드를 부르지 않는 순수 함수만 둔다.

export type Cell = [number, number];

/** 이름 하나, 목록(이름 없는 문), 객체(문 이름: 신호 이름) 가운데 하나 */
export type Ports = string | string[] | Record<string, string>;

export interface GateSpec {
  id: string;
  label: string;
  /** 왼쪽 위 칸 (i, j) */
  at: Cell;
  /** [가로(흐름 방향), 세로]. 기본 [1, 1] */
  size?: [number, number];
  roof?: 'teal' | 'blue' | 'gray';
  in?: Ports;
  out?: Ports;
  /** 기억 소자의 클럭 입력. 순차 재생의 단계를 이 입력으로만 센다 (계획 5.2) */
  trigger?: string[];
}

export interface RoadSpec {
  signal: string;
  /** 칸 좌표, 신호가 흐르는 순서대로 */
  cells: Cell[];
}

export interface HouseSpec {
  signal: string;
  at: Cell;
}

export interface SceneSpec {
  cols: number;
  rows: number;
  gates: GateSpec[];
  roads: RoadSpec[];
  houses?: HouseSpec[];
  /** 박자 길이(틱). 기본 10 */
  beatTicks?: number;
}

export interface Port {
  /** 이름 있는 문이면 문 이름, 이름 없는 문이면 null */
  port: string | null;
  signal: string;
}

export function portList(p: Ports | undefined): Port[] {
  if (p === undefined) return [];
  if (typeof p === 'string') return [{ port: null, signal: p }];
  if (Array.isArray(p)) return p.map((signal) => ({ port: null, signal }));
  return Object.entries(p).map(([port, signal]) => ({ port, signal }));
}

/** 이름 있는 문(객체 형식)인지 */
export const isNamed = (p: Ports | undefined) => p !== undefined && typeof p === 'object' && !Array.isArray(p);

/** 건물이 내보내는 신호들 */
export const gateOuts = (g: GateSpec) => portList(g.out).map((p) => p.signal);

export const sizeOf = (g: GateSpec): [number, number] => g.size ?? [1, 1];

/** 건물이 차지하는 칸들 */
export function gateCells(g: GateSpec): Cell[] {
  const [w, h] = sizeOf(g);
  const out: Cell[] = [];
  for (let b = 0; b < h; b++) for (let a = 0; a < w; a++) out.push([g.at[0] + a, g.at[1] + b]);
  return out;
}

/**
 * 문 칸이 있는 면. 위는 j가 작은 쪽(화면 오른쪽 위), 뒤는 i가 작은 쪽(왼쪽 위),
 * 아래는 j가 큰 쪽(왼쪽 아래, 보이는 면), 앞은 i가 큰 쪽(오른쪽 아래, 보이는 면)이다.
 */
export type Face = 'top' | 'back' | 'bottom' | 'front';

/** 칸이 건물의 어느 면에 변으로 맞닿는지와 맞닿은 건물 칸. 대각선이거나 떨어져 있으면 null */
export function faceOf(g: GateSpec, cell: Cell): { face: Face; inner: Cell } | null {
  const [i, j] = g.at;
  const [w, h] = sizeOf(g);
  const [x, y] = cell;
  const inX = x >= i && x < i + w;
  const inY = y >= j && y < j + h;
  if (inX && y === j - 1) return { face: 'top', inner: [x, j] };
  if (inX && y === j + h) return { face: 'bottom', inner: [x, j + h - 1] };
  if (inY && x === i - 1) return { face: 'back', inner: [i, y] };
  if (inY && x === i + w) return { face: 'front', inner: [i + w - 1, y] };
  return null;
}

export interface Door extends Port {
  dir: 'in' | 'out';
  /** 문 칸: 입력 길의 마지막 칸이나 출력 길의 첫 칸 */
  cell: Cell;
  face: Face;
  /** 문 칸과 맞닿은 건물 칸 */
  inner: Cell;
}

const last = <T>(a: T[]) => a[a.length - 1];

/**
 * 건물의 문들. 입력은 그 신호의 길의 마지막 칸이, 출력은 첫 칸이 건물과 변으로 맞닿는 곳이다.
 * 문을 찾지 못한 신호는 결과에 없다(장면 검사가 실패로 잡는다).
 */
export function gateDoors(scene: SceneSpec, gate: GateSpec): Door[] {
  const out: Door[] = [];
  for (const dir of ['in', 'out'] as const) {
    for (const p of portList(gate[dir])) {
      for (const r of scene.roads) {
        if (r.signal !== p.signal || !r.cells.length) continue;
        const cell = dir === 'in' ? last(r.cells)! : r.cells[0]!;
        const f = faceOf(gate, cell);
        if (f) out.push({ ...p, dir, cell, face: f.face, inner: f.inner });
      }
    }
  }
  return out;
}

const same = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];
const isGateWithoutPorts = (g: GateSpec) => g.in === undefined && g.out === undefined;

/**
 * 길의 양 끝이 드나드는 칸(건물이나 집). 걷는 알파카가 그쪽 가장자리에서 나오고 그쪽으로 들어간다.
 * 문 규칙(gateDoors)으로 먼저 찾고, 집의 자리 규칙(계획 4.1의 6번), `in`·`out`이 없는 건물의 맞닿은 칸 순으로 본다.
 */
export function roadEnds(scene: SceneSpec, road: RoadSpec): { from?: Cell; to?: Cell } {
  const first = road.cells[0];
  const end = last(road.cells);
  if (!first || !end) return {};
  const find = (cell: Cell, dir: 'in' | 'out'): Cell | undefined => {
    for (const g of scene.gates) {
      const door = gateDoors(scene, g).find((d) => d.dir === dir && d.signal === road.signal && same(d.cell, cell));
      if (door) return door.inner;
    }
    for (const h of scene.houses ?? []) {
      if (h.signal !== road.signal) continue;
      const [i, j] = h.at;
      if (dir === 'in' && (same(cell, [i, j + 1]) || same(cell, [i - 1, j]))) return h.at;
      if (dir === 'out' && same(cell, [i + 1, j])) return h.at;
    }
    for (const g of scene.gates) {
      if (!isGateWithoutPorts(g)) continue;
      const f = faceOf(g, cell);
      if (f) return f.inner;
    }
    return undefined;
  };
  return { from: find(first, 'out'), to: find(end, 'in') };
}

/** 이름 없는 입력 문의 대칭 자리: 1개는 뒤, 2개는 위아래, 3개는 위아래와 뒤, 4개는 위 2·아래 2 */
function symmetric(faces: Face[]): boolean {
  const n = faces.length;
  const count = (f: Face) => faces.filter((x) => x === f).length;
  return count('top') === Math.floor(n / 2) && count('bottom') === Math.floor(n / 2) && count('back') === n % 2;
}

/** 꺾인 수 */
export function bends(cells: Cell[]): number {
  let n = 0;
  for (let k = 2; k < cells.length; k++) {
    const a = cells[k - 2]!;
    const b = cells[k - 1]!;
    const c = cells[k]!;
    if (b[0] - a[0] !== c[0] - b[0] || b[1] - a[1] !== c[1] - b[1]) n++;
  }
  return n;
}

export interface SceneCheck {
  /** 꼭 지키는 것(계획 4.1)을 어긴 곳 */
  errors: string[];
  /** 배치 원칙을 벗어난 곳 */
  warnings: string[];
}

/** 장면 검사. tests/doors.test.ts가 모든 스테이지와 넓은 건물 견본에 돌린다 (계획 4.6) */
export function checkScene(scene: SceneSpec): SceneCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const key = (c: Cell) => `${c[0]},${c[1]}`;
  const inside = (c: Cell) => c[0] >= 0 && c[1] >= 0 && c[0] < scene.cols && c[1] < scene.rows;

  // 칸 차지: 길, 건물, 집은 서로 겹치지 않는다
  const owner = new Map<string, string>();
  const take = (c: Cell, who: string) => {
    if (!inside(c)) errors.push(`${who}: (${key(c)})가 지도 밖이다`);
    const had = owner.get(key(c));
    if (had) errors.push(`${who}: (${key(c)})가 ${had}와 겹친다`);
    else owner.set(key(c), who);
  };
  for (const g of scene.gates) for (const c of gateCells(g)) take(c, `건물 ${g.id}`);
  for (const h of scene.houses ?? []) take(h.at, `집 ${h.signal}`);
  scene.roads.forEach((r, n) => {
    const who = `길 ${r.signal}${scene.roads.filter((x) => x.signal === r.signal).length > 1 ? `#${n}` : ''}`;
    if (!r.cells.length) errors.push(`${who}: 칸이 없다`);
    r.cells.forEach((c, k) => {
      take(c, who);
      const prev = r.cells[k - 1];
      if (prev && Math.abs(prev[0] - c[0]) + Math.abs(prev[1] - c[1]) !== 1)
        errors.push(`${who}: (${key(prev)})에서 (${key(c)})로 이어지지 않는다`);
    });
  });

  // 문: in·out의 신호마다 문이 있고, 이름 없는 입력 문은 대칭이다
  const doorCells = new Set<string>();
  for (const g of scene.gates) {
    const doors = gateDoors(scene, g);
    for (const d of doors) doorCells.add(key(d.cell));
    for (const dir of ['in', 'out'] as const) {
      for (const p of portList(g[dir])) {
        if (!doors.some((d) => d.dir === dir && d.signal === p.signal && d.port === p.port)) {
          const what = dir === 'in' ? '입력' : '출력';
          errors.push(`건물 ${g.id}: ${what} ${p.port ? `${p.port}(${p.signal})` : p.signal}의 길이 건물 옆 칸에 닿지 않는다`);
        }
      }
    }
    const ins = doors.filter((d) => d.dir === 'in');
    if (g.in !== undefined && !isNamed(g.in) && !symmetric(ins.map((d) => d.face)))
      errors.push(`건물 ${g.id}: 이름 없는 입력 문이 대칭이 아니다(${ins.map((d) => `${d.signal}=${d.face}`).join(', ')})`);
    for (const d of doors) if (d.dir === 'out' && d.face !== 'front') warnings.push(`건물 ${g.id}: 출력 ${d.signal}이 앞면이 아닌 ${d.face}로 나간다`);
  }

  // 집: 받는 집은 길 끝이 아래쪽 옆 칸이나 뒤 칸에, 내보내는 집은 앞 칸에서 길이 시작한다
  for (const h of scene.houses ?? []) {
    const [i, j] = h.at;
    const roads = scene.roads.filter((r) => r.signal === h.signal && r.cells.length);
    const takes = roads.some((r) => {
      const e = last(r.cells)!;
      return same(e, [i, j + 1]) || same(e, [i - 1, j]);
    });
    const gives = roads.some((r) => same(r.cells[0]!, [i + 1, j]));
    if (!takes && !gives) errors.push(`집 ${h.signal}: 길이 집의 아래쪽 옆, 뒤, 앞 칸에 닿지 않는다`);
  }

  // 배치 원칙(경고): 맞닿은 길, 길 길이, 꺾임
  const roadAt = new Map<string, number>();
  scene.roads.forEach((r, n) => r.cells.forEach((c) => roadAt.set(key(c), n)));
  const touched = new Set<string>();
  scene.roads.forEach((r, n) => {
    for (const c of r.cells) {
      for (const nb of [
        [c[0] + 1, c[1]],
        [c[0], c[1] + 1],
      ] as Cell[]) {
        const m = roadAt.get(key(nb));
        if (m === undefined || m === n || scene.roads[m]!.signal === r.signal) continue;
        if (doorCells.has(key(c)) && doorCells.has(key(nb))) continue; // 붙은 문 칸은 경계선을 그린다
        const pair = [r.signal, scene.roads[m]!.signal].sort().join('·');
        if (!touched.has(pair)) warnings.push(`길 ${pair}: 변이 맞닿아 한 덩어리로 보인다`);
        touched.add(pair);
      }
    }
  });
  const lens = scene.roads.map((r) => r.cells.length).filter((n) => n > 0);
  if (lens.length) {
    const lo = Math.min(...lens);
    const hi = Math.max(...lens);
    if (lo < 2 || hi > 6 || hi / lo > 2.5) warnings.push(`길 길이 ${lens.join(', ')}: 2~6칸, 가장 긴 길이 가장 짧은 길의 2.5배 이하가 좋다`);
  }
  for (const r of scene.roads) if (bends(r.cells) > 2) warnings.push(`길 ${r.signal}: ${bends(r.cells)}번 꺾인다`);
  return { errors, warnings };
}
