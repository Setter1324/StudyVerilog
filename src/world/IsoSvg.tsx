import type { ReactNode } from 'react';
import type { Prim, Rendered } from './iso';

function draw(p: Prim, k: number): ReactNode {
  switch (p.kind) {
    case 'poly':
      return (
        <polygon
          key={k}
          points={p.points}
          style={{
            fill: p.fill,
            stroke: p.stroke ?? 'none',
            fillOpacity: p.fillOpacity ?? p.opacity,
            strokeOpacity: p.opacity,
          }}
          strokeWidth={p.sw}
          strokeLinejoin="round"
          strokeDasharray={p.dash}
        />
      );
    case 'path':
      return <path key={k} d={p.d} style={{ fill: p.fill, stroke: p.stroke ?? 'none' }} strokeWidth={p.sw} strokeLinejoin="round" />;
    case 'circle':
      return <circle key={k} cx={p.cx} cy={p.cy} r={p.r} style={{ fill: p.fill, stroke: p.stroke ?? 'none' }} strokeWidth={p.sw} />;
    case 'text':
      return (
        <text
          key={k}
          x={p.x}
          y={p.y}
          textAnchor="middle"
          fontSize={p.size}
          fontWeight={800}
          paintOrder="stroke"
          style={{ fill: p.fill, stroke: p.stroke ?? 'none', fontFamily: 'var(--font-sans)' }}
          strokeWidth={p.sw}
        >
          {p.text}
        </text>
      );
    case 'group':
      return (
        <g key={k} data-id={p.id} className={p.className}>
          {p.children.map(draw)}
        </g>
      );
  }
}

/** 그림 요소 목록만 그린다(장면 위에 겹치는 알파카 등) */
export function IsoPrims({ prims }: { prims: Prim[] }) {
  return <>{prims.map(draw)}</>;
}

export interface IsoSvgProps {
  scene: Rendered;
  /** 장면 위에 그릴 것 (걷는 알파카) */
  children?: ReactNode;
  /** 화면 읽기 프로그램용 설명. 없으면 장식으로 다룬다 */
  title?: string;
  className?: string;
}

/** 아이소메트릭 장면을 SVG로 그린다. 장면 계산은 iso.ts가, 이 컴포넌트는 그리기만 한다. */
export function IsoSvg({ scene, title, className, children }: IsoSvgProps) {
  return (
    <svg
      className={className}
      viewBox={`${scene.x} ${scene.y} ${scene.w} ${scene.h}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {scene.prims.map(draw)}
      {children}
    </svg>
  );
}
