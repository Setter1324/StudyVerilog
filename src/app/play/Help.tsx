import { Fragment, useState } from 'react';
import { solutionView, type StageData } from '../../sim/stage';
import { Button } from '../../ui';
import s from './Help.module.css';

export interface HelpProps {
  data: StageData;
  /** 연 단계 수: 0이면 아무것도 열지 않았다. 힌트 수 + 1이면 정답까지 열었다 */
  opened: number;
  /** 다음 단계를 연다. 정답을 열면 정답을 본 스테이지로 적는다 */
  onOpen: () => void;
  /** 넣기 단추: 이 값들을 작성 중인 값에 합친다 */
  onFill: (values: Record<string, string>) => void;
}

/**
 * 도움 칸: 문제 설명 바로 아래에 늘 있다. 힌트 1(개념) → 2(위치) → 3(답의 형태) → 정답.
 * 앞 단계를 열어야 다음 단계가 열리고, 정답은 힌트를 다 연 뒤 [정답 보기]를 눌러야 보인다. 감점은 없다.
 * 넣기 단추는 값을 채우기만 한다. 실행은 사용자가 누른다 (순차 재생과 게이트 입구 계획 7장)
 */
export function Help({ data, opened, onOpen, onFill }: HelpProps) {
  const n = data.hints.length;
  const steps = [...data.hints.map((_, k) => `힌트 ${k + 1}`), '정답'];
  // 보고 있는 단계. 새로 열면 그 단계로 간다
  const [picked, setPicked] = useState<number | null>(null);
  const [seen, setSeen] = useState(opened);
  if (opened !== seen) {
    setSeen(opened);
    setPicked(null);
  }
  const shown = picked ?? opened - 1;
  const answerOpen = opened > n;

  return (
    <section className={s.help} aria-label="도움" id="help">
      <div className={s.steps} role="group" aria-label="도움 단계">
        {steps.map((label, k) => (
          <button
            key={label}
            type="button"
            className={[s.step, k < opened ? s.stepOpen : '', k === shown ? s.stepOn : ''].filter(Boolean).join(' ')}
            aria-pressed={k === shown}
            disabled={k >= opened}
            onClick={() => setPicked(k)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={s.body} aria-live="polite">
        {opened === 0 && <p className={s.lede}>막히면 힌트를 열어요. 봐도 감점이 없어요.</p>}
        {shown >= 0 && shown < n && (
          <p className={s.hint}>
            <span className={s.hintNo}>힌트 {shown + 1}</span> {data.hints[shown]}
          </p>
        )}
        {shown === n && answerOpen && <Solution data={data} onFill={onFill} />}
      </div>
      {!answerOpen && (
        <div className={s.actions}>
          <Button variant="secondary" onClick={onOpen}>
            {opened === 0 ? '힌트 보기' : opened < n ? '다음 힌트' : '정답 보기'}
          </Button>
        </div>
      )}
    </section>
  );
}

function Solution({ data, onFill }: { data: StageData; onFill: HelpProps['onFill'] }) {
  const v = solutionView(data);
  const has = (o: Record<string, string>) => Object.keys(o).length > 0;
  return (
    <div className={s.solution}>
      {v.blankLines.length > 0 && (
        <pre className={s.code} aria-label="빈칸을 채운 줄">
          {v.blankLines.map((l) => (
            <div key={`${l.file}:${l.no}`} className={s.line}>
              <span className={s.no}>{l.no}</span>
              {l.parts.map((p, i) =>
                p.filled ? (
                  <mark key={i} className={s.filled}>
                    {p.text}
                  </mark>
                ) : (
                  <Fragment key={i}>{p.text}</Fragment>
                ),
              )}
            </div>
          ))}
        </pre>
      )}
      {v.files.map((f) => (
        <div key={f.name}>
          <p className={s.fileName}>{f.name}</p>
          <pre className={s.code} aria-label={`${f.name} 정답. 바뀐 줄 ${f.changed.join(', ')}번`}>
            {f.lines.map((line, k) => (
              <div key={k} className={f.changed.includes(k + 1) ? `${s.line} ${s.changed}` : s.line}>
                <span className={s.no}>{k + 1}</span>
                {line || ' '}
              </div>
            ))}
          </pre>
        </div>
      ))}
      {v.answer !== undefined && (
        <p className={s.answer}>
          답 <code>{v.answer}</code>
        </p>
      )}
      {v.explain && <p className={s.explain}>{v.explain}</p>}
      {/* [정답 보기] 단추가 사라지므로 첫 넣기 단추로 초점을 옮긴다(키보드로 이어서 간다) */}
      <div className={s.actions}>
        {has(v.fillBlanks) && (
          <Button autoFocus onClick={() => onFill(v.fillBlanks)}>
            빈칸에 넣기
          </Button>
        )}
        {has(v.fillFiles) && (
          <Button autoFocus onClick={() => onFill(v.fillFiles)}>
            에디터에 넣기
          </Button>
        )}
        {has(v.fillAnswer) && (
          <Button
            autoFocus={!has(v.fillBlanks) && !has(v.fillFiles)}
            variant={has(v.fillBlanks) || has(v.fillFiles) ? 'secondary' : 'primary'}
            onClick={() => onFill(v.fillAnswer)}
          >
            답 고르기
          </Button>
        )}
      </div>
    </div>
  );
}
