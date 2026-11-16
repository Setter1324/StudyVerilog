import type { ButtonHTMLAttributes } from 'react';
import s from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  /** 한 줄을 다 쓴다 (좁은 화면의 주 버튼) */
  block?: boolean;
}

/** 알약 모양 버튼. 높이 48px. (최종계획서 7.6, 7.7) */
export function Button({ variant = 'primary', block, className, type = 'button', ...rest }: ButtonProps) {
  const cls = [s.button, s[variant], block ? s.block : '', className ?? ''].filter(Boolean).join(' ');
  return <button type={type} className={cls} {...rest} />;
}
