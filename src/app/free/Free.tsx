import { useCallback, useEffect, useMemo, useState } from 'react';
import examplesJson from '../../../content/verilog/examples.json';
import { WasmRunner } from '../../runner/wasmRunner';
import type { RunResult } from '../../runner/types';
import { findTop } from '../../sim/modules';
import type { Timeline } from '../../sim/types';
import { buildTimeline } from '../../sim/vcd';
import { useProgress } from '../../state/progress';
import { Button, Tabs } from '../../ui';
import { CodeEditor } from '../play/CodeEditor';
import { Waveform } from '../play/Waveform';
import { TopBar } from '../TopBar';
import s from './Free.module.css';

// 화면 코드는 Runner와 Timeline만 안다 (14.3)
const runner = new WasmRunner();
const FILES = ['design.sv', 'testbench.sv'] as const;
const DRAFT = 'free';
const key = (name: string) => `file:${name}`;

interface Example {
  id: string;
  title: string;
  files: Record<string, string>;
}
const EXAMPLES = examplesJson.examples as Example[];

/** 예제를 작성 중인 값의 모양으로 */
const fromExample = (ex: Example) => Object.fromEntries(FILES.map((f) => [key(f), ex.files[f] ?? '']));

/** 최상위 모듈의 신호만 선언 순서대로 (VCD의 $var 순서). 없으면 모든 신호 */
function topSignals(tl: Timeline, top: string): Record<string, string> {
  const names = Object.keys(tl.signals);
  const mine = names.filter((n) => n.startsWith(top + '.') && !n.slice(top.length + 1).includes('.'));
  const list = mine.length ? mine : names;
  return Object.fromEntries(list.map((n) => [mine.length ? n.slice(top.length + 1) : n, n]));
}

/**
 * 자유 Verilog(연습장): 채점, 결과 판, 힌트 없이 코드를 돌려 파형과 콘솔을 본다.
 * 에디터 두 탭(design.sv, testbench.sv), 오른쪽 위에 파형, 오른쪽 아래에 콘솔. 재생은 없고 시각선을 끌어서 본다.
 * 쓰던 코드는 자동 저장한다 (순차 재생과 게이트 입구 계획 8.1)
 */
export function Free() {
  const drafts = useProgress((p) => p.drafts);
  const setDraft = useProgress((p) => p.setDraft);
  const saved = drafts[DRAFT];
  // 처음에는 첫 예제로 시작한다
  const values = useMemo(() => saved ?? fromExample(EXAMPLES[0]!), [saved]);
  const [tab, setTab] = useState<string>(FILES[1]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [top, setTop] = useState<string | undefined>();
  const [t, setT] = useState(0);
  const [hover, setHover] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    runner.warmUp();
  }, []);

  const source = FILES.map((f) => values[key(f)] ?? '').join('\n');
  const dumpName = /\$dumpfile\s*\(\s*"([^"]*)"/.exec(source)?.[1];

  const run = useCallback(async () => {
    if (running) return;
    const files = FILES.map((name) => ({ name, text: values[key(name)] ?? '' }));
    const found = findTop(files.map((f) => f.text).join('\n'));
    setTop(found);
    if (!found) {
      setError('module이 없어요. testbench.sv에 module을 적어요.');
      setResult(null);
      setTimeline(null);
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const res = await runner.run({ files, top: found });
      setResult(res);
      setTimeline(res.ok && res.vcd ? buildTimeline(res.vcd, res.log) : null);
      setT(0);
    } catch (e) {
      setError(`엔진을 불러오지 못했어요: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
    }
  }, [running, values]);

  // Ctrl+Enter로 실행
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        void run();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [run]);

  const errorLines = new Set(
    result && !result.ok ? result.diagnostics.filter((d) => d.file.replace(/^\//, '') === tab).map((d) => d.line) : [],
  );
  const bind = timeline && top ? topSignals(timeline, top) : {};
  const stopped = timeline && timeline.end >= 10_000 ? '\n10,000틱에서 멈췄어요. $finish가 있는지 봐요.' : '';
  const consoleText = error
    ? error
    : !result
      ? '실행하면 $monitor와 $display 출력이 여기에 나와요.'
      : result.timedOut
        ? '시간 안에 끝나지 않았어요. $finish가 있는지 봐요.'
        : (result.log || '(출력 없음)') + stopped;
  const waveNote =
    result?.ok && !timeline
      ? dumpName && dumpName !== 'dump.vcd'
        ? '파형 파일 이름은 dump.vcd로 써요. $dumpfile("dump.vcd")'
        : '파형을 읽지 못했어요. $dumpvars가 최상위 모듈을 가리키는지 봐요.'
      : null;

  return (
    <div className={s.page}>
      <TopBar current="free" />
      <main className={s.main}>
        <div className={s.head}>
          <div>
            <h1 className={s.title}>자유 Verilog</h1>
            <p className={s.lede}>채점 없이 코드를 돌려 파형과 출력을 봐요. 쓰던 코드는 이 브라우저에 저장돼요.</p>
          </div>
          <div className={s.tools}>
            <select
              className={s.select}
              aria-label="예제 불러오기"
              value=""
              onChange={(e) => {
                const ex = EXAMPLES.find((x) => x.id === e.target.value);
                if (ex) setDraft(DRAFT, fromExample(ex));
              }}
            >
              <option value="" disabled>
                예제 불러오기
              </option>
              {EXAMPLES.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title}
                </option>
              ))}
            </select>
            <Button onClick={() => void run()} disabled={running}>
              {running ? '실행 중' : '실행'}
            </Button>
          </div>
        </div>

        <div className={s.grid}>
          <section className={s.editorPane} aria-label="에디터">
            <Tabs label="파일" idPrefix="free-file" items={FILES.map((n) => ({ id: n, label: n }))} value={tab} onChange={setTab} />
            <div role="tabpanel" id={`free-file-${tab}`}>
              <CodeEditor
                label={tab}
                value={values[key(tab)] ?? ''}
                errorLines={errorLines}
                onChange={(v) => setDraft(DRAFT, { ...values, [key(tab)]: v })}
              />
            </div>
            <p className={s.kbd}>
              Ctrl+Enter로 실행{top ? ` · 최상위 모듈 ${top}` : ''}
            </p>
          </section>

          <section className={s.wavePane} aria-label="파형">
            {waveNote ? <p className={s.note}>{waveNote}</p> : <Waveform timeline={timeline} bind={bind} t={t} onSeek={setT} highlight={hover} onHover={setHover} />}
            {timeline && <p className={s.time}>t={t}</p>}
          </section>

          <section className={s.consolePane} aria-label="콘솔">
            <pre className={result && !result.ok ? `${s.console} ${s.consoleErr}` : s.console}>
              {consoleText.split('\n').map((line, i) => {
                const m = /^\s*(\d+)\s*:/.exec(line);
                const on = timeline && m && Number(m[1]) <= t && !timeline.log.some((l) => l.t > Number(m[1]) && l.t <= t);
                return (
                  <div key={i} className={on ? s.logOn : undefined}>
                    {line || ' '}
                  </div>
                );
              })}
            </pre>
          </section>
        </div>
      </main>
    </div>
  );
}
