import type { InputHTMLAttributes } from 'react';
import s from './CodeBlank.module.css';

export interface CodeBlankProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** 틀렸을 때 빨간 테두리. 비어 있음·채움은 값으로 정해진다 */
  wrong?: boolean;
  /** 화면 읽기 프로그램용 이름. 예: "빈칸 1: AND 건물을 지나는 데 걸리는 시간" */
  label: string;
  /** 칸 폭(글자 수). 기본은 값 길이에 맞춘다 */
  chars?: number;
}

/** 에디터 속 빈칸. 점선 테두리와 옅은 파랑 배경. Tab으로 다음 빈칸에 간다. (최종계획서 6.3, 7.7) */
export function CodeBlank({ wrong, label, chars, value, className, ...rest }: CodeBlankProps) {
  const text = typeof value === 'string' ? value : '';
  const width = Math.max(chars ?? 0, text.length, 3) + 1;
  const state = wrong ? s.wrong : text === '' ? s.empty : s.filled;
  return (
    <input
      type="text"
      spellCheck={false}
      autoCapitalize="off"
      autoComplete="off"
      aria-label={label}
      aria-invalid={wrong || undefined}
      value={value}
      className={[s.blank, state, className ?? ''].filter(Boolean).join(' ')}
      style={{ width: `${width}ch` }}
      {...rest}
    />
  );
}
