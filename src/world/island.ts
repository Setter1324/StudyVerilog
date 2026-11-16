// 첫 화면의 섬 지도와 값 그림(1·0·x·z). (최종계획서 5.1, 7.2, 7.4)
// 프로젝트 문서 world-generator.md의 build.mjs를 옮겼다. 섬 배치는 아직 코드에 있고,
// 구역 2~6을 만들 때 content/verilog/의 데이터로 옮긴다.
import { faces, mix, onLeft, onRight, onTop, Scene, type Box, type FaceColors, type Paint, type Prim, type Rendered } from './iso';

const v = (name: string): Paint => `var(--world-${name})`;

/** 월드 색. 모두 tokens.css의 --world-* 변수다 */
export const C = {
  grassA: v('grass-a'),
  grassB: v('grass-b'),
  grassSide: v('grass-side'),
  soil: v('dirt'),
  stone: v('stone'),
  path: v('path'),
  pathEdge: v('path-edge'),
  water: v('water'),
  waterHi: v('water-hi'),
  plazaA: v('plaza-a'),
  plazaB: v('plaza-b'),
  wheat: v('wheat'),
  wheatDark: v('wheat-dark'),
  crop: v('crop'),
  cropDark: v('crop-dark'),
  rock: v('rock'),
  rockDark: v('rock-dark'),
  wall: v('wall'),
  door: v('door'),
  window: v('window'),
  roofTeal: v('roof-teal'),
  roofBlue: v('roof-blue'),
  barn: v('barn'),
  roofGray: v('roof-gray'),
  board: v('board'),
  segOn: 'var(--val-1)',
  segOff: v('seg-off'),
  towerStone: v('tower'),
  flame: v('flame'),
  flameTip: v('flame-tip'),
  flameCore: v('flame-core'),
  flameDeep: v('flame-deep'),
  violet: 'var(--val-x)',
  cyan: v('crystal'),
  trunk: v('trunk'),
  leaf: v('leaf'),
  leafTop: v('leaf-top'),
  alpaca: v('alpaca'),
  alpacaFace: v('alpaca-face'),
  alpacaLeg: v('alpaca-leg'),
  eye: v('eye'),
  crate: 'var(--val-1)',
  crateBand: v('crate-band'),
  fog: v('fog'),
  iron: v('iron'),
  steel: v('steel'),
  signal: v('signal'),
  mirror: v('mirror'),
  mirrorFrame: 'var(--zone-6)',
  white: v('white'),
  flowerA: v('white'),
  flowerB: v('flame-tip'),
  flowerC: v('flower-pink'),
  cloudTop: v('white'),
  cloudLeft: v('cloud-left'),
  cloudRight: v('cloud-right'),
  accent: 'var(--accent)',
  zoneMark: 'var(--zone-6)',
} as const;

const rnd = (i: number, j: number, s = 0) => {
  const x = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453;
  return x - Math.floor(x);
};
const key = (i: number, j: number) => i + ',' + j;
const f1 = (x: number) => +x.toFixed(1);

/* ---------------------------------------------------------------- 부품 */
function house(
  S: Scene,
  i: number,
  j: number,
  { w = 1, h = 0.9, roof = C.roofTeal as Paint, wall = C.wall as Paint, door = 0, z = 0 } = {},
) {
  for (let k = 0; k < w; k++) {
    const first = k === 0;
    const last = k === w - 1;
    const x0 = i + k + (first ? 0.1 : 0);
    const x1 = i + k + 1 - (last ? 0.1 : 0);
    const y0 = j + 0.14;
    const y1 = j + 0.9;
    const deco = [];
    if (k === door) deco.push(onLeft(0.36, 0, 0.64, 0.62, C.door));
    else deco.push(onLeft(0.3, 0.4, 0.7, 0.74, C.window));
    if (last) deco.push(onRight(0.32, 0.4, 0.68, 0.74, C.window));
    S.prop(i + k + 0.5, j + 0.5, [
      { x0, x1, y0, y1, z0: z, z1: z + h, color: wall, deco },
      { x0: x0 - (first ? 0.06 : 0), x1: x1 + (last ? 0.06 : 0), y0: y0 - 0.06, y1: y1 + 0.06, z0: z + h, z1: z + h + 0.16, color: roof },
      {
        x0: x0 + (first ? 0.16 : 0),
        x1: x1 - (last ? 0.16 : 0),
        y0: y0 + 0.2,
        y1: y1 - 0.2,
        z0: z + h + 0.16,
        z1: z + h + 0.36,
        color: mix(roof, C.white, 0.14),
      },
    ]);
  }
}

