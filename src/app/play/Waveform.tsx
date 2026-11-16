import type { PointerEvent } from 'react';
import type { Timeline } from '../../sim/types';
import { valueAt } from '../../sim/vcd';
import s from './Waveform.module.css';

export interface WaveformProps {
  timeline: Timeline | null;
  /** 짧은 이름 → VCD 이름, 그리는 순서 */
  bind: Record<string, string>;
  t: number;
  onSeek: (t: number) => void;
  highlight?: string;
  onHover?: (name: string | undefined) => void;
}

const ROW = 34;
const LABEL = 48;
const W = 560;

/** 신호별 파형. 1·0은 높고 낮은 선, x는 보라 칸과 글자, z는 가운데 점선. 시간 슬라이더와 같은 시각선 (6.1, 7.2) */
export function Waveform({ timeline, bind, t, onSeek, highlight, onHover }: WaveformProps) {
  const names = Object.keys(bind);
  if (!timeline) {
    return <div className={s.empty}>실행하면 파형이 여기에 그려져요.</div>;
  }
  const end = Math.max(1, timeline.end);
  const plotW = W - LABEL - 36; // 오른쪽에 지금 값을 적을 자리
  const X = (time: number) => LABEL + (time / end) * plotW;
  const H = names.length * ROW + 22;

  const seek = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    onSeek(Math.round(Math.min(end, Math.max(0, ((x - LABEL) / plotW) * end))));
  };

  return (
    <svg
      className={s.svg}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`파형. 현재 시각 t=${t}`}
      onPointerDown={seek}
    >
      {names.map((name, k) => {
        const track = timeline.signals[bind[name]!];
        const y0 = k * ROW + 6;
        const hi = y0 + 4;
        const lo = y0 + ROW - 10;
        const mid = (hi + lo) / 2;
        const segs: [number, number, string][] = [];
        if (track) {
          const ch = track.changes;
          for (let i = 0; i < ch.length; i++) {
            const [ta, v] = ch[i]!;
            const tb = i + 1 < ch.length ? ch[i + 1]![0] : end;
            if (tb > ta || i === ch.length - 1) segs.push([ta, Math.max(ta, tb), v]);
          }
        }
        return (
          <g
            key={name}
            className={highlight === name ? s.rowOn : s.row}
            onPointerEnter={() => onHover?.(name)}
            onPointerLeave={() => onHover?.(undefined)}
          >
            <text x={8} y={mid + 4} className={s.label}>
              {name}
            </text>
            {segs.map(([a, b, v], i) => {
              const xa = X(a);
              const xb = X(b);
              const bit = v[0] ?? 'x';
              if (track && track.width > 1) {
                return (
                  <g key={i}>
                    <path d={`M${xa},${mid} L${xa + 4},${hi} L${xb - 4},${hi} L${xb},${mid} L${xb - 4},${lo} L${xa + 4},${lo} Z`} className={s.bus} />
                    {xb - xa > 24 && (
                      <text x={(xa + xb) / 2} y={mid + 4} className={s.busText}>
                        {v}
                      </text>
                    )}
                  </g>
                );
              }
              if (bit === 'x')
                return (
                  <g key={i}>
                    <rect x={xa} y={hi} width={Math.max(0, xb - xa)} height={lo - hi} className={s.x} />
                    {xb - xa > 14 && (
                      <text x={(xa + xb) / 2} y={mid + 4} className={s.xText}>
                        x
                      </text>
                    )}
                  </g>
                );
              if (bit === 'z') return <line key={i} x1={xa} x2={xb} y1={mid} y2={mid} className={s.z} />;
              const y = bit === '1' ? hi : lo;
              const prev = i > 0 ? segs[i - 1]![2][0] : undefined;
              const py = prev === '1' ? hi : prev === '0' ? lo : y;
              return (
                <g key={i}>
                  {i > 0 && <line x1={xa} x2={xa} y1={py} y2={y} className={s.edge} />}
                  <line x1={xa} x2={xb} y1={y} y2={y} className={bit === '1' ? s.one : s.zero} />
                </g>
              );
            })}
            {track && (
              <text x={W - 4} y={y0 + 2} className={s.now} textAnchor="end">
                {valueAt(track, t)}
              </text>
            )}
          </g>
        );
      })}
      <line x1={X(Math.min(t, end))} x2={X(Math.min(t, end))} y1={0} y2={H - 16} className={s.cursor} />
      <text x={X(Math.min(t, end))} y={H - 4} className={s.cursorText} textAnchor="middle">
        t={t}
      </text>
    </svg>
  );
}
