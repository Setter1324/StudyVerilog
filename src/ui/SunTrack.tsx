import type { CSSProperties } from 'react';
import s from './SunTrack.module.css';

export interface SunTrackProps {
  /**
   * idle: 실행 전, 빈 트랙
   * loading: 엔진을 받거나 컴파일하는 중
   * time: 재생 중. 해가 재생 시각을 따라 간다
   * dusk: 해가 졌다($finish)
   */
  state: 'idle' | 'loading' | 'time' | 'dusk';
  /** 0~1. time이면 재생 시각 ÷ 끝 시각, loading이면 받은 비율. loading에 값이 없으면 좌우로 흐른다 */
  value?: number;
  /** 통과하면 트랙이 한 번 --success로 찬다 */
  passed?: boolean;
}

/**
 * 해의 길: 상단 바 아래의 3px 트랙. 왼쪽 끝이 t=0, 오른쪽 끝이 $finish다.
 * 장식으로 다룬다(시각은 월드 아래 슬라이더가 이미 말한다). (걷기 박자와 상단 바 계획 6.2, 6.3)
 */
export function SunTrack({ state, value, passed }: SunTrackProps) {
  const v = Math.max(0, Math.min(1, value ?? 0));
  const p = `${(state === 'dusk' ? 1 : state === 'idle' ? 0 : v) * 100}%`;
  const flowing = state === 'loading' && value === undefined;
  return (
    <div
      className={[s.track, s[state], passed && state === 'dusk' ? s.passed : ''].filter(Boolean).join(' ')}
      style={{ '--p': p } as CSSProperties}
      aria-hidden="true"
    >
      <span className={flowing ? s.flow : s.fill} />
      {(state === 'time' || state === 'dusk') && <span className={s.sun} />}
    </div>
  );
}
