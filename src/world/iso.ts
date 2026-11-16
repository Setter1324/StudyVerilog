// 작은 아이소메트릭 블록 렌더러: 축에 평행한 상자 → 윗면·왼쪽 면(+y)·오른쪽 면(+x) 다각형. (최종계획서 2.3, 7.4)
// 월드 축: x는 오른쪽 아래, y는 왼쪽 아래, z는 위.
// 프로젝트 문서 world-generator.md의 iso.mjs를 옮겼다. 문자열 SVG 대신 그림 요소(Prim) 목록을 만들고,
// 색은 CSS 식(var(--world-...), color-mix)으로 다뤄 tokens.css의 월드 팔레트를 따른다.

/** CSS 색 식. 예: 'var(--world-grass-a)' */
export type Paint = string;

export type Prim =
  | { kind: 'poly'; points: string; fill: Paint; stroke?: Paint; sw?: number; opacity?: number; fillOpacity?: number; dash?: string }
  | { kind: 'path'; d: string; fill: Paint; stroke?: Paint; sw?: number }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill: Paint; stroke?: Paint; sw?: number }
  | { kind: 'text'; x: number; y: number; text: string; size: number; fill: Paint; stroke?: Paint; sw?: number }
  | { kind: 'group'; id: string; className?: string; children: Prim[] };

/** a와 b를 섞는다. t는 0~1 (b의 비율) */
export const mix = (a: Paint, b: Paint, t: number): Paint =>
  `color-mix(in srgb, ${a}, ${b} ${Math.round(t * 100)}%)`;

const SHADE = 'var(--world-shade)';

export interface FaceColors {
  top: Paint;
  left: Paint;
  right: Paint;
}

/** 윗면 색에서 옆면 색을 만든다. 왼쪽 16%, 오른쪽 30% (7.4) */
export const faces = (base: Paint, l = 0.16, r = 0.3): FaceColors => ({
  top: base,
  left: mix(base, SHADE, l),
  right: mix(base, SHADE, r),
});

export type Pt = [number, number];

export interface Box {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
  color: Paint | FaceColors;
  deco?: Deco[];
  noTop?: boolean;
  noLeft?: boolean;
  noRight?: boolean;
  opacity?: number;
  sw?: number;
}

export type Deco = (S: Scene, b: Box) => Prim;

interface PolyOpts {
  noStroke?: boolean;
  stroke?: Paint;
  sw?: number;
  opacity?: number;
}

// 상자 면 위의 장식(문, 창문 등). 면 안의 0..1 좌표
export const onLeft =
  (u0: number, v0: number, u1: number, v1: number, fill: Paint, o: PolyOpts = {}): Deco =>
  (S, b) => {
    const X = (u: number) => b.x0 + u * (b.x1 - b.x0);
    const Z = (v: number) => b.z0 + v * (b.z1 - b.z0);
    return S.poly(
      [S.P(X(u0), b.y1, Z(v1)), S.P(X(u1), b.y1, Z(v1)), S.P(X(u1), b.y1, Z(v0)), S.P(X(u0), b.y1, Z(v0))],
      fill,
      { noStroke: true, ...o },
    );
  };

export const onRight =
  (u0: number, v0: number, u1: number, v1: number, fill: Paint, o: PolyOpts = {}): Deco =>
  (S, b) => {
    const Y = (u: number) => b.y0 + u * (b.y1 - b.y0);
    const Z = (v: number) => b.z0 + v * (b.z1 - b.z0);
    return S.poly(
      [S.P(b.x1, Y(u0), Z(v1)), S.P(b.x1, Y(u1), Z(v1)), S.P(b.x1, Y(u1), Z(v0)), S.P(b.x1, Y(u0), Z(v0))],
      fill,
      { noStroke: true, ...o },
    );
  };

export const onTop =
  (u0: number, w0: number, u1: number, w1: number, fill: Paint, o: PolyOpts = {}): Deco =>
  (S, b) => {
    const X = (u: number) => b.x0 + u * (b.x1 - b.x0);
    const Y = (w: number) => b.y0 + w * (b.y1 - b.y0);
    return S.poly(
      [S.P(X(u0), Y(w0), b.z1), S.P(X(u1), Y(w0), b.z1), S.P(X(u1), Y(w1), b.z1), S.P(X(u0), Y(w1), b.z1)],
      fill,
      { noStroke: true, ...o },
    );
  };

/** 한 칸 안의 상자들을 뒤에서 앞으로 정렬한다 */
function topo(boxes: Box[]): Box[] {
  const n = boxes.length;
  const eps = 1e-6;
  const behind = (A: Box, B: Box) => A.x1 <= B.x0 + eps || A.y1 <= B.y0 + eps || A.z1 <= B.z0 + eps;
  const indeg = new Array<number>(n).fill(0);
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      const A = boxes[a]!;
      const B = boxes[b]!;
      if (behind(A, B) && !behind(B, A)) {
        adj[a]!.push(b);
        indeg[b]!++;
      }
    }
  }
  const key = (i: number) => boxes[i]!.x0 + boxes[i]!.y0 + boxes[i]!.z0 + i * 1e-6;
  const done = new Array<boolean>(n).fill(false);
  const out: Box[] = [];
  for (let step = 0; step < n; step++) {
    let pick = -1;
    for (let i = 0; i < n; i++) if (!done[i] && indeg[i] === 0 && (pick < 0 || key(i) < key(pick))) pick = i;
    if (pick < 0) for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || key(i) < key(pick))) pick = i; // 순환: 대신 고른다
    done[pick] = true;
    out.push(boxes[pick]!);
    for (const b of adj[pick]!) indeg[b]!--;
  }
  return out;
}

