import s from './ProgressBar.module.css';

export interface ProgressBarProps {
  value: number;
  max: number;
  /** 화면 읽기 프로그램용 이름. 예: "게이트 마을 진행" */
  label: string;
  /** 막대 옆에 "4 / 15"를 보여 준다 */
  showCount?: boolean;
}

/** 구역 진행 막대. (최종계획서 7.7) */
export function ProgressBar({ value, max, label, showCount = true }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={s.wrap}>
      <div
        className={s.track}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div className={s.fill} style={{ width: `${pct}%` }} />
      </div>
      {showCount && (
        <span className={s.count}>
          {value} / {max}
        </span>
      )}
    </div>
  );
}
