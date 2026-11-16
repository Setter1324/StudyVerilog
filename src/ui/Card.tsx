import type { HTMLAttributes } from 'react';
import s from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** default: 기본, highlight: 강조 테두리(지금 구역), hero: "이어서 하기" 카드(반지름 20px, 그림자) */
  variant?: 'default' | 'highlight' | 'hero';
  as?: 'div' | 'section' | 'article' | 'li';
}

/** 카드. 테두리 1px, 반지름 16px, 안쪽 20px. (최종계획서 7.6, 7.7) */
export function Card({ variant = 'default', as: Tag = 'div', className, ...rest }: CardProps) {
  return <Tag className={[s.card, s[variant], className ?? ''].filter(Boolean).join(' ')} {...rest} />;
}
