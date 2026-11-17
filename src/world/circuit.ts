// 스테이지 장면: 길(신호), 작업장(게이트), 집(출력)을 칸에 놓는다. 걷는 알파카는 walkers.ts가 그린다. (최종계획서 8.1, 9.4)
// 장면은 스테이지 JSON의 scene에서 온다. 값만 시뮬레이션(타임라인)에서 가져온다.
import type { Passing } from '../sim/delays';
import { faces, Scene, type Prim, type Rendered } from './iso';
import { C } from './island';
import type { WalkPath } from './walkers';

export interface SceneSpec {
  cols: number;
  rows: number;
  /** out: 건물의 출력 신호 이름(bind의 짧은 이름). 있으면 코드의 지연(#N)을 건물에서 틱 단위로 센다 */
  gates: { id: string; label: string; at: [number, number]; roof?: 'teal' | 'blue' | 'gray'; out?: string }[];
  roads: { signal: string; cells: [number, number][] }[];
  houses?: { signal: string; at: [number, number] }[];
  /** 한 박자의 틱 수. 테스트벤치가 #10이 아닌 간격으로 값을 바꿀 때만 쓴다(기본 10) */
  beatTicks?: number;
}

/** 지연 칸을 하나하나 그리는 상한. 넘으면 남은 틱 수를 숫자로 적는다 (걷기 박자 계획 5.3) */
const MAX_CELLS = 6;

const ROOF = { teal: C.roofTeal, blue: C.roofBlue, gray: C.roofGray } as const;
const f1 = (x: number) => +x.toFixed(1);

/**
 * @param values 신호 이름 → 그 시각의 값 ('1', '0', 'x', 'z', 벡터는 첫 글자만 본다)
 * @param highlight 강조할 신호 (코드에서 마우스를 올린 신호)
 * @param passing 건물 id → 지금 출력을 바꾸는 중이면 몇 틱째인지
 */
export function buildCircuit(
  spec: SceneSpec,
  values: Record<string, string>,
  highlight?: string,
  passing: Record<string, Passing> = {},
): Rendered {
  const S = new Scene();
  const road = new Map<string, string>(); // "i,j" → signal
  for (const r of spec.roads) for (const [i, j] of r.cells) road.set(`${i},${j}`, r.signal);

  // 땅: 풀과 길. 앞쪽 가장자리에만 옆면을 그린다
  for (let j = 0; j < spec.rows; j++) {
    for (let i = 0; i < spec.cols; i++) {
      const sig = road.get(`${i},${j}`);
      const v = sig ? (values[sig] ?? 'x')[0] : undefined;
      const top = sig ? (v === 'z' ? C.stone : C.path) : (i + j) % 2 ? C.grassA : C.grassB;
      const cell = S.cell(i, j);
      const side = faces(sig ? C.pathEdge : C.grassSide);
      if (j === spec.rows - 1)
        cell.terrain.push(S.poly([S.P(i, j + 1, 0), S.P(i + 1, j + 1, 0), S.P(i + 1, j + 1, -0.5), S.P(i, j + 1, -0.5)], side.left));
      if (i === spec.cols - 1)
        cell.terrain.push(S.poly([S.P(i + 1, j, 0), S.P(i + 1, j + 1, 0), S.P(i + 1, j + 1, -0.5), S.P(i + 1, j, -0.5)], side.right));
      cell.terrain.push(S.poly([S.P(i, j, 0), S.P(i + 1, j, 0), S.P(i + 1, j + 1, 0), S.P(i, j + 1, 0)], top));
      if (sig && sig === highlight) {
        const e = 0.08;
        cell.terrain.push({
          kind: 'poly',
          points: S.pts([S.P(i + e, j + e), S.P(i + 1 - e, j + e), S.P(i + 1 - e, j + 1 - e), S.P(i + e, j + 1 - e)]),
          fill: C.accent,
          fillOpacity: 0.18,
          stroke: C.accent,
          sw: 2,
        });
      }
      if (sig && v === 'z') {
        // 끊긴 길: 점선 테두리
        cell.terrain.push({
          kind: 'poly',
          points: S.pts([S.P(i + 0.2, j + 0.2), S.P(i + 0.8, j + 0.2), S.P(i + 0.8, j + 0.8), S.P(i + 0.2, j + 0.8)]),
          fill: 'none',
          stroke: 'var(--val-z)',
          sw: 2,
          dash: '5 5',
        });
      }
    }
  }

  // 작업장(게이트)
  for (const g of spec.gates) {
    const [i, j] = g.at;
    const roof = ROOF[g.roof ?? 'teal'];
    S.prop(i + 0.5, j + 0.5, [
      { x0: i + 0.1, x1: i + 0.9, y0: j + 0.12, y1: j + 0.9, z0: 0, z1: 0.8, color: C.wall },
      { x0: i + 0.04, x1: i + 0.96, y0: j + 0.06, y1: j + 0.96, z0: 0.8, z1: 0.96, color: roof },
    ]);
    const [sx, sy] = S.P(i + 0.5, j + 0.5, 1.25);
    const sign: Prim[] = [{ kind: 'text', x: f1(sx), y: f1(sy), text: g.label, size: 14, fill: 'var(--text)', stroke: C.white, sw: 3 }];
    const p = passing[g.id];
    if (p) sign.push(...delayCells(sx, sy + 7, p));
    S.over.push({ kind: 'group', id: `gate-${g.id}`, className: 'gateSign', children: sign });
  }

  // 출력 집
  for (const h of spec.houses ?? []) {
    const [i, j] = h.at;
    S.prop(i + 0.5, j + 0.5, [
      { x0: i + 0.15, x1: i + 0.85, y0: j + 0.18, y1: j + 0.86, z0: 0, z1: 0.6, color: C.wall },
      { x0: i + 0.1, x1: i + 0.9, y0: j + 0.12, y1: j + 0.92, z0: 0.6, z1: 0.74, color: C.roofGray },
    ]);
  }

  // 길마다 이름표
  const labels: Prim[] = [];
  for (const r of spec.roads) {
    const v = (values[r.signal] ?? 'x')[0] ?? 'x';
    const first = r.cells[0]!;
    const [lx, ly] = S.P(first[0] + 0.5, first[1] + 0.5, 0.15);
    labels.push({
      kind: 'group',
      id: `road-${r.signal}`,
      className: 'roadLabel',
      children: [
        { kind: 'text', x: f1(lx), y: f1(ly), text: `${r.signal}=${v}`, size: 13, fill: 'var(--text)', stroke: C.white, sw: 3 },
      ],
    });
  }
  S.over.push(...labels);
  return S.render(28);
}

