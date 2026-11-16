import type { ButtonHTMLAttributes, ReactNode } from 'react';
import s from './IconButton.module.css';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** 화면 읽기 프로그램이 읽는 이름. 아이콘만 있으므로 꼭 준다 */
  label: string;
  /** 켜짐 상태 (소리, 힌트). 주면 토글 버튼이 된다 */
  pressed?: boolean;
  children: ReactNode;
}

/** 44×44px 아이콘 버튼. (최종계획서 7.6, 7.7) */
export function IconButton({ label, pressed, className, type = 'button', children, ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={[s.icon, pressed ? s.on : '', className ?? ''].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}