interface Cell {
  i: number;
  j: number;
  terrain: Prim[];
  props: Box[];
}

export interface Rendered {
  prims: Prim[];
  x: number;
  y: number;
  w: number;
  h: number;
}

export class Scene {
  HW = 32; // 칸 폭의 절반 (한 칸은 64×32px, 7.4)
  HH = 16;
  ZS = 30; // 높이 1
  cells = new Map<string, Cell>();
  under: Prim[] = [];
  over: Prim[] = [];
  b = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };

  constructor(o: { HW?: number; HH?: number; ZS?: number } = {}) {
    Object.assign(this, o);
  }

  /** 월드 좌표 → 화면 좌표. 그림 범위도 함께 넓힌다 */
  P(x: number, y: number, z = 0): Pt {
    const p: Pt = [(x - y) * this.HW, (x + y) * this.HH - z * this.ZS];
    const b = this.b;
    if (p[0] < b.x0) b.x0 = p[0];
    if (p[0] > b.x1) b.x1 = p[0];
    if (p[1] < b.y0) b.y0 = p[1];
    if (p[1] > b.y1) b.y1 = p[1];
    return p;
  }

  pts(a: Pt[]): string {
    return a.map((p) => p.map((v) => +v.toFixed(1)).join(',')).join(' ');
  }

  poly(points: Pt[], fill: Paint, o: PolyOpts = {}): Prim {
    return {
      kind: 'poly',
      points: this.pts(points),
      fill,
      stroke: o.noStroke ? undefined : (o.stroke ?? fill),
      sw: o.noStroke ? undefined : (o.sw ?? 0.9),
      opacity: o.opacity,
    };
  }

  cell(i: number, j: number): Cell {
    const k = i + ',' + j;
    let c = this.cells.get(k);
    if (!c) {
      c = { i, j, terrain: [], props: [] };
      this.cells.set(k, c);
    }
    return c;
  }

  boxPrims(b: Box): Prim[] {
    const c = typeof b.color === 'string' ? faces(b.color) : b.color;
    const o: PolyOpts = { opacity: b.opacity, sw: b.sw };
    const out: Prim[] = [];
    if (!b.noLeft)
      out.push(this.poly([this.P(b.x0, b.y1, b.z1), this.P(b.x1, b.y1, b.z1), this.P(b.x1, b.y1, b.z0), this.P(b.x0, b.y1, b.z0)], c.left, o));
    if (!b.noRight)
      out.push(this.poly([this.P(b.x1, b.y0, b.z1), this.P(b.x1, b.y1, b.z1), this.P(b.x1, b.y1, b.z0), this.P(b.x1, b.y0, b.z0)], c.right, o));
    if (!b.noTop)
      out.push(this.poly([this.P(b.x0, b.y0, b.z1), this.P(b.x1, b.y0, b.z1), this.P(b.x1, b.y1, b.z1), this.P(b.x0, b.y1, b.z1)], c.top, o));
    if (b.deco) for (const d of b.deco) out.push(d(this, b));
    return out;
  }

  /** 월드 절대 좌표의 상자들. (cx, cy)가 든 칸에서 정렬된다 */
  prop(cx: number, cy: number, boxes: Box[]) {
    this.cell(Math.floor(cx), Math.floor(cy)).props.push(...boxes);
  }

  /** 칸 안 0..1 좌표로 적은 상자들. dir: 0 +x, 1 +y, 2 -x, 3 -y */
  local(ox: number, oy: number, oz: number, boxes: Box[], dir = 0): Box[] {
    const rot = (x: number, y: number): Pt =>
      dir === 0 ? [x, y] : dir === 1 ? [1 - y, x] : dir === 2 ? [1 - x, 1 - y] : [y, 1 - x];
    const out = boxes.map((b) => {
      const [ax, ay] = rot(b.x0, b.y0);
      const [bx, by] = rot(b.x1, b.y1);
      return {
        ...b,
        x0: ox + Math.min(ax, bx),
        x1: ox + Math.max(ax, bx),
        y0: oy + Math.min(ay, by),
        y1: oy + Math.max(ay, by),
        z0: oz + b.z0,
        z1: oz + b.z1,
      };
    });
    this.prop(ox + 0.5, oy + 0.5, out);
    return out;
  }

  render(pad = 12): Rendered {
    const cells = [...this.cells.values()].sort((a, b) => a.i + a.j - (b.i + b.j) || a.i - b.i);
    const prims: Prim[] = [...this.under];
    for (const c of cells) {
      prims.push(...c.terrain);
      for (const b of topo(c.props)) prims.push(...this.boxPrims(b));
    }
    prims.push(...this.over);
    const b = this.b;
    return {
      prims,
      x: Math.floor(b.x0 - pad),
      y: Math.floor(b.y0 - pad),
      w: Math.ceil(b.x1 - b.x0 + pad * 2),
      h: Math.ceil(b.y1 - b.y0 + pad * 2),
    };
  }
}
