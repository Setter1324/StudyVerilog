import { useEffect, useRef } from 'react';
import { BLEND_MS } from './beat';
import { IsoPrims } from './IsoSvg';
import { poseAt, standPose, walkersOn, walkerSprite, walkPose, type Dir, type Track, type WalkerKind, type WalkerPose, type WalkPath } from './walkers';

/** 칸 걷기(섬 지도)에서 한 칸을 걷는 시간 (5.5) */
const SECONDS_PER_CELL = 0.8;
const DIRS: Dir[] = [0, 1, 2, 3];

/**
 * 걷는 방식.
 * - trip: 한 번 걷기. 길마다 알파카 한 마리가 문 앞에 서 있다가, 대본 시계가 걸으라고 할 때만 출발 문에서 문 앞까지 걷는다(플레이 장면)
 * - cell: 칸 걷기. 한 칸에 0.8초로 늘 걷는다. 길이 하나뿐인 섬 지도에 쓴다
 */
export type Pace = 'trip' | 'cell';

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

interface Item {
  key: string;
  /** 장면의 길 번호(paths의 순서) */
  road: number;
  path: Track;
  kind: WalkerKind;
  /** cell일 때 칸 수 */
  offset: number;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpPose = (a: WalkerPose, b: WalkerPose, k: number): WalkerPose => ({
  x: lerp(a.x, b.x, k),
  y: lerp(a.y, b.y, k),
  opacity: lerp(a.opacity, b.opacity, k),
  dir: b.dir,
});

/** 대본 시계가 길마다 돌려주는 걷기 진행률(0~1). null이면 문 앞에 선다 */
export type WalkFrame = (number | null)[];

export interface WalkersProps {
  paths: WalkPath[];
  pace?: Pace;
  /**
   * 대본 시계(trip일 때). 프레임 시각(ms)을 받아 길마다 진행률을 돌려준다.
   * 함수가 없거나 null을 돌려주면(멈춤) 모두 문 앞에 선다. 플레이 화면이 대본 시계에서 계산해 넘긴다. (순차 재생 계획 5.5)
   */
  frame?: (now: number) => WalkFrame | null;
}

/**
 * 길마다 알파카가 걷는다. React는 값이 바뀔 때만 그리고,
 * 움직임은 requestAnimationFrame에서 transform 속성만 바꾼다. 위치는 대본 시계 하나에서 계산한다.
 */
export function Walkers({ paths, pace = 'trip', frame }: WalkersProps) {
  const root = useRef<SVGGElement>(null);
  // 걷다가 멈추면 문 앞으로 이어 간다. 마지막으로 그린 자세를 기억한다(다시 그려져도 남는다)
  const shown = useRef<WalkerPose[]>([]);
  const mode = useRef<'walk' | 'stand' | null>(null);
  const blend = useRef<{ from: WalkerPose[]; at: number } | null>(null);
  const items: Item[] = paths.flatMap((p, road) => {
    if (p.kind === null) return [];
    const kind: WalkerKind = p.kind;
    // 한 번 걷기는 길마다 한 마리다
    const n = pace === 'trip' ? 1 : (p.count ?? walkersOn(p.cells.length));
    return Array.from({ length: n }, (_, k) => ({
      key: `${road}-${k}`,
      road,
      path: { cells: p.cells, from: p.from, to: p.to },
      kind,
      offset: (k * p.cells.length) / n,
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
    if (pace === 'trip' && (!frame || reducedMotion())) {
      // 멈춘 장면, 움직임 줄이기: 모두 문 앞에 선다. 값이 바뀌면 다시 그려진다
      nodes.forEach((node, i) => {
        const it = items[i];
        if (it) draw(node, (shown.current[i] = standPose(it.path)));
      });
      mode.current = 'stand';
      return;
    }
    if (pace === 'cell' && reducedMotion()) {
      nodes.forEach((node, i) => {
        const it = items[i];
        if (it) draw(node, poseAt(it.path, it.path.cells.length / 2 + it.offset));
      });
      return;
    }
    // 시계는 하나다. 다시 그려져도 알파카가 제자리로 튀지 않고, 길마다 어긋나지 않는다
    let raf = 0;
    const tick = (now: number) => {
      const f = pace === 'trip' && frame ? frame(now) : null;
      const m = pace === 'trip' && !f ? 'stand' : 'walk';
      // 걷다가 멈추면 문 앞으로 미끄러지듯 간다. 출발은 바로 한다(출발 문에서 나타난다)
      if (mode.current === 'walk' && m === 'stand') blend.current = { from: shown.current.slice(), at: now };
      if (m === 'walk') blend.current = null;
      mode.current = m;
      const b = blend.current;
      const k = b ? Math.min(1, (now - b.at) / BLEND_MS) : 1;
      if (k >= 1) blend.current = null;
      nodes.forEach((node, i) => {
        const it = items[i];
        if (!it) return;
        let pose: WalkerPose;
        if (pace === 'cell') pose = poseAt(it.path, now / 1000 / SECONDS_PER_CELL + it.offset);
        else {
          const p = f?.[it.road] ?? null;
          pose = p === null ? standPose(it.path) : walkPose(it.path, p);
        }
        const from = b?.from[i];
        if (from && k < 1) pose = lerpPose(from, pose, k * (2 - k));
        shown.current[i] = pose;
        draw(node, pose);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
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
