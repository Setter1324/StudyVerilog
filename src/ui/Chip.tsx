import type { ReactNode } from 'react';
import s from './Chip.module.css';

export interface ChipProps {
  /** type: 문제 유형(예측·빈칸), subject: 과목(VERILOG), status: 상태(준비 중) */
  variant?: 'type' | 'subject' | 'status';
  children: ReactNode;
}

/** 작은 꼬리표. (최종계획서 7.5 꼬리표, 7.7) */
export function Chip({ variant = 'type', children }: ChipProps) {
  return <span className={`${s.chip} ${s[variant]}`}>{children}</span>;
}
