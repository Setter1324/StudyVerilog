import { useEffect, useRef } from 'react';
import { BLEND_MS, type ScriptView } from './beat';
import type { PropGroup } from './iso';
import { IsoPrims } from './IsoSvg';
import {
  neonSprite,
  poseAt,
  standPose,
  walkersOn,
  walkerSprite,
  walkPose,
  type Dir,
  type Track,
  type WalkerKind,
  type WalkerPose,
  type WalkPath,
} from './walkers';
import st from './Walkers.module.css';

/** 칸 걷기(섬 지도)에서 한 칸을 걷는 시간 (5.5) */
const SECONDS_PER_CELL = 0.8;
const DIRS: Dir[] = [0, 1, 2, 3];
/** 꼬리표를 알파카 발에서 얼마나 위에 띄울지(px). 알파카 머리 위 14px쯤 (순차 재생 계획 6.2) */
const TAG_LIFT = 46;

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
  cell: b.cell,
});

/** 칸의 그리는 순서: 뒤(i + j가 작은 칸)에서 앞으로, 같으면 i가 작은 칸 먼저. Scene.render와 같다 */
const depth = (i: number, j: number) => (i + j) * 4096 + i;

/** 대본 시계가 주는 장면. null이면 멈춘 장면이라 모두 문 앞에 서고 네온이 없다 */
export type ViewClock = (now: number) => ScriptView | null;

/** 길마다 지금 자세: 걷는 중이면 걷는 자세, 아니면 문 앞 */
const poseOf = (path: Track, v: ScriptView | null, road: number) => {
  const p = v?.walk[road] ?? null;
  return p === null ? standPose(path) : walkPose(path, p);
};

export interface WalkersProps {
  paths: WalkPath[];
  pace?: Pace;
  /**
   * 대본 시계(trip일 때). 프레임 시각(ms)을 받아 길마다 걷기, 네온을 돌려준다.
   * 함수가 없거나 null을 돌려주면(멈춤) 모두 문 앞에 선다. 플레이 화면이 대본 시계에서 계산해 넘긴다. (순차 재생 계획 5.5)
   */
  view?: ViewClock;
  /**
   * 장면의 건물과 집(칸마다 한 묶음, 그리는 순서대로). 주면 알파카를 그 사이에 끼워 그린다.
   * 건물 뒤 칸(뒤 문, 위 문)에 선 알파카가 건물에 가려진다 (순차 재생 계획 5.5의 앞뒤 층)
   */
  props?: PropGroup[];
}

/**
 * 길마다 알파카가 걷는다. React는 값이 바뀔 때만 그리고,
 * 움직임은 requestAnimationFrame에서 transform 속성만 바꾼다. 위치는 대본 시계 하나에서 계산한다.
 * 이번 구간에 바뀐 길의 알파카는 네온 테두리를 두른다(밑에 깐 네온 그림).
 */
