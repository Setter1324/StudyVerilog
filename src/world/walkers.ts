// 길을 걷는 알파카. 장면(바닥, 건물)은 값이 바뀔 때만 다시 계산하고,
// 알파카는 미리 만든 그림을 위치만 옮겨 그린다. (최종계획서 5.5, 7.2, 8.1)
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

/** 월드 좌표 → 화면 좌표 (Scene과 같은 2:1 투영, 한 칸 64×32) */
export const project = (x: number, y: number): [number, number] => [(x - y) * 32, (x + y) * 16];

export interface WalkPath {
  /** 칸 좌표, 걷는 순서대로 */
  cells: [number, number][];
  kind: WalkerKind | null; // null이면 아무도 걷지 않는다(z)
  /** 걷는 알파카 수. 없으면 두 칸에 한 마리 */
  count?: number;
}

export interface WalkerPose {
  x: number;
  y: number;
  dir: Dir;
  opacity: number;
}

/** 길 위의 거리 u(칸 단위)에서의 위치. 길 양 끝에서 반 칸씩 나왔다 들어간다 */
export function poseAt(cells: [number, number][], u: number): WalkerPose {
  const n = cells.length;
  const total = n; // 첫 칸 앞 0.5 + (n-1) + 마지막 칸 뒤 0.5
  const d = ((u % total) + total) % total; // 0..total
  const along = d - 0.5; // -0.5 .. n-0.5
  const i = Math.max(0, Math.min(n - 2, Math.floor(along)));
  const a = cells[i]!;
  const b = cells[Math.min(n - 1, i + 1)]!;
  const f = along - i;
  const dx = n > 1 ? b[0] - a[0] : 1;
  const dy = n > 1 ? b[1] - a[1] : 0;
  const dir: Dir = dx > 0 ? 0 : dy > 0 ? 1 : dx < 0 ? 2 : 3;
  const wx = a[0] + 0.5 + dx * f;
  const wy = a[1] + 0.5 + dy * f;
  const [x, y] = project(wx, wy);
  // 양 끝 반 칸에서 나타나고 사라진다
  const edge = Math.min(d, total - d);
  const opacity = Math.max(0, Math.min(1, edge / 0.5));
  // 걸음마다 살짝 뛴다 (한 칸에 두 걸음)
  const hop = Math.abs(Math.sin(d * Math.PI * 2)) * 2.5;
  return { x, y: y - hop, dir, opacity };
}

/** 한 길에 걷는 알파카 수: 두 칸에 한 마리, 적어도 한 마리 */
export const walkersOn = (cells: number) => Math.max(1, Math.floor(cells / 2));
