import { useEffect, useRef } from 'react';
import { BEAT_SECONDS, BLEND_MS } from './beat';
import { IsoPrims } from './IsoSvg';
import { poseAt, tripPose, walkersOn, walkerSprite, type Dir, type Track, type WalkerKind, type WalkerPose, type WalkPath } from './walkers';

/** 칸 걷기(섬 지도)에서 한 칸을 걷는 시간 (5.5) */
const SECONDS_PER_CELL = 0.8;
const DIRS: Dir[] = [0, 1, 2, 3];

/**
 * 걷는 방식.
 * - trip: 한 박자 걷기. 모든 길을 길이와 상관없이 한 박자에 걸어 같은 순간에 도착한다(플레이 장면)
 * - cell: 칸 걷기. 한 칸에 0.8초. 길이 하나뿐인 섬 지도에 쓴다
 */
export type Pace = 'trip' | 'cell';

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

interface Item {
  key: string;
  path: Track;
  kind: WalkerKind;
  /** trip이면 위상(0..1), cell이면 칸 수 */
  offset: number;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpPose = (a: WalkerPose, b: WalkerPose, k: number): WalkerPose => ({
  x: lerp(a.x, b.x, k),
  y: lerp(a.y, b.y, k),
  opacity: lerp(a.opacity, b.opacity, k),
  dir: b.dir,
});

export interface WalkersProps {
  paths: WalkPath[];
  pace?: Pace;
  /**
   * 박자 시계(trip일 때). 프레임 시각(ms)을 받아 박자 위치를 돌려준다. null이면 길 가운데에 선다.
   * 없으면 페이지 시각으로 늘 걷는다. 플레이 화면은 재생 시계에서 계산해 넘긴다. (걷기 박자 계획 5.2)
   */
  clock?: (now: number) => number | null;
}

/**
 * 길마다 알파카가 걷는다. React는 처음 한 번만 그리고,
 * 움직임은 requestAnimationFrame에서 transform 속성만 바꾼다. 위치는 박자 시계 하나에서 계산한다.
 */
export function Walkers({ paths, pace = 'trip', clock }: WalkersProps) {
  const root = useRef<SVGGElement>(null);
  // 서기와 걷기 사이를 잇기 위해 마지막으로 그린 자세를 기억한다(다시 그려져도 남는다)
  const shown = useRef<WalkerPose[]>([]);
  const mode = useRef<'walk' | 'stand' | null>(null);
  const blend = useRef<{ from: WalkerPose[]; at: number } | null>(null);
  const items: Item[] = paths.flatMap((p, pi) => {
    if (p.kind === null) return [];
    const kind: WalkerKind = p.kind;
    // 한 박자 걷기는 모든 길이 같은 수여야 같이 도착한다(기본 한 마리)
    const n = p.count ?? (pace === 'trip' ? 1 : walkersOn(p.cells.length));
    return Array.from({ length: n }, (_, k) => ({
      key: `${pi}-${k}`,
      path: { cells: p.cells, from: p.from, to: p.to },
      kind,
      offset: pace === 'trip' ? k / n : (k * p.cells.length) / n,
    }));
  });

  useEffect(() => {
    const g = root.current;
    if (!g) return;
    const nodes = Array.from(g.querySelectorAll<SVGGElement>(':scope > g[data-w]'));
    const draw = (node: SVGGElement, pose: WalkerPose) => {
      node.setAttribute('transform', `translate(${pose.x.toFixed(1)} ${pose.y.toFixed(1)})`);
      node.setAttribute('opacity', pose.opacity.toFixed(2));
      // 방향별 그림 중 하나만 보인다
      node.querySelectorAll<SVGGElement>(':scope > g[data-dir]').forEach((d) => {
        d.style.display = d.dataset.dir === String(pose.dir) ? '' : 'none';
      });
    };
    const target = (it: Item, now: number, beat: number | null) =>
      pace === 'trip' ? tripPose(it.path, (beat ?? 0.5) + it.offset) : poseAt(it.path, now / 1000 / SECONDS_PER_CELL + it.offset);
    if (reducedMotion()) {
      // 움직임 줄이기: 길 가운데에 세운다(위상 0.5). 시각 0의 자리는 투명해서 보이지 않는다
      nodes.forEach((node, i) => {
        const it = items[i];
        if (!it) return;
        draw(node, pace === 'trip' ? tripPose(it.path, 0.5 + it.offset) : poseAt(it.path, it.path.cells.length / 2 + it.offset));
      });
      return;
    }
    // 시계는 하나다. 다시 그려져도 알파카가 제자리로 튀지 않고, 길마다 어긋나지 않는다
    let raf = 0;
    const frame = (now: number) => {
      const beat = pace === 'trip' ? (clock ? clock(now) : now / 1000 / BEAT_SECONDS) : null;
      const m = pace === 'trip' && beat === null ? 'stand' : 'walk';
      if (mode.current !== null && mode.current !== m) blend.current = { from: shown.current.slice(), at: now };
      mode.current = m;
      const b = blend.current;
      const k = b ? Math.min(1, (now - b.at) / BLEND_MS) : 1;
      if (k >= 1) blend.current = null;
      nodes.forEach((node, i) => {
        const it = items[i];
        if (!it) return;
        let pose = target(it, now, beat);
        const from = b?.from[i];
        if (from && k < 1) pose = lerpPose(from, pose, k * (2 - k));
        shown.current[i] = pose;
        draw(node, pose);
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  });

  return (
    <g ref={root} aria-hidden="true">
      {items.map((it) => (
        <g key={it.key} data-w="">
          {DIRS.map((d) => (
            <g key={d} data-dir={d}>
              <IsoPrims prims={walkerSprite(it.kind, d)} />
            </g>
          ))}
        </g>
      ))}
    </g>
  );
}