/**
 * 건물 이름표 아래의 지연 칸: N개를 그리고 한 틱에 하나씩 채운다. N이 6을 넘으면 남은 틱 수를 적는다. (5.3)
 * (cx, top)은 줄의 가운데 위.
 */
function delayCells(cx: number, top: number, p: Passing): Prim[] {
  if (p.total > MAX_CELLS) {
    return [{ kind: 'text', x: f1(cx), y: f1(top + 10), text: `${p.left}틱 남음`, size: 11, fill: 'var(--accent-text)', stroke: C.white, sw: 3 }];
  }
  const size = 7;
  const gap = 3;
  const width = p.total * size + (p.total - 1) * gap;
  const out: Prim[] = [];
  for (let k = 0; k < p.total; k++) {
    const x = cx - width / 2 + k * (size + gap);
    const on = k < p.step;
    out.push({
      kind: 'poly',
      points: `${f1(x)},${f1(top)} ${f1(x + size)},${f1(top)} ${f1(x + size)},${f1(top + size)} ${f1(x)},${f1(top + size)}`,
      fill: on ? 'var(--accent)' : C.white,
      stroke: on ? 'var(--accent)' : 'var(--muted)',
      sw: 1.2,
    });
  }
  return out;
}

/** 지연 칸의 설명글: "OR, 3틱 중 2틱째" */
export function passingText(spec: SceneSpec, passing: Record<string, Passing>): string[] {
  return spec.gates.flatMap((g) => {
    const p = passing[g.id];
    return p ? [`${g.label}, ${p.total}틱 중 ${p.step}틱째`] : [];
  });
}

/** 이름표 층(길 이름표, 건물 이름표와 지연 칸)인지. 플레이 화면은 이 층을 걷는 알파카 위에 그린다 */
export const isLabel = (p: Prim) => p.kind === 'group' && (p.className === 'roadLabel' || p.className === 'gateSign');

/** 길마다 걷는 알파카: 1은 상자, 0은 빈손, x는 안개, z는 아무도 없다 (7.2) */
export function circuitWalkers(spec: SceneSpec, values: Record<string, string>): WalkPath[] {
  return spec.roads.map((r) => {
    const v = (values[r.signal] ?? 'x')[0] ?? 'x';
    return { cells: r.cells, kind: v === 'z' ? null : v === '1' ? '1' : v === '0' ? '0' : 'x' };
  });
}