function tree(S: Scene, i: number, j: number, z = 0) {
  S.prop(i + 0.5, j + 0.5, [
    { x0: i + 0.43, x1: i + 0.57, y0: j + 0.43, y1: j + 0.57, z0: z, z1: z + 0.5, color: C.trunk },
    { x0: i + 0.2, x1: i + 0.8, y0: j + 0.2, y1: j + 0.8, z0: z + 0.5, z1: z + 1.02, color: C.leaf },
    { x0: i + 0.33, x1: i + 0.67, y0: j + 0.33, y1: j + 0.67, z0: z + 1.02, z1: z + 1.32, color: C.leafTop },
  ]);
}

function bush(S: Scene, i: number, j: number, ox = 0.5, oy = 0.5, z = 0) {
  S.prop(i + 0.5, j + 0.5, [
    { x0: i + ox - 0.24, x1: i + ox + 0.24, y0: j + oy - 0.24, y1: j + oy + 0.24, z0: z, z1: z + 0.3, color: C.leaf },
    { x0: i + ox - 0.13, x1: i + ox + 0.13, y0: j + oy - 0.13, y1: j + oy + 0.13, z0: z + 0.3, z1: z + 0.46, color: C.leafTop },
  ]);
}

function flowers(S: Scene, i: number, j: number, z = 0) {
  const cols = [C.flowerA, C.flowerB, C.flowerC];
  const boxes: Box[] = [];
  for (let k = 0; k < 3; k++) {
    const fx = 0.15 + rnd(i, j, k) * 0.7;
    const fy = 0.15 + rnd(j, i, k + 5) * 0.7;
    boxes.push({ x0: i + fx - 0.045, x1: i + fx + 0.045, y0: j + fy - 0.045, y1: j + fy + 0.045, z0: z, z1: z + 0.1, color: cols[(i + j + k) % 3]! });
  }
  S.prop(i + 0.5, j + 0.5, boxes);
}

function beacon(S: Scene, i: number, j: number, h: number) {
  S.prop(i + 0.5, j + 0.5, [
    { x0: i + 0.37, x1: i + 0.63, y0: j + 0.37, y1: j + 0.63, z0: h, z1: h + 0.5, color: C.towerStone },
    { x0: i + 0.3, x1: i + 0.7, y0: j + 0.3, y1: j + 0.7, z0: h + 0.5, z1: h + 0.6, color: mix(C.towerStone, 'var(--world-shade)', 0.28) },
    { x0: i + 0.38, x1: i + 0.62, y0: j + 0.38, y1: j + 0.62, z0: h + 0.6, z1: h + 0.86, color: { top: C.flameTip, left: C.flame, right: mix(C.flame, C.flameDeep, 0.4) } },
    { x0: i + 0.45, x1: i + 0.55, y0: j + 0.45, y1: j + 0.55, z0: h + 0.86, z1: h + 1.02, color: { top: C.flameCore, left: C.flameTip, right: C.flame } },
  ]);
}

function shadow(S: Scene, x: number, y: number, z = 0, r = 0.3) {
  const p = [S.P(x - r, y - r, z), S.P(x + r, y - r, z), S.P(x + r, y + r, z), S.P(x - r, y + r, z)];
  S.cell(Math.floor(x), Math.floor(y)).terrain.push(S.poly(p, 'var(--world-shade)', { noStroke: true, opacity: 0.16 }));
}

