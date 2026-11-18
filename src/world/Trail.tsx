import { useEffect, useRef } from 'react';
import { sizeOf, type SceneSpec } from './doors';
import { project, trackPoints, type WalkPath } from './walkers';
import type { ViewClock } from './Walkers';

const f1 = (x: number) => x.toFixed(1);

/**
 * 네온 선: 이번 구간에 바뀐 길의 가운데를 따라 알파카 뒤로 3px 선이 그어지고(pathLength와 dashoffset),
 * 지나는 중이거나 지난 건물의 바닥 테두리가 켜진다. 구간이 끝날 때까지 남고 180ms로 꺼진다.
 * 땅 위, 건물과 알파카 밑에 그린다. 위치는 대본 시계에서 계산한다 (순차 재생 계획 6.1)
 */
export function Trail({ scene, paths, view }: { scene: SceneSpec; paths: WalkPath[]; view: ViewClock }) {
  const root = useRef<SVGGElement>(null);

  useEffect(() => {
    const g = root.current;
    if (!g) return;
    const lines = Array.from(g.querySelectorAll<SVGPolylineElement>(':scope > polyline'));
    const bases = Array.from(g.querySelectorAll<SVGPolygonElement>(':scope > polygon'));
    const last = new Map<Element, string>();
    const set = (el: Element, name: string, v: string) => {
      const k = name + v;
      if (last.get(el) === k) return;
      last.set(el, k);
      el.setAttribute(name, v);
    };
    let raf = 0;
    const tick = (now: number) => {
      const v = view(now);
      lines.forEach((el, r) => {
        const p = v?.trail[r] ?? null;
        el.setAttribute('opacity', p === null || !v ? '0' : v.glow.toFixed(2));
        set(el, 'stroke-dashoffset', p === null ? '1' : (1 - p).toFixed(3));
      });
      bases.forEach((el, k) => {
        el.setAttribute('opacity', v?.gates[k] ? v.glow.toFixed(2) : '0');
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  return (
    <g ref={root} aria-hidden="true" style={{ stroke: 'var(--neon)', fill: 'none' }} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((p, r) => (
        <polyline
          key={`r${r}`}
          points={trackPoints(p)
            .map(([x, y]) => `${f1(x)},${f1(y)}`)
            .join(' ')}
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1}
          strokeWidth={3}
          opacity={0}
        />
      ))}
      {scene.gates.map((gate) => {
        const [i, j] = gate.at;
        const [w, h] = sizeOf(gate);
        const e = 0.04;
        const pts = [project(i + e, j + e), project(i + w - e, j + e), project(i + w - e, j + h - e), project(i + e, j + h - e)];
        return <polygon key={gate.id} points={pts.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ')} strokeWidth={3} opacity={0} />;
      })}
    </g>
  );
}
