// 스테이지 장면: 길(신호), 작업장(게이트), 집(출력)을 칸에 놓는다. 걷는 알파카는 walkers.ts가 그린다. (최종계획서 8.1, 9.4)
// 장면은 스테이지 JSON의 scene에서 온다. 값만 시뮬레이션(타임라인)에서 가져온다.
import type { Passing } from '../sim/delays';
import { gateCells, gateDoors, roadEnds, sizeOf, type Door, type SceneSpec } from './doors';
import { faces, onLeft, onRight, Scene, type Deco, type Prim, type Rendered } from './iso';
import { C } from './island';
import type { WalkPath } from './walkers';

export type { SceneSpec } from './doors';

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

  // 붙은 길 칸 사이의 경계선: 서로 다른 길이 변으로 맞닿으면(붙은 문 칸) 한 덩어리로 보이지 않게 선을 긋는다
  const roadIndex = new Map<string, number>();
  spec.roads.forEach((r, n) => r.cells.forEach(([i, j]) => roadIndex.set(`${i},${j}`, n)));
  for (const [k, n] of roadIndex) {
    const [i, j] = k.split(',').map(Number) as [number, number];
    for (const [di, dj] of [
      [1, 0],
      [0, 1],
    ] as const) {
      const m = roadIndex.get(`${i + di},${j + dj}`);
      if (m === undefined || m === n) continue;
      const a = di ? S.P(i + 1, j) : S.P(i, j + 1);
      const b = S.P(i + 1, j + 1);
      S.cell(i + di, j + dj).terrain.push({ kind: 'path', d: `M${f1(a[0])},${f1(a[1])}L${f1(b[0])},${f1(b[1])}`, fill: 'none', stroke: C.pathEdge, sw: 2 });
    }
  }

  // 작업장(게이트). 넓은 건물은 칸마다 한 조각씩 그린다. 큰 상자 하나를 한 칸에 넣으면
  // 그 뒤에 그려지는 칸의 땅이 건물을 덮는다(Scene.render는 칸 순서대로 땅과 상자를 그린다)
  for (const g of spec.gates) {
    const [i, j] = g.at;
    const [w, h] = sizeOf(g);
    const roof = ROOF[g.roof ?? 'teal'];
    const doors = gateDoors(spec, g);
    for (const [x, y] of gateCells(g)) {
      const a = x - i;
      const b = y - j;
      const x0 = x + (a === 0 ? 0.1 : 0);
      const x1 = x + 1 - (a === w - 1 ? 0.1 : 0);
      const y0 = y + (b === 0 ? 0.12 : 0);
      const y1 = y + 1 - (b === h - 1 ? 0.1 : 0);
      S.prop(x + 0.5, y + 0.5, [
        // 안쪽 면은 옆 조각이 가리므로 그리지 않는다
        { x0, x1, y0, y1, z0: 0, z1: 0.8, color: C.wall, noLeft: b < h - 1, noRight: a < w - 1, deco: doorDecos(doors, x, y) },
        {
          x0: x0 - (a === 0 ? 0.06 : 0),
          x1: x1 + (a === w - 1 ? 0.06 : 0),
          y0: y0 - (b === 0 ? 0.06 : 0),
          y1: y1 + (b === h - 1 ? 0.06 : 0),
          z0: 0.8,
          z1: 0.96,
          color: roof,
          noLeft: b < h - 1,
          noRight: a < w - 1,
        },
      ]);
    }
    // 이름표와 지연 칸은 건물 가운데 위에 둔다
    const [sx, sy] = S.P(i + w / 2, j + h / 2, 1.25);
    const sign: Prim[] = [{ kind: 'text', x: f1(sx), y: f1(sy), text: g.label, size: 14, fill: 'var(--text)', stroke: C.white, sw: 3 }];
    const p = passing[g.id];
    if (p) sign.push(...delayCells(sx, sy + 7, p));
    S.over.push({ kind: 'group', id: `gate-${g.id}`, className: 'gateSign', children: sign });
    // 이름 있는 문의 이름표: 문 칸과 건물이 만나는 변 바로 바깥. 가려지는 면의 문도 이름표는 보인다
    for (const d of doors) {
      if (!d.port) continue;
      const mx = (d.cell[0] + d.inner[0]) / 2 + 0.5 + (d.cell[0] - d.inner[0]) * DOOR_LABEL_OUT;
      const my = (d.cell[1] + d.inner[1]) / 2 + 0.5 + (d.cell[1] - d.inner[1]) * DOOR_LABEL_OUT;
      const [lx, ly] = S.P(mx, my, 0.05);
      S.over.push({
        kind: 'group',
        id: `door-${g.id}-${d.port}`,
        className: 'doorLabel',
        children: [{ kind: 'text', x: f1(lx), y: f1(ly + 4), text: d.port, size: 11, fill: 'var(--text)', stroke: C.white, sw: 3 }],
      });
    }
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

/** 이름 있는 문의 이름표를 변에서 문 칸 쪽으로 얼마나 내놓을지(칸 단위) */
const DOOR_LABEL_OUT = 0.22;

/** 보이는 면(아래, 앞)의 문을 그 칸의 벽에 그린다. 어느 칸으로 드나드는지 보인다 */
function doorDecos(doors: Door[], x: number, y: number): Deco[] {
  const out: Deco[] = [];
  for (const d of doors) {
    if (d.inner[0] !== x || d.inner[1] !== y) continue;
    if (d.face === 'bottom') out.push(onLeft(0.32, 0, 0.68, 0.62, C.door));
    if (d.face === 'front') out.push(onRight(0.32, 0, 0.68, 0.62, C.door));
  }
  return out;
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
export const isLabel = (p: Prim) =>
  p.kind === 'group' && (p.className === 'roadLabel' || p.className === 'gateSign' || p.className === 'doorLabel');

/**
 * 길마다 걷는 알파카: 1은 상자, 0은 빈손, x는 안개, z는 아무도 없다 (7.2).
 * 출발 건물(from)의 문에서 나와 도착 건물(to)의 문으로 들어간다 (계획 4.5)
 */
export function circuitWalkers(spec: SceneSpec, values: Record<string, string>): WalkPath[] {
  return spec.roads.map((r) => {
    const v = (values[r.signal] ?? 'x')[0] ?? 'x';
    return { cells: r.cells, ...roadEnds(spec, r), kind: v === 'z' ? null : v === '1' ? '1' : v === '0' ? '0' : 'x' };
  });
}