export type WalkerValue = '1' | '0';

/** 짐을 나르는 알파카. 값 1은 상자를 싣고, 0은 빈손이다 (7.2) */
export function alpacaBoxes(val: WalkerValue): Box[] {
  const b = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: Paint, extra: Partial<Box> = {}): Box => ({
    x0,
    y0,
    z0,
    x1,
    y1,
    z1,
    color,
    ...extra,
  });
  const boxes = [
    b(0.26, 0.36, 0, 0.36, 0.45, 0.2, C.alpacaLeg),
    b(0.26, 0.55, 0, 0.36, 0.64, 0.2, C.alpacaLeg),
    b(0.62, 0.36, 0, 0.72, 0.45, 0.2, C.alpacaLeg),
    b(0.62, 0.55, 0, 0.72, 0.64, 0.2, C.alpacaLeg),
    b(0.22, 0.33, 0.2, 0.76, 0.67, 0.5, C.alpaca),
    b(0.15, 0.45, 0.34, 0.22, 0.55, 0.46, C.alpaca),
    b(0.62, 0.4, 0.5, 0.76, 0.6, 0.74, C.alpaca),
    b(0.6, 0.37, 0.74, 0.88, 0.63, 0.94, C.alpaca, { deco: [onLeft(0.52, 0.42, 0.7, 0.72, C.eye)] }),
    b(0.88, 0.43, 0.74, 0.96, 0.57, 0.84, C.alpacaFace),
    b(0.64, 0.39, 0.94, 0.7, 0.45, 1.05, C.alpacaFace),
    b(0.64, 0.55, 0.94, 0.7, 0.61, 1.05, C.alpacaFace),
  ];
  if (val === '1')
    boxes.push(
      b(0.25, 0.29, 0.5, 0.57, 0.71, 0.8, C.crate, {
        deco: [onTop(0.4, 0, 0.6, 1, C.crateBand), onLeft(0.4, 0.16, 0.6, 0.84, C.white)],
      }),
    );
  return boxes;
}

function alpaca(S: Scene, x: number, y: number, z: number, { dir = 0, val = '0' as WalkerValue } = {}) {
  shadow(S, x, y, z, 0.3);
  S.local(x - 0.5, y - 0.5, z, alpacaBoxes(val), dir);
}

function fogPrims(S: Scene, x: number, y: number, z: number): Prim[] {
  const f = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, op: number) =>
    S.boxPrims({ x0: x - 0.5 + x0, y0: y - 0.5 + y0, z0: z + z0, x1: x - 0.5 + x1, y1: y - 0.5 + y1, z1: z + z1, color: C.fog, opacity: op, sw: 0 });
  return [...f(0.02, 0.1, 0.02, 0.98, 0.9, 0.62, 0.42), ...f(0.2, 0.22, 0.62, 0.86, 0.8, 1.0, 0.42), ...f(0.05, 0.62, 0.0, 0.5, 1.02, 0.36, 0.5)];
}

function questionMark(S: Scene, x: number, y: number, z: number, size: number): Prim {
  const [sx, sy] = S.P(x, y, z);
  return { kind: 'text', x: f1(sx), y: f1(sy), text: '?', size, fill: C.zoneMark, stroke: C.white, sw: size / 6 };
}

export interface ZonePinSpot {
  zone: number;
  x: number; // 화면 좌표 (핀 끝)
  y: number;
}

