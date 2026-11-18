// 길을 걷는 알파카. 장면(바닥, 건물)은 값이 바뀔 때만 다시 계산하고,
// 알파카는 미리 만든 그림을 위치만 옮겨 그린다. (최종계획서 5.5, 7.2, 8.1)
import { FADE, STEPS_PER_WALK } from './beat';
import { Scene, type Prim } from './iso';
import { alpacaBoxes, fogPrims, questionMark } from './island';

export type WalkerKind = '1' | '0' | 'x';
/** 0 +x(오른쪽 아래), 1 +y(왼쪽 아래), 2 -x, 3 -y */
export type Dir = 0 | 1 | 2 | 3;

const cache = new Map<string, Prim[]>();

/** 칸 가운데가 (0,0)에 오는 알파카 그림 */
export function walkerSprite(kind: WalkerKind, dir: Dir): Prim[] {
  const key = kind + dir;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = new Scene();
  S.local(-0.5, -0.5, 0, alpacaBoxes(kind === '1' ? '1' : '0'), dir);
  if (kind === 'x') {
    S.over.push(...fogPrims(S, 0, 0, 0), questionMark(S, 0, 0, 1.4, 16));
  }
  const prims = S.render(0).prims;
  cache.set(key, prims);
  return prims;
}

const NEON = 'var(--neon)';

/**
 * 네온 테두리용 밑그림: 알파카(와 상자)의 모든 면을 네온 색, 굵기 4px 선으로 칠한다.
 * 알파카 그림 밑에 깔면 필터 없이 테두리가 생긴다. 안개(x)는 빈손 알파카의 모양을 쓴다 (순차 재생 계획 6.1)
 */
export function neonSprite(kind: WalkerKind, dir: Dir): Prim[] {
  const key = 'n' + kind + dir;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = new Scene();
  S.local(-0.5, -0.5, 0, alpacaBoxes(kind === '1' ? '1' : '0'), dir);
  const prims = S.render(0)
    .prims.filter((p) => p.kind === 'poly')
    .map((p): Prim => ({ ...p, fill: NEON, stroke: NEON, sw: 4, opacity: undefined, fillOpacity: undefined }));
  cache.set(key, prims);
  return prims;
}

/** 월드 좌표 → 화면 좌표 (Scene과 같은 2:1 투영, 한 칸 64×32) */
export const project = (x: number, y: number): [number, number] => [(x - y) * 32, (x + y) * 16];

/** 걷는 길: 칸들과 양 끝에 드나드는 칸(건물이나 집) */
export interface Track {
  /** 칸 좌표, 걷는 순서대로 */
  cells: [number, number][];
  /** 출발 칸. 있으면 첫 반 칸을 그 칸 쪽 가장자리에서 나온다 */
  from?: [number, number];
  /** 도착 칸. 있으면 마지막 반 칸을 직전 방향이 아니라 그 칸 쪽으로 간다 (게이트 입구 계획 4.5) */
  to?: [number, number];
}

export interface WalkPath extends Track {
  kind: WalkerKind | null; // null이면 아무도 걷지 않는다(z)
  /** 걷는 알파카 수. 없으면 두 칸에 한 마리 */
  count?: number;
}

export interface WalkerPose {
  x: number;
  y: number;
  dir: Dir;
  opacity: number;
  /** 발이 놓인 길 칸. 건물과 앞뒤를 가려 그리는 데 쓴다 */
  cell: [number, number];
}

const dirOf = (dx: number, dy: number): Dir => (dx > 0 ? 0 : dy > 0 ? 1 : dx < 0 ? 2 : 3);
const toTrack = (t: Track | [number, number][]): Track => (Array.isArray(t) ? { cells: t } : t);

/**
 * 길 위의 거리 d(0 이상 칸 수 이하)에서의 자리와 방향.
 * 첫 칸 앞 반 칸에서 나와 마지막 칸 뒤 반 칸으로 들어간다. 그래서 한 번 걷는 거리는 칸 수와 같다.
 * from·to가 있으면 그 칸과 맞닿은 변이 나오고 들어가는 자리다. 없으면 길의 처음·마지막 방향 그대로다.
 */
