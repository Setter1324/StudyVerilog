import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { WasmRunner } from '../../runner/wasmRunner';
import type { RunResult } from '../../runner/types';
import { fillTemplate, grade, type Grade } from '../../sim/grade';
import type { Timeline } from '../../sim/types';
import { buildTimeline, valueAt } from '../../sim/vcd';
import { STAGES, stageById, stageData, stagesOf, TYPE_NAMES, zoneById, type StageData } from '../../state/content';
import { useProgress } from '../../state/progress';
import { Button, Chip, CodeBlank, IconButton, LockedLine, Sheet, Tabs, ZonePin } from '../../ui';
import { buildCircuit } from '../../world/circuit';
import { IsoSvg } from '../../world/IsoSvg';
import { TopBar } from '../TopBar';
import s from './Play.module.css';
import { Waveform } from './Waveform';

// 화면 코드는 Runner와 Timeline만 안다 (14.3)
const runner = new WasmRunner();
const TICK_MS = 600; // 시뮬레이션 1틱 (7.8)
const SPEEDS = [0.5, 1, 2] as const;

function go(hash: string) {
  window.location.hash = hash;
}

/** 빈칸이 있는 줄은 입력 칸으로, 없는 줄은 잠금 줄로 그린다 (6.3) */
function FillEditor({
  template,
  values,
  onChange,
  wrong,
  errorLines,
  labels,
}: {
  labels: Record<string, string>;
  template: string;
  values: Record<string, string>;
  onChange: (id: string, v: string) => void;
  wrong: boolean;
  errorLines: Set<number>;
}) {
  const lines = template.replace(/\n$/, '').split('\n');
  return (
    <div className={s.editor}>
      {lines.map((line, k) => {
        const no = k + 1;
        const parts = line.split(/(\{\{\w+\}\})/);
        if (parts.length === 1) {
          return (
            <div key={k} className={errorLines.has(no) ? s.errLine : undefined}>
              <LockedLine line={no}>{line || ' '}</LockedLine>
            </div>
          );
        }
        return (
          <div key={k} className={`${s.line} ${errorLines.has(no) ? s.errLine : ''}`}>
            <span className={s.no}>{no}</span>
            <code className={s.code}>
              {parts.map((p, i) => {
                const m = /^\{\{(\w+)\}\}$/.exec(p);
                if (!m) return <Fragment key={i}>{p}</Fragment>;
                const id = m[1]!;
                return (
                  <CodeBlank
                    key={i}
                    label={labels[id] ?? id}
                    placeholder="?"
                    value={values[id] ?? ''}
                    wrong={wrong && (values[id] ?? '') !== ''}
                    onChange={(e) => onChange(id, e.target.value)}
                  />
                );
              })}
            </code>
          </div>
        );
      })}
    </div>
  );
}

function World({ data, timeline, t, highlight }: { data: StageData; timeline: Timeline | null; t: number; highlight?: string }) {
  const values: Record<string, string> = {};
  for (const [short, full] of Object.entries(data.bind)) {
    values[short] = timeline ? valueAt(timeline.signals[full], t) : 'x';
  }
  const scene = buildCircuit(data.scene, values, highlight);
  const dusk = timeline !== null && t >= timeline.end;
  return (
    <div className={dusk ? `${s.world} ${s.dusk}` : s.world}>
      <IsoSvg
        scene={scene}
        className={s.worldSvg}
        title={`t=${t}의 마을. ${Object.entries(values)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')}`}
      />
    </div>
  );
}