function pin(S: Scene, x: number, y: number, z: number, n: number): { prim: Prim; spot: ZonePinSpot } {
  const [sx, sy] = S.P(x, y, z);
  S.P(x, y, z + 1.3);
  const color = `var(--zone-${n})`;
  const prim: Prim = {
    kind: 'group',
    id: `zone-pin-${n}`,
    className: 'zonePin',
    children: [
      { kind: 'path', d: `M${f1(sx - 6)},${f1(sy - 11)} L${f1(sx + 6)},${f1(sy - 11)} L${f1(sx)},${f1(sy - 1)} Z`, fill: color, stroke: C.white, sw: 2.5 },
      { kind: 'circle', cx: f1(sx), cy: f1(sy - 22), r: 13.5, fill: color, stroke: C.white, sw: 2.5 },
      { kind: 'text', x: f1(sx), y: f1(sy - 16.6), text: String(n), size: 15, fill: 'var(--on-zone)' },
    ],
  };
  return { prim, spot: { zone: n, x: f1(sx), y: f1(sy) } };
}

function cloud(S: Scene, x: number, y: number, z: number, s = 1) {
  const col: FaceColors = { top: C.cloudTop, left: C.cloudLeft, right: C.cloudRight };
  const bx = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
    S.boxPrims({ x0: x + x0 * s, y0: y + y0 * s, z0: z + z0 * s, x1: x + x1 * s, y1: y + y1 * s, z1: z + z1 * s, color: col, opacity: 0.95 });
  S.under.push(...bx(0, 0, 0, 2.2, 0.8, 0.3), ...bx(0.5, 0.1, 0.3, 1.6, 0.7, 0.56), ...bx(1.9, 0.12, -0.04, 2.9, 0.68, 0.22));
}

/* ---------------------------------------------------------------- 섬 */
type Mat = 'grass' | 'path' | 'water' | 'plaza' | 'wheat' | 'crop' | 'rock';
interface Tile {
  i: number;
  j: number;
  h: number;
  b: number;
  mat: Mat;
}

export interface IslandMap extends Rendered {
  pins: ZonePinSpot[];
  /** "지금 위치" 표시가 떠 있는 화면 좌표 */
  here: { x: number; y: number };
}

