// 스테이지 장면: 길(신호), 작업장(게이트), 집(출력)을 칸에 놓고, 시각 t의 값에 따라 알파카를 세운다. (최종계획서 8.1, 9.4)
// 장면은 스테이지 JSON의 scene에서 온다. 값만 시뮬레이션(타임라인)에서 가져온다.
import { faces, Scene, type Prim, type Rendered } from './iso';
import { alpacaBoxes, C } from './island';

export interface SceneSpec {
  cols: number;
  rows: number;
  gates: { id: string; label: string; at: [number, number]; roof?: 'teal' | 'blue' | 'gray' }[];
  roads: { signal: string; cells: [number, number][] }[];
  houses?: { signal: string; at: [number, number] }[];
}

const ROOF = { teal: C.roofTeal, blue: C.roofBlue, gray: C.roofGray } as const;
const f1 = (x: number) => +x.toFixed(1);

/**
 * @param values 신호 이름 → 그 시각의 값 ('1', '0', 'x', 'z', 벡터는 첫 글자만 본다)
 * @param highlight 강조할 신호 (코드에서 마우스를 올린 신호)
 */
export function buildCircuit(spec: SceneSpec, values: Record<string, string>, highlight?: string): Rendered {
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
    S.over.push({
      kind: 'group',
      id: `gate-${g.id}`,
      className: 'gateSign',
      children: [
        { kind: 'text', x: f1(sx), y: f1(sy), text: g.label, size: 14, fill: 'var(--text)', stroke: C.white, sw: 3 },
      ],
    });
  }

  // 출력 집
  for (const h of spec.houses ?? []) {
    const [i, j] = h.at;
    S.prop(i + 0.5, j + 0.5, [
      { x0: i + 0.15, x1: i + 0.85, y0: j + 0.18, y1: j + 0.86, z0: 0, z1: 0.6, color: C.wall },
      { x0: i + 0.1, x1: i + 0.9, y0: j + 0.12, y1: j + 0.92, z0: 0.6, z1: 0.74, color: C.roofGray },
    ]);
  }

  // 길마다 이름표와 알파카 한 마리 (가운데 칸)
  const labels: Prim[] = [];
  for (const r of spec.roads) {
    const v = (values[r.signal] ?? 'x')[0] ?? 'x';
    const mid = r.cells[Math.floor((r.cells.length - 1) / 2)]!;
    const first = r.cells[0]!;
    if (v !== 'z') {
      const x = mid[0] + 0.5;
      const y = mid[1] + 0.5;
      S.local(x - 0.5, y - 0.5, 0, alpacaBoxes(v === '1' ? '1' : '0'), 0);
      if (v === 'x') {
        const fog = S.boxPrims({ x0: x - 0.46, y0: y - 0.4, z0: 0.02, x1: x + 0.46, y1: y + 0.4, z1: 0.9, color: C.fog, opacity: 0.45, sw: 0 });
        const [qx, qy] = S.P(x, y, 1.35);
        S.over.push(...fog, { kind: 'text', x: f1(qx), y: f1(qy), text: '?', size: 16, fill: C.zoneMark, stroke: C.white, sw: 3 });
      }
    }
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
  return S.render(16);
}
