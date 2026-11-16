import type { ReactNode } from 'react';
import s from './LockedLine.module.css';

export interface LockedLineProps {
  children: ReactNode;
  /** 줄 번호 */
  line?: number;
}

/** 편집할 수 없는 줄. 회색 배경과 자물쇠. (최종계획서 6.3, 7.7) */
export function LockedLine({ children, line }: LockedLineProps) {
  return (
    <div className={s.line} aria-readonly="true" title="잠긴 줄이에요">
      {line !== undefined && <span className={s.no}>{line}</span>}
      <svg className={s.lock} viewBox="0 0 16 16" aria-hidden="true">
        <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
        <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      <span className={s.sr}>잠김: </span>
      <code className={s.code}>{children}</code>
    </div>
  );
}