export function Play({ id }: { id: string }) {
  const meta = stageById(id);
  const data = stageData(id);
  const open = useProgress((p) => p.open);
  const pass = useProgress((p) => p.pass);
  const done = useProgress((p) => p.done);
  const drafts = useProgress((p) => p.drafts);
  const setDraft = useProgress((p) => p.setDraft);

  const fileNames = data ? Object.keys(data.files) : [];
  const [tab, setTab] = useState(fileNames[0] ?? '');
  const values = useMemo(() => drafts[id] ?? {}, [drafts, id]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [verdict, setVerdict] = useState<Grade | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [hints, setHints] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [hover, setHover] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (meta) open(meta.id);
    runner.warmUp();
  }, [meta, open]);

  // 재생: 1틱 600ms. 끝 시각에 해가 지고 결과 판이 뜬다 (6.2)
  const end = timeline?.end ?? 0;
  const isPlaying = playing && timeline !== null && t < end;
  useEffect(() => {
    if (!isPlaying) return;
    const h = setTimeout(() => setT((cur) => Math.min(cur + 1, end)), TICK_MS / speed);
    return () => clearTimeout(h);
  }, [isPlaying, t, end, speed]);
  const sheet = verdict !== null && timeline !== null && t >= end && !dismissed;

  const run = useCallback(async () => {
    if (!data || running) return;
    setRunning(true);
    setError(null);
    setPlaying(false);
    setDismissed(true);
    try {
      const files = Object.entries(data.files).map(([name, f]) => ({ name, text: fillTemplate(f.template, values) }));
      const res = await runner.run({ files, top: data.top });
      setResult(res);
      if (!res.ok || !res.vcd) {
        setTimeline(null);
        setVerdict(null);
        return;
      }
      const tl = buildTimeline(res.vcd, res.log);
      const g = grade(tl, data.check, data.bind);
      setTimeline(tl);
      setVerdict(g);
      if (g.pass && meta) pass(meta.id);
      setT(0);
      setDismissed(false);
      setPlaying(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [data, running, values, meta, pass]);

  // Ctrl+Enter로 실행 (3장 원칙 8)
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

  if (!meta) {
    return (
      <>
        <TopBar current="play" />
        <main className={s.missing}>
          <h1>찾을 수 없는 스테이지예요</h1>
          <a href="#/stages">스테이지 목록으로</a>
        </main>
      </>
    );
  }

  const zone = zoneById(meta.zone)!;
  const zoneStages = stagesOf(meta.zone);
  const index = zoneStages.findIndex((st) => st.id === meta.id) + 1;
  const next = STAGES[STAGES.findIndex((st) => st.id === meta.id) + 1];

  if (!data) {
    return (
      <>
        <TopBar current="play" />
        <main className={s.missing}>
          <p className={s.crumb}>
            구역 {zone.id} {zone.name} · {meta.no}
          </p>
          <h1>{meta.title}</h1>
          <p>이 스테이지는 준비 중이에요. 지금은 1-1을 풀 수 있어요.</p>
          <div className={s.missingActions}>
            <Button onClick={() => go('#/play/v1-01')}>1-1 풀기</Button>
            <Button variant="secondary" onClick={() => go('#/stages')}>
              스테이지 목록
            </Button>
          </div>
        </main>
      </>
    );
  }

  const errorLines = new Set(result && !result.ok ? result.diagnostics.map((d) => d.line) : []);
  const consoleText = error
    ? `엔진을 불러오지 못했어요: ${error}`
    : result
      ? result.timedOut
        ? `${result.log}\n해가 지지 않아요. $finish가 있는지 봐요.`
        : result.log || '(출력 없음)'
      : '실행하면 $monitor와 $display 출력이 여기에 나와요.';
  const failure = verdict?.failures[0];

  return (
    <div className={s.page}>
      <header className={s.bar}>
        <a href="#/stages" className={s.back} aria-label="스테이지 목록으로">
          ‹
        </a>
        <ZonePin zone={zone.id} size="sm" />
        <div className={s.titleBox}>
          <span className={s.crumb}>
            {zone.name} · {meta.no} · {index} / {zoneStages.length}
            {done[meta.id] ? ' · 통과' : ''}
          </span>
          <h1 className={s.title}>{meta.title}</h1>
        </div>
        <div className={s.barTools}>
          <IconButton label="힌트" pressed={hints > 0} onClick={() => setHints((h) => (h >= data.hints.length ? 0 : h + 1))}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 15h4M8.5 17.5h3" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </IconButton>
          <Button onClick={() => void run()} disabled={running} className={s.run}>
            {running ? '실행 중' : '실행'}
          </Button>
        </div>
      </header>

      <main className={s.grid}>
        <section className={s.worldPane} aria-label="월드">
          <World data={data} timeline={timeline} t={t} highlight={hover} />
          <div className={s.transport}>
            <button
              type="button"
              className={s.tbtn}
              onClick={() => {
                if (timeline && t >= timeline.end) setT(0);
                setPlaying(!isPlaying);
              }}
              disabled={!timeline}
              aria-label={isPlaying ? '정지' : '재생'}
            >
              {isPlaying ? '❚❚' : '▶'}
            </button>
            <input
              type="range"
              className={s.slider}
              min={0}
              max={timeline?.end ?? 0}
              value={t}
              disabled={!timeline}
              onChange={(e) => {
                setPlaying(false);
                setT(Number(e.target.value));
              }}
              aria-label="시간"
            />
            <span className={s.time}>t={t}</span>
            <div className={s.speeds} role="group" aria-label="속도">
              {SPEEDS.map((v) => (
                <button key={v} type="button" className={v === speed ? s.speedOn : s.speed} aria-pressed={v === speed} onClick={() => setSpeed(v)}>
                  {v}×
                </button>
              ))}
            </div>
            {timeline && t < timeline.end && (
              <button type="button" className={s.skip} onClick={() => setT(timeline.end)}>
                끝으로
              </button>
            )}
          </div>
        </section>

        <section className={s.editorPane} aria-label="에디터">
          <details className={s.intro} open>
            <summary>
              문제 <Chip>{meta.types.map((x) => TYPE_NAMES[x] ?? x).join(' · ')}</Chip>
            </summary>
            <p>{data.intro}</p>
            {data.draft && <p className={s.draft}>초안: {data.draft}</p>}
          </details>
          {hints > 0 && (
            <ol className={s.hints} aria-live="polite">
              {data.hints.slice(0, hints).map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ol>
          )}
          {fileNames.length > 1 && (
            <Tabs label="파일" idPrefix="file" items={fileNames.map((n) => ({ id: n, label: n }))} value={tab} onChange={setTab} />
          )}
          {fileNames.length === 1 && <div className={s.fileName}>{fileNames[0]}</div>}
          <div role={fileNames.length > 1 ? 'tabpanel' : undefined} id={`file-${tab}`}>
            <FillEditor
              template={data.files[tab]?.template ?? ''}
              values={values}
              onChange={(bid, v) => setDraft(id, { ...values, [bid]: v })}
              wrong={verdict ? !verdict.pass : false}
              errorLines={errorLines}
              labels={Object.fromEntries(Object.entries(data.blanks).map(([k, b]) => [k, b.label]))}
            />
          </div>
          <div className={s.editorActions}>
            <Button variant="secondary" onClick={() => setDraft(id, {})}>
              처음 코드로
            </Button>
            <span className={s.kbd}>Ctrl+Enter로 실행</span>
          </div>
        </section>

        <section className={s.wavePane} aria-label="파형">
          <Waveform timeline={timeline} bind={data.bind} t={t} onSeek={(x) => {
              setPlaying(false);
              setT(x);
            }} highlight={hover} onHover={setHover} />
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
      </main>

      <Sheet
        open={sheet}
        title={verdict?.pass ? '맞았어요' : '아직이에요'}
        onClose={() => setDismissed(true)}
        actions={
          verdict?.pass ? (
            <>
              <Button variant="secondary" onClick={() => setDismissed(true)}>
                다시 보기
              </Button>
              {next && <Button onClick={() => go(`#/play/${next.id}`)}>다음 스테이지</Button>}
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setDismissed(true)}>
                고치러 가기
              </Button>
              {failure?.time !== undefined && (
                <Button
                  onClick={() => {
                    setDismissed(true);
                    setPlaying(false);
                    setT(failure.time!);
                  }}
                >
                  그 시각으로 가기
                </Button>
              )}
            </>
          )
        }
      >
        <p>{verdict?.pass ? '해가 졌어요. 모든 시각에서 값이 맞아요.' : failure?.message}</p>
      </Sheet>
    </div>
  );
}
