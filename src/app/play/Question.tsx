import type { QuestionSpec } from '../../sim/stage';
import s from './Question.module.css';

export interface QuestionProps {
  q: QuestionSpec;
  value: string;
  onChange: (v: string) => void;
  /** 채점이 끝났으면 맞았는지 */
  result?: boolean;
}

/** 예측형(보기 고르기)과 타이밍형(숫자 칸 하나). (최종계획서 8.3) */
export function Question({ q, value, onChange, result }: QuestionProps) {
  return (
    <fieldset className={s.box}>
      <legend className={s.prompt}>{q.prompt}</legend>
      {q.kind === 'choice' ? (
        <div className={s.choices} role="radiogroup" aria-label={q.prompt}>
          {q.choices.map((c) => (
            <label key={c} className={value === c ? `${s.choice} ${s.on}` : s.choice}>
              <input type="radio" name="answer" value={c} checked={value === c} onChange={() => onChange(c)} />
              <span>{c}</span>
            </label>
          ))}
        </div>
      ) : (
        <label className={s.number}>
          <input
            type="number"
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={q.prompt}
          />
          {q.unit && <span>{q.unit}</span>}
        </label>
      )}
      {result !== undefined && <p className={result ? s.ok : s.no}>{result ? '맞아요' : '다시 생각해 봐요'}</p>}
    </fieldset>
  );
}
