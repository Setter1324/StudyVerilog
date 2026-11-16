import s from './ZonePin.module.css';

export type ZoneId = 1 | 2 | 3 | 4 | 5 | 6;

export interface ZonePinProps {
  zone: ZoneId;
  /** 화면 읽기 프로그램용 구역 이름. 주지 않으면 장식으로 다룬다 */
  label?: string;
  size?: 'sm' | 'md';
  /** 준비 중이면 흐리게 */
  dimmed?: boolean;
}

/** 구역 번호 핀. 색에는 항상 번호가 붙는다. (최종계획서 7.3, 7.7) */
export function ZonePin({ zone, label, size = 'md', dimmed }: ZonePinProps) {
  return (
    <span
      className={[s.pin, s[size], dimmed ? s.dimmed : ''].filter(Boolean).join(' ')}
      style={{ background: `var(--zone-${zone})` }}
      role={label ? 'img' : undefined}
      aria-label={label ? `구역 ${zone} ${label}` : undefined}
      aria-hidden={label ? undefined : true}
    >
      {zone}
    </span>
  );
}
