import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import type { ZoneId } from './ZonePin';
import s from './StageStones.module.css';

export interface Stone {
  id: string;
  no: string;
  title: string;
}

export interface StageStonesProps {
  /** 이 구역의 스테이지, 순서대로 */
  stages: Stone[];
  current: string;
  /** 통과한 스테이지 */
  done: Record<string, boolean | undefined>;
  /** 정답을 본 스테이지. 칸 가운데에 점을 찍는다(감점은 없다) */
  peeked?: Record<string, boolean | undefined>;
  zone: ZoneId;
  /** 통과한 순간: ▼가 다음 칸으로 뛴다 */
  hop?: boolean;
  /** 틀릴 때마다 바뀌는 수. 바뀌면 지금 칸이 좌우로 두 번 흔들린다(0이면 흔들지 않는다) */
  shake?: number;
  /** 칸의 주소. 기본은 플레이 화면 */
  href?: (id: string) => string;
}

const MOVE: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };

/**
 * 징검다리: 구역의 스테이지 수만큼 작은 블록. 통과한 칸은 구역 색으로 채우고, 지금 칸은 크게 그리고 위에 ▼를 단다.
 * Tab 한 번에 묶음에 닿고(지금 칸만 Tab으로 갈 수 있다), 방향키로 칸을 옮긴다. (걷기 박자와 상단 바 계획 6.2, 6.4)
 */
export function StageStones({ stages, current, done, peeked = {}, zone, hop, shake = 0, href = (id) => `#/play/${id}` }: StageStonesProps) {
  const row = useRef<HTMLDivElement>(null);
  const at = Math.max(0, stages.findIndex((st) => st.id === current));
  const marker = hop && at + 1 < stages.length ? at + 1 : at;

  const onKey = (e: KeyboardEvent<HTMLAnchorElement>) => {
    const links: HTMLAnchorElement[] = Array.from(row.current?.querySelectorAll<HTMLAnchorElement>('a') ?? []);
    const i = links.indexOf(e.currentTarget);
    const to = e.key in MOVE ? i + MOVE[e.key]! : e.key === 'Home' ? 0 : e.key === 'End' ? links.length - 1 : -1;
    const next = links[to];
    if (to < 0 || !next) return;
    e.preventDefault();
    next.focus();
  };

  return (
    <nav aria-label="이 구역의 스테이지" className={s.nav} style={{ '--stone': `var(--zone-${zone})` } as CSSProperties}>
      <div ref={row} className={s.row}>
        {stages.map((st, i) => {
          const now = i === at;
          const passed = !!done[st.id];
          const peek = !!peeked[st.id];
          return (
            <a
              key={st.id}
              href={href(st.id)}
              className={s.hit}
              tabIndex={now ? 0 : -1}
              aria-current={now ? 'step' : undefined}
              aria-label={`${st.no} ${st.title}${passed ? ', 통과' : ''}${peek ? ', 정답 봄' : ''}${now ? ', 지금' : ''}`}
              title={`${st.no} ${st.title}`}
              onKeyDown={onKey}
            >
              {i === marker && (
                <svg className={marker !== at ? `${s.marker} ${s.hop}` : s.marker} viewBox="0 0 10 8" aria-hidden="true">
                  <path d="M0 0h10L5 8Z" />
                </svg>
              )}
              <span
                // 틀릴 때마다 다시 붙여 흔들림을 처음부터 보여 준다
                key={now ? `now-${shake}` : 'stone'}
                className={[s.stone, passed ? s.done : '', peek ? s.peeked : '', now ? s.now : '', now && shake > 0 ? s.shake : '']
                  .filter(Boolean)
                  .join(' ')}
                aria-hidden="true"
              />
            </a>
          );
        })}
      </div>
    </nav>
  );
}