function placeAt(t: Track, d: number): { x: number; y: number; dir: Dir; cell: [number, number] } {
  const c = t.cells;
  const n = c.length;
  const first = c[0]!;
  const lastCell = c[n - 1]!;
  const sign = Math.sign;
  // 첫 반 칸과 마지막 반 칸의 방향
  const [sx, sy] = t.from
    ? [sign(first[0] - t.from[0]), sign(first[1] - t.from[1])]
    : n > 1
      ? [c[1]![0] - first[0], c[1]![1] - first[1]]
      : [1, 0];
  const [ex, ey] = t.to
    ? [sign(t.to[0] - lastCell[0]), sign(t.to[1] - lastCell[1])]
    : n > 1
      ? [lastCell[0] - c[n - 2]![0], lastCell[1] - c[n - 2]![1]]
      : [sx, sy];
  let wx: number;
  let wy: number;
  let dir: Dir;
  if (d <= 0.5) {
    const f = d - 0.5; // -0.5..0
    wx = first[0] + 0.5 + sx * f;
    wy = first[1] + 0.5 + sy * f;
    dir = dirOf(sx, sy);
  } else if (d >= n - 0.5) {
    const f = d - (n - 0.5); // 0..0.5
    wx = lastCell[0] + 0.5 + ex * f;
    wy = lastCell[1] + 0.5 + ey * f;
    dir = dirOf(ex, ey);
  } else {
    const along = d - 0.5; // 0 .. n-1
    const i = Math.min(n - 2, Math.floor(along));
    const a = c[i]!;
    const b = c[i + 1]!;
    const f = along - i;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    wx = a[0] + 0.5 + dx * f;
    wy = a[1] + 0.5 + dy * f;
    dir = dirOf(dx, dy);
  }
  const [x, y] = project(wx, wy);
  // 칸 가운데를 지나 다음 칸 가장자리(d = k + 1)에서 칸이 바뀐다. 양 끝 반 칸은 첫 칸과 마지막 칸이다
  const cell = c[Math.max(0, Math.min(n - 1, Math.floor(d)))]!;
  return { x, y, dir, cell };
}

/** 걷는 길의 화면 좌표: 출발 문(from 쪽 변)에서 칸 가운데들을 지나 마지막 칸 가운데(문 앞)까지. 네온 선에 쓴다 */
export function trackPoints(track: Track): [number, number][] {
  const c = track.cells;
  const first = c[0];
  if (!first) return [];
  const [sx, sy] = track.from
    ? [Math.sign(first[0] - track.from[0]), Math.sign(first[1] - track.from[1])]
    : c[1]
      ? [c[1][0] - first[0], c[1][1] - first[1]]
      : [1, 0];
  return [project(first[0] + 0.5 - sx * 0.5, first[1] + 0.5 - sy * 0.5), ...c.map(([i, j]) => project(i + 0.5, j + 0.5))];
}

/** 칸 걷기(섬 지도): 길 위의 거리 u(칸 단위)에서의 자세. 양 끝 반 칸에서 나타나고 사라진다 */
export function poseAt(track: Track | [number, number][], u: number): WalkerPose {
  const t = toTrack(track);
  const total = t.cells.length;
  const d = ((u % total) + total) % total; // 0..total
  const { x, y, dir, cell } = placeAt(t, d);
  const edge = Math.min(d, total - d);
  const opacity = Math.max(0, Math.min(1, edge / 0.5));
  // 걸음마다 살짝 뛴다 (한 칸에 두 걸음)
  const hop = Math.abs(Math.sin(d * Math.PI * 2)) * 2.5;
  return { x, y: y - hop, dir, opacity, cell };
}

/**
 * 한 번 걷기(플레이 장면): 진행률 p(0~1)에서의 자세. 출발 문(from 쪽 변)에서 나와 마지막 칸 가운데(문 앞)에 선다.
 * 길이와 상관없이 같은 시간에 걷는다. 긴 길의 알파카는 빨리, 짧은 길의 알파카는 천천히 걷는다.
 * 앞 8% 동안 나타나고, 도착해서는 사라지지 않는다. (순차 재생 계획 5.5)
 */
export function walkPose(track: Track | [number, number][], p: number): WalkerPose {
  const t = toTrack(track);
  const q = Math.max(0, Math.min(1, p));
  const { x, y, dir, cell } = placeAt(t, q * (t.cells.length - 0.5));
  const opacity = Math.min(1, q / FADE);
  const hop = Math.abs(Math.sin(q * STEPS_PER_WALK * Math.PI)) * 2.5;
  return { x, y: y - hop, dir, opacity, cell };
}

/** 문 앞에 선 자세: 마지막 칸 가운데에서 건물 쪽을 본다 */
export const standPose = (track: Track | [number, number][]) => walkPose(track, 1);

/** 한 길에 걷는 알파카 수: 두 칸에 한 마리, 적어도 한 마리 */
export const walkersOn = (cells: number) => Math.max(1, Math.floor(cells / 2));
