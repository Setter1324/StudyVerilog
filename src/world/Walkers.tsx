import { useEffect, useRef } from 'react';
import { IsoPrims } from './IsoSvg';
import { poseAt, walkersOn, walkerSprite, type Dir, type WalkerKind, type WalkPath } from './walkers';

const SECONDS_PER_CELL = 0.8; // 5.5
const DIRS: Dir[] = [0, 1, 2, 3];

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 길마다 알파카 몇 마리가 걷는다. React는 처음 한 번만 그리고,
 * 움직임은 requestAnimationFrame에서 transform 속성만 바꾼다.
 */
export function Walkers({ paths }: { paths: WalkPath[] }) {
  const root = useRef<SVGGElement>(null);
  const items = paths.flatMap((p, pi) => {
    if (p.kind === null) return [];
    const kind: WalkerKind = p.kind;
    const n = p.count ?? walkersOn(p.cells.length);
    return Array.from({ length: n }, (_, k) => ({
      key: `${pi}-${k}`,
      path: p.cells,
      kind,
      offset: (k * p.cells.length) / n,
    }));
  });

  useEffect(() => {
    const g = root.current;
    if (!g) return;
    const nodes = Array.from(g.querySelectorAll<SVGGElement>(':scope > g[data-w]'));
    const place = (secs: number) => {
      nodes.forEach((node, i) => {
        const it = items[i];
        if (!it) return;
        const pose = poseAt(it.path, secs / SECONDS_PER_CELL + it.offset);
        node.setAttribute('transform', `translate(${pose.x.toFixed(1)} ${pose.y.toFixed(1)})`);
        node.setAttribute('opacity', pose.opacity.toFixed(2));
        // 방향별 그림 중 하나만 보인다
        node.querySelectorAll<SVGGElement>(':scope > g[data-dir]').forEach((d) => {
          d.style.display = d.dataset.dir === String(pose.dir) ? '' : 'none';
        });
      });
    };
    if (reducedMotion()) {
      place(0);
      return;
    }
    // 시계는 페이지 기준이라, 다시 그려져도 알파카가 제자리로 튀지 않는다
    let raf = 0;
    const tick = (now: number) => {
      place(now / 1000);
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
