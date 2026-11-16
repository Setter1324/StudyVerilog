import { useRef } from 'react';
import s from './CodeEditor.module.css';

export interface CodeEditorProps {
  value: string;
  onChange?: (v: string) => void;
  /** 읽기 전용(예측형, 타이밍형) */
  readOnly?: boolean;
  label: string;
  errorLines?: Set<number>;
}

/**
 * 파일 전체를 고치는 에디터(버그 수정, 변환, 설계형). 줄 번호와 오류 줄 표시만 있는 가벼운 판이다.
 * CodeMirror(9.1)는 문법 강조가 필요해질 때 이 컴포넌트 자리에 넣는다.
 */
export function CodeEditor({ value, onChange, readOnly, label, errorLines }: CodeEditorProps) {
  const gutter = useRef<HTMLDivElement>(null);
  const lines = value.split('\n').length;
  return (
    <div className={readOnly ? `${s.wrap} ${s.readOnly}` : s.wrap}>
      <div ref={gutter} className={s.gutter} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={errorLines?.has(i + 1) ? s.err : undefined}>
            {i + 1}
          </div>
        ))}
      </div>
      <textarea
        className={s.text}
        value={value}
        readOnly={readOnly}
        aria-label={label}
        aria-readonly={readOnly || undefined}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        wrap="off"
        rows={Math.max(lines, 6)}
        onChange={(e) => onChange?.(e.target.value)}
        onScroll={(e) => {
          if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
        }}
      />
    </div>
  );
}
