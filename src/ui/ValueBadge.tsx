import s from './ValueBadge.module.css';

export type SignalValue = '1' | '0' | 'x' | 'z';

const NAMES: Record<SignalValue, string> = {
  '1': '짐 실은 동물',
  '0': '빈손 동물',
  x: '안개 속 동물',
  z: '끊긴 길',
};

export interface ValueBadgeProps {
  value: SignalValue;
  /** 그림 옆에 뜻을 글로도 보여 준다 (값 읽는 법 카드) */
  showName?: boolean;
  size?: 'sm' | 'md';
}

/** 신호 값 1·0·x·z. 색, 모양, 글자를 함께 쓴다. (최종계획서 7.2, 14.3) */
export function ValueBadge({ value, showName, size = 'md' }: ValueBadgeProps) {
  return (
    <span className={`${s.badge} ${s[size]}`} data-value={value}>
      <svg className={s.icon} viewBox="0 0 24 24" aria-hidden="true">
        {value === '1' && (
          // 상자: 윗면, 왼쪽 면, 오른쪽 면
          <g>
            <path d="M12 3 21 7.5 12 12 3 7.5Z" fill="var(--val-1)" />
            <path d="M3 7.5 12 12v9l-9-4.5Z" fill="color-mix(in srgb, var(--val-1), var(--world-shade) 16%)" />
            <path d="M21 7.5 12 12v9l9-4.5Z" fill="color-mix(in srgb, var(--val-1), var(--world-shade) 30%)" />
          </g>
        )}
        {value === '0' && (
          // 빈 짐받이: 테두리만
          <path d="M12 3 21 7.5v9L12 21l-9-4.5v-9Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        )}
        {value === 'x' && (
          <g>
            <circle cx="12" cy="12" r="9" fill="var(--val-x)" fillOpacity="0.4" />
            <text x="12" y="16.5" textAnchor="middle" fontSize="13" fontWeight="800" fill="currentColor">
              ?
            </text>
          </g>
        )}
        {value === 'z' && (
          // 끊긴 길
          <g stroke="var(--val-z)" strokeWidth="2.4" strokeLinecap="round">
            <path d="M3 16 9 13" />
            <path d="M15 10 21 7" />
            <path d="M10.5 9.5 13.5 14.5" strokeWidth="1.6" strokeDasharray="1.5 2.5" />
          </g>
        )}
      </svg>
      <b className={s.glyph}>{value}</b>
      {showName ? <span className={s.name}>{NAMES[value]}</span> : <span className={s.sr}>{NAMES[value]}</span>}
    </span>
  );
}