export function Walkers({ paths, pace = 'trip', view, props = [] }: WalkersProps) {
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
    const groups = Array.from(g.querySelectorAll<SVGGElement>(':scope > g[data-p]'));
    const glows = nodes.map((n) => Array.from(n.querySelectorAll<SVGGElement>('g[data-neon]')));
    const glowShown: number[] = [];
    const keys = props.map((p) => depth(p.i, p.j));
    // 알파카마다 지금 끼워 둔 자리(앞에 있는 상자 묶음 수). 바뀔 때만 DOM을 옮긴다
    let slots = '';
    const place = (poses: (WalkerPose | undefined)[]) => {
      if (!groups.length) return;
      const at = poses.map((p) => (p ? keys.filter((k) => k <= depth(p.cell[0], p.cell[1])).length : 0));
      const sig = at.join(',');
      if (sig === slots) return;
      slots = sig;
      const seq: SVGGElement[] = [];
      groups.forEach((grp, k) => {
        nodes.forEach((node, i) => {
          if (at[i] === k) seq.push(node);
        });
        seq.push(grp);
      });
      nodes.forEach((node, i) => {
        if (at[i] === groups.length) seq.push(node);
      });
      for (const el of seq) g.appendChild(el);
    };
    const draw = (node: SVGGElement, pose: WalkerPose, i: number, glow: number) => {
      node.setAttribute('transform', `translate(${pose.x.toFixed(1)} ${pose.y.toFixed(1)})`);
      node.setAttribute('opacity', pose.opacity.toFixed(2));
      // 방향별 그림 중 하나만 보인다
      node.querySelectorAll<SVGGElement>(':scope > g[data-dir]').forEach((d) => {
        d.style.display = d.dataset.dir === String(pose.dir) ? '' : 'none';
      });
      if (glowShown[i] !== glow) {
        glowShown[i] = glow;
        for (const el of glows[i] ?? []) el.setAttribute('opacity', glow.toFixed(2));
      }
    };
    if (pace === 'trip' && !view) {
      // 멈춘 장면: 모두 문 앞에 선다. 값이 바뀌면 다시 그려진다
      nodes.forEach((node, i) => {
        const it = items[i];
        if (it) draw(node, (shown.current[i] = standPose(it.path)), i, 0);
      });
      place(shown.current);
      mode.current = 'stand';
      return;
    }
    if (pace === 'cell' && reducedMotion()) {
      nodes.forEach((node, i) => {
        const it = items[i];
        if (it) draw(node, poseAt(it.path, it.path.cells.length / 2 + it.offset), i, 0);
      });
      return;
    }
    // 시계는 하나다. 다시 그려져도 알파카가 제자리로 튀지 않고, 길마다 어긋나지 않는다
    let raf = 0;
    const tick = (now: number) => {
      const v = pace === 'trip' && view ? view(now) : null;
      const m = pace === 'trip' && !v ? 'stand' : 'walk';
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
        let pose = pace === 'cell' ? poseAt(it.path, now / 1000 / SECONDS_PER_CELL + it.offset) : poseOf(it.path, v, it.road);
        const from = b?.from[i];
        if (from && k < 1) pose = lerpPose(from, pose, k * (2 - k));
        shown.current[i] = pose;
        draw(node, pose, i, v && v.trail[it.road] !== null ? v.glow : 0);
      });
      place(shown.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  return (
    <g ref={root} aria-hidden="true">
      {props.map((p) => (
        <g key={`p${p.i},${p.j}`} data-p="">
          <IsoPrims prims={p.prims} />
        </g>
      ))}
      {items.map((it) => (
        <g key={it.key} data-w="">
          {DIRS.map((d) => (
            <g key={d} data-dir={d}>
              {pace === 'trip' && (
                <g data-neon="" opacity={0}>
                  <IsoPrims prims={neonSprite(it.kind, d)} />
                </g>
              )}
              <IsoPrims prims={walkerSprite(it.kind, d)} />
            </g>
          ))}
        </g>
      ))}
    </g>
  );
}

/**
 * 꼬리표: 건물을 나온 알파카 머리 위에 코드의 지연(#3)을 단다. 알파카와 함께 움직이고 구간이 끝날 때까지 보인다.
 * 이름표 층보다 위에 그린다(IsoSvg의 overlay). 입력 알파카와 지연이 없는 출력에는 없다 (순차 재생 계획 6.2)
 * @param text 길마다 꼬리표 글(#3) 또는 null
 */
export function WalkerTags({ paths, view, text }: { paths: WalkPath[]; view: ViewClock; text: (string | null)[] }) {
  const root = useRef<SVGGElement>(null);
  const tracks: Track[] = paths.map((p) => ({ cells: p.cells, from: p.from, to: p.to }));

  useEffect(() => {
    const g = root.current;
    if (!g) return;
    const tags = Array.from(g.querySelectorAll<SVGGElement>(':scope > g[data-tag]'));
    let raf = 0;
    const tick = (now: number) => {
      const v = view(now);
      for (const el of tags) {
        const road = Number(el.dataset.tag);
        const track = tracks[road];
        const on = v && track && v.tags[road] ? v.glow : 0;
        el.setAttribute('opacity', on.toFixed(2));
        if (on > 0 && track) {
          const pose = poseOf(track, v, road);
          el.setAttribute('transform', `translate(${pose.x.toFixed(1)} ${(pose.y - TAG_LIFT).toFixed(1)})`);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  return (
    <g ref={root} aria-hidden="true">
      {text.map((tx, road) => {
        if (!tx || !paths[road] || paths[road].kind === null) return null;
        const w = 12 + tx.length * 8;
        return (
          <g key={road} data-tag={road} className={st.tag} opacity={0}>
            <rect x={-w / 2} y={-10} width={w} height={20} />
            <text x={0} y={4.5} textAnchor="middle">
              {tx}
            </text>
          </g>
        );
      })}
    </g>
  );
}