export function buildIsland(): IslandMap {
  const S = new Scene({ HW: 32, HH: 16, ZS: 30 });
  const MASK = [
    '...ggggggggg..',
    '.gggggggggggg.',
    'gggggggggggggg',
    'gggggggggggggg',
    'gggggggggggggg',
    'gggggggggggggg',
    'gggggggggggggg',
    'gggggggggggggg',
    'gggggggggggggg',
    '.ggggggggggggg',
    '..gggggggggg..',
    '....gggggg....',
  ];
  const T = new Map<string, Tile>();
  MASK.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch === 'g') T.set(key(i, j), { i, j, h: 0, b: 0, mat: 'grass' });
    }),
  );
  const get = (i: number, j: number) => {
    const t = T.get(key(i, j));
    if (!t) throw new Error('no cell ' + i + ',' + j);
    return t;
  };
  const set = (i: number, j: number, o: Partial<Tile>) => Object.assign(get(i, j), o);

  // 신호 길: 앞줄 → 오른쪽으로 꺾어 가운데 줄 → 왼쪽으로 꺾어 뒷줄
  const road: [number, number][] = [];
  for (let x = 4; x <= 11; x++) road.push([x, 9]);
  for (let y = 5; y <= 8; y++) road.push([11, y]);
  for (let x = 3; x <= 10; x++) road.push([x, 5]);
  for (let y = 1; y <= 4; y++) road.push([3, y]);
  for (let x = 4; x <= 10; x++) road.push([x, 1]);
  road.push([12, 9]);
  road.forEach(([i, j]) => set(i, j, { mat: 'path' }));

  [[1, 7], [2, 7], [1, 8], [2, 8]].forEach(([i, j]) => set(i!, j!, { mat: 'water', h: -0.18 }));
  for (let j = 4; j <= 6; j++) for (let i = 12; i <= 13; i++) set(i, j, { mat: 'plaza' });
  for (let i = 5; i <= 8; i++) {
    set(i, 3, { mat: i % 2 ? 'wheat' : 'crop' });
    set(i, 4, { mat: i % 2 ? 'crop' : 'wheat' });
  }
  const hill: Record<string, number> = { '0,2': 1.2, '1,2': 2.0, '2,2': 1.0, '0,3': 1.2, '1,3': 1.7, '2,3': 1.0, '0,4': 0.8, '1,4': 1.4, '2,4': 0.7, '1,1': 1.1, '2,1': 0.6, '0,5': 0.4, '1,5': 0.7, '2,5': 0.35 };
  for (const k in hill) {
    const [i, j] = k.split(',').map(Number) as [number, number];
    set(i, j, { h: hill[k] });
  }
  const rocks: Record<string, number> = { '9,0': 1.4, '10,0': 2.2, '11,0': 1.7, '12,1': 0.5 };
  for (const k in rocks) {
    const [i, j] = k.split(',').map(Number) as [number, number];
    set(i, j, { h: rocks[k], mat: 'rock' });
  }

  // 아랫면: 가운데로 갈수록 두껍고 들쭉날쭉하다
  for (const t of T.values()) {
    let d = 1;
    outer: for (; d < 7; d++)
      for (let dx = -d; dx <= d; dx++)
        for (let dy = -d; dy <= d; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
          if (!T.has(key(t.i + dx, t.j + dy))) break outer;
        }
    t.b = -(1.15 + 0.5 * (d - 1) + rnd(t.i, t.j, 3) * 0.55);
  }

  const band = (grassy: boolean, edge?: Paint) => ({
    cuts: (h: number) => (grassy ? [h - 0.2, -1.0] : [-1.0]),
    side: (z: number, h: number): Paint => (grassy && z > h - 0.2 ? edge! : z > -1.0 ? C.soil : C.stone),
  });
  const MAT: Record<Mat, { top: (i: number, j: number) => Paint; cuts: (h: number) => number[]; side: (z: number, h: number) => Paint }> = {
    grass: { top: (i, j) => ((i + j) % 2 ? C.grassA : C.grassB), ...band(true, C.grassSide) },
    path: { top: () => C.path, ...band(true, C.pathEdge) },
    water: { top: () => C.water, ...band(false) },
    plaza: { top: (i, j) => ((i + j) % 2 ? C.plazaA : C.plazaB), ...band(true, C.plazaB) },
    wheat: { top: () => C.wheat, ...band(true, C.grassSide) },
    crop: { top: () => C.crop, ...band(true, C.grassSide) },
    rock: { top: () => C.rock, cuts: () => [-1.0], side: (z) => (z > -1.0 ? C.rock : C.stone) },
  };

  for (const t of T.values()) {
    const { i, j, h, b } = t;
    const m = MAT[t.mat];
    const ny = T.get(key(i, j + 1));
    const nx = T.get(key(i + 1, j));
    const segs = (n: Tile | undefined): [number, number][] => {
      if (!n) return [[b, h]];
      const o: [number, number][] = [];
      if (b < n.b) o.push([b, Math.min(n.b, h)]);
      if (h > n.h) o.push([Math.max(n.h, b), h]);
      return o;
    };
    const bands = (za: number, zb: number): [number, number, Paint][] => {
      const cuts = [za, ...m.cuts(h).filter((c) => c > za && c < zb), zb].sort((a, c) => a - c);
      return cuts.slice(0, -1).map((z, k) => [z, cuts[k + 1]!, m.side((z + cuts[k + 1]!) / 2, h)]);
    };
    const s: Prim[] = [];
    for (const [za, zb] of segs(ny))
      for (const [z0, z1, col] of bands(za, zb))
        s.push(S.poly([S.P(i, j + 1, z1), S.P(i + 1, j + 1, z1), S.P(i + 1, j + 1, z0), S.P(i, j + 1, z0)], faces(col).left));
    for (const [za, zb] of segs(nx))
      for (const [z0, z1, col] of bands(za, zb))
        s.push(S.poly([S.P(i + 1, j, z1), S.P(i + 1, j + 1, z1), S.P(i + 1, j + 1, z0), S.P(i + 1, j, z0)], faces(col).right));
    s.push(S.poly([S.P(i, j, h), S.P(i + 1, j, h), S.P(i + 1, j + 1, h), S.P(i, j + 1, h)], m.top(i, j)));
    const strip = (u0: number, w0: number, u1: number, w1: number, fill: Paint) =>
      S.poly([S.P(i + u0, j + w0, h), S.P(i + u1, j + w0, h), S.P(i + u1, j + w1, h), S.P(i + u0, j + w1, h)], fill, { noStroke: true });
    if (t.mat === 'wheat' || t.mat === 'crop')
      for (let k = 0; k < 3; k++) s.push(strip(0.14 + k * 0.28, 0.1, 0.26 + k * 0.28, 0.9, t.mat === 'wheat' ? C.wheatDark : C.cropDark));
    if (t.mat === 'water') s.push(strip(0.2, 0.3, 0.7, 0.4, C.waterHi), strip(0.45, 0.62, 0.85, 0.7, C.waterHi));
    S.cell(i, j).terrain.push(...s);
  }

  // 구역 1 게이트 마을 (청록 지붕)
  house(S, 5, 8, { w: 2, h: 0.95, roof: C.roofTeal, door: 0 });
  house(S, 7, 8, { w: 1, h: 0.7, roof: C.roofTeal, door: 0 });
  S.prop(4.5, 8.5, [
    // 시간표 게시판 (initial 블록)
    { x0: 4.3, x1: 4.36, y0: 8.56, y1: 8.62, z0: 0, z1: 0.7, color: C.trunk },
    { x0: 4.7, x1: 4.76, y0: 8.56, y1: 8.62, z0: 0, z1: 0.7, color: C.trunk },
    { x0: 4.24, x1: 4.82, y0: 8.62, y1: 8.7, z0: 0.3, z1: 0.82, color: C.trunk, deco: [onLeft(0.12, 0.14, 0.88, 0.86, C.wall)] },
  ]);
  // 구역 2 갈림길 역 (파란 지붕), 레버, 차막이
  house(S, 9, 8, { w: 2, h: 0.72, roof: C.roofBlue, door: 1 });
  S.prop(12.5, 8.5, [
    { x0: 12.34, x1: 12.66, y0: 8.4, y1: 8.72, z0: 0, z1: 0.14, color: C.steel },
    { x0: 12.47, x1: 12.53, y0: 8.53, y1: 8.59, z0: 0.14, z1: 0.74, color: C.iron },
    { x0: 12.42, x1: 12.58, y0: 8.48, y1: 8.64, z0: 0.74, z1: 0.9, color: C.signal },
  ]);
  S.prop(12.5, 9.5, [
    { x0: 12.8, x1: 12.94, y0: 9.16, y1: 9.84, z0: 0, z1: 0.34, color: C.iron, deco: [onLeft(0, 0.55, 1, 1, C.signal), onRight(0, 0.55, 1, 1, C.signal)] },
  ]);
  // 구역 3 전광판 광장: "3"을 띄운 7-세그먼트
  S.prop(12.5, 3.5, [
    { x0: 12.22, x1: 12.32, y0: 3.82, y1: 3.92, z0: 0, z1: 0.25, color: C.iron },
    { x0: 12.1, x1: 13.0, y0: 3.8, y1: 3.92, z0: 0.25, z1: 1.55, color: C.board },
  ]);
  const seg =
    (xa: number, xb: number, za: number, zb: number, on: boolean) =>
    (S2: Scene): Prim =>
      S2.poly([S2.P(xa, 3.92, zb), S2.P(xb, 3.92, zb), S2.P(xb, 3.92, za), S2.P(xa, 3.92, za)], on ? C.segOn : C.segOff, { noStroke: true });
  {
    const x0 = 12.58, x1 = 13.42, z0 = 0.46, z1 = 1.34, zm = (z0 + z1) / 2, t = 0.12, g = 0.03;
    S.prop(13.5, 3.5, [
      { x0: 13.68, x1: 13.78, y0: 3.82, y1: 3.92, z0: 0, z1: 0.25, color: C.iron },
      {
        x0: 13.0,
        x1: 13.9,
        y0: 3.8,
        y1: 3.92,
        z0: 0.25,
        z1: 1.55,
        color: C.board,
        deco: [
          seg(x0 + t + g, x1 - t - g, z1 - t, z1, true),
          seg(x0 + t + g, x1 - t - g, zm - t / 2, zm + t / 2, true),
          seg(x0 + t + g, x1 - t - g, z0, z0 + t, true),
          seg(x0, x0 + t, zm + g, z1 - g, false),
          seg(x1 - t, x1, zm + g, z1 - g, true),
          seg(x0, x0 + t, z0 + g, zm - g, false),
          seg(x1 - t, x1, z0 + g, zm - g, true),
        ],
      },
    ]);
  }
  // 구역 4 덧셈 농장: 밭 뒤 헛간
  house(S, 9, 3, { w: 2, h: 0.62, roof: C.roofGray, wall: C.barn, door: 0 });
  // 구역 5 봉화 언덕
  beacon(S, 1, 2, 2.0);
  beacon(S, 1, 3, 1.7);
  beacon(S, 1, 4, 1.4);
  // 구역 6 거울 동굴: 바위 입구, 수정, 거울
  S.cell(10, 0).terrain.push(
    S.poly([S.P(10.24, 1, 1.0), S.P(10.76, 1, 1.0), S.P(10.76, 1, 0), S.P(10.24, 1, 0)], C.rockDark, { noStroke: true }),
    S.poly([S.P(10.33, 1, 1.16), S.P(10.67, 1, 1.16), S.P(10.67, 1, 1.0), S.P(10.33, 1, 1.0)], C.rockDark, { noStroke: true }),
  );
  S.prop(12.5, 1.5, [
    { x0: 12.3, x1: 12.5, y0: 1.3, y1: 1.5, z0: 0.5, z1: 1.2, color: C.violet },
    { x0: 12.56, x1: 12.72, y0: 1.46, y1: 1.62, z0: 0.5, z1: 0.94, color: C.cyan },
    { x0: 12.14, x1: 12.28, y0: 1.56, y1: 1.7, z0: 0.5, z1: 0.8, color: mix(C.violet, C.white, 0.3) },
  ]);
  S.prop(8.5, 0.5, [
    { x0: 8.2, x1: 8.8, y0: 0.5, y1: 0.68, z0: 0, z1: 0.12, color: C.steel },
    {
      x0: 8.24,
      x1: 8.76,
      y0: 0.55,
      y1: 0.63,
      z0: 0.12,
      z1: 1.05,
      color: C.mirrorFrame,
      deco: [onLeft(0.1, 0.07, 0.9, 0.93, C.mirror), onLeft(0.2, 0.55, 0.42, 0.85, C.white)],
    },
  ]);

  // 나무와 풀
  [[5, 0], [7, 0], [0, 6], [0, 8], [3, 7], [2, 9], [13, 8], [4, 10], [13, 2]].forEach(([i, j]) => tree(S, i!, j!, get(i!, j!).h));
  [[5, 10], [8, 10], [10, 10], [6, 11], [12, 7], [8, 8], [4, 7]].forEach(([i, j]) => bush(S, i!, j!));
  [[6, 10], [9, 10], [7, 11], [5, 6], [8, 6], [9, 7], [6, 7], [4, 2], [9, 2], [3, 8], [12, 8], [13, 7], [6, 0], [4, 0], [10, 6], [5, 11]].forEach(([i, j]) => {
    if (get(i!, j!).mat === 'grass') flowers(S, i!, j!);
  });

  // 지금 위치: 첫 알파카 아래 칸의 고리
  {
    const i = 6, j = 9, e = 0.1;
    S.cell(i, j).terrain.push({
      kind: 'poly',
      points: S.pts([S.P(i + e, j + e), S.P(i + 1 - e, j + e), S.P(i + 1 - e, j + 1 - e), S.P(i + e, j + 1 - e)]),
      fill: C.accent,
      fillOpacity: 0.16,
      stroke: C.accent,
      sw: 2.5,
    });
  }

  // 걷는 알파카: 1은 상자, 0은 빈손, x는 안개
  alpaca(S, 6.5, 9.5, 0, { dir: 0, val: '1' });
  alpaca(S, 9.2, 9.5, 0, { dir: 0, val: '0' });
  alpaca(S, 11.5, 7.2, 0, { dir: 3, val: '1' });
  alpaca(S, 7.5, 5.5, 0, { dir: 2, val: '0' });
  alpaca(S, 5.5, 1.5, 0, { dir: 0, val: '0' });
  S.over.push(...fogPrims(S, 5.5, 1.5, 0));
  S.over.push(questionMark(S, 5.5, 1.5, 1.55, 17));

  // "지금 위치" 화살표 (CSS로 위아래 4px 떠 있다)
  const [hx, hy] = S.P(6.5, 9.5, 1.5);
  S.over.push({
    kind: 'group',
    id: 'here',
    className: 'here',
    children: [
      { kind: 'path', d: `M${f1(hx - 9)},${f1(hy - 10)} L${f1(hx + 9)},${f1(hy - 10)} L${f1(hx)},${f1(hy + 3)} Z`, fill: C.accent, stroke: C.white, sw: 2.5 },
    ],
  });

  const pins = [
    pin(S, 6.0, 8.5, 1.5, 1),
    pin(S, 10.0, 8.5, 1.3, 2),
    pin(S, 13.0, 3.86, 1.7, 3),
    pin(S, 7.0, 4.0, 0.35, 4),
    pin(S, 1.5, 2.5, 3.2, 5),
    pin(S, 10.5, 0.5, 2.35, 6),
  ];
  S.over.push(...pins.map((p) => p.prim));

  cloud(S, -3.4, 4.4, 2.4, 0.9);
  cloud(S, 9.6, -1.6, 3.6, 0.8);
  cloud(S, 3.2, 12.6, -1.4, 0.7);
  return { ...S.render(10), pins: pins.map((p) => p.spot), here: { x: f1(hx), y: f1(hy) } };
}

