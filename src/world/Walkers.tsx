import { useEffect, useRef } from 'react';
import { BEAT_SECONDS } from './beat';
import { IsoPrims } from './IsoSvg';
import { poseAt, tripPose, walkersOn, walkerSprite, type Dir, type WalkerKind, type WalkerPose, type WalkPath } from './walkers';

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
  path: [number, number][];
  kind: WalkerKind;
  /** trip이면 위상(0..1), cell이면 칸 수 */
  offset: number;
}

/**
 * 길마다 알파카가 걷는다. React는 처음 한 번만 그리고,
 * 움직임은 requestAnimationFrame에서 transform 속성만 바꾼다.
 */
export function Walkers({ paths, pace = 'trip' }: { paths: WalkPath[]; pace?: Pace }) {
  const root = useRef<SVGGElement>(null);
  const items: Item[] = paths.flatMap((p, pi) => {
    if (p.kind === null) return [];
    const kind: WalkerKind = p.kind;
    // 한 박자 걷기는 모든 길이 같은 수여야 같이 도착한다(기본 한 마리)
    const n = p.count ?? (pace === 'trip' ? 1 : walkersOn(p.cells.length));
    return Array.from({ length: n }, (_, k) => ({
      key: `${pi}-${k}`,
      path: p.cells,
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
    const poseOf = (it: Item, secs: number) =>
      pace === 'trip' ? tripPose(it.path, secs / BEAT_SECONDS + it.offset) : poseAt(it.path, secs / SECONDS_PER_CELL + it.offset);
    if (reducedMotion()) {
      // 움직임 줄이기: 길 가운데에 세운다(위상 0.5). 시각 0의 자리는 투명해서 보이지 않는다
      nodes.forEach((node, i) => {
        const it = items[i];
        if (!it) return;
        draw(node, pace === 'trip' ? tripPose(it.path, 0.5 + it.offset) : poseAt(it.path, it.path.length / 2 + it.offset));
      });
      return;
    }
    // 시계는 페이지 기준 하나다. 다시 그려져도 알파카가 제자리로 튀지 않고, 길마다 어긋나지 않는다
    let raf = 0;
    const frame = (now: number) => {
      nodes.forEach((node, i) => {
        const it = items[i];
        if (it) draw(node, poseOf(it, now / 1000));
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