/* ---------------------------------------------------------------- 값 그림 */
export function buildValueSprite(kind: '1' | '0' | 'x' | 'z'): Rendered {
  const S = new Scene({ HW: 52, HH: 26, ZS: 48 });
  const edge = faces(C.pathEdge);
  const slab = (x0: number, x1: number): Box => ({ x0, x1, y0: 0, y1: 1, z0: -0.34, z1: 0, color: { top: C.path, left: edge.left, right: edge.right } });
  if (kind === 'z') {
    S.prop(0.5, 0.5, [slab(0, 0.34), slab(0.66, 1)]);
    const g = [S.P(0.34, 0, 0), S.P(0.66, 0, 0), S.P(0.66, 1, 0), S.P(0.34, 1, 0)];
    S.over.push({ kind: 'poly', points: S.pts(g), fill: 'none', stroke: 'var(--val-z)', sw: 2.5, dash: '6 6' });
    S.P(0.5, 0.5, 1.5);
  } else {
    S.cell(0, 0).terrain.push(...S.boxPrims(slab(0, 1)));
    alpaca(S, 0.5, 0.5, 0, { dir: 0, val: kind === '1' ? '1' : '0' });
    if (kind === 'x') {
      S.over.push(...fogPrims(S, 0.5, 0.5, 0));
      S.over.push(questionMark(S, 0.5, 0.5, 1.28, 26));
      S.P(0.5, 0.5, 1.9);
    } else S.P(0.5, 0.5, 1.9);
  }
  return S.render(6);
}
