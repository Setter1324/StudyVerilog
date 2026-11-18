import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { WasmRunner } from '../../runner/wasmRunner';
import type { RunResult } from '../../runner/types';
import { delaysBySignal, passingAt, type Passing } from '../../sim/delays';
import type { Grade } from '../../sim/grade';
import { ANSWER, editable, fileKey, gradeStage, stageSources, visibleSource } from '../../sim/stage';
import type { Timeline } from '../../sim/types';
import { buildTimeline, valueAt } from '../../sim/vcd';
import { STAGES, stageById, stageData, stagesOf, TYPE_NAMES, zoneById, type StageData } from '../../state/content';
import { useProgress } from '../../state/progress';
import { Button, Chip, CodeBlank, IconButton, LockedLine, Sheet, StageStones, SunTrack, Tabs, ZonePin } from '../../ui';
import { sfx } from '../../audio/sfx';
import { BEAT_TICKS, beatAt, tickAt, type PlayBase } from '../../world/beat';
import { buildCircuit, circuitWalkers, isLabel, passingText } from '../../world/circuit';
import { Walkers } from '../../world/Walkers';
import { IsoSvg } from '../../world/IsoSvg';
import { TopBar } from '../TopBar';
import s from './Play.module.css';
import { CodeEditor } from './CodeEditor';
import { Help } from './Help';
import { Question } from './Question';
import { Waveform } from './Waveform';

// 화면 코드는 Runner와 Timeline만 안다 (14.3)
const runner = new WasmRunner();
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

function World({
  data,
  timeline,
  t,
  highlight,
  passing,
  clock,
}: {
  data: StageData;
  timeline: Timeline | null;
  t: number;
  highlight?: string;
  passing: Record<string, Passing>;
  clock: (now: number) => number | null;
}) {
  const values: Record<string, string> = {};
  for (const [short, full] of Object.entries(data.bind)) {
    values[short] = timeline ? valueAt(timeline.signals[full], t) : 'x';
  }
  const scene = buildCircuit(data.scene, values, highlight, passing);
  const walkers = circuitWalkers(data.scene, values);
  const dusk = timeline !== null && t >= timeline.end;
  const busy = passingText(data.scene, passing);
  // 이름표는 알파카 위 층에 그린다. 길 가운데에 선 알파카가 이름표와 지연 칸을 가리지 않는다
  const ground = { ...scene, prims: scene.prims.filter((p) => !isLabel(p)) };
  const labels = scene.prims.filter(isLabel);
  return (
    <div className={dusk ? `${s.world} ${s.dusk}` : s.world}>
      <IsoSvg
        scene={ground}
        top={labels}
        className={s.worldSvg}
        title={`t=${t}의 마을. ${Object.entries(values)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')}${busy.length ? `. ${busy.join(', ')}` : ''}`}
      >
        <Walkers paths={walkers} clock={clock} />
      </IsoSvg>
    </div>
  );
}

export function Play({ id }: { id: string }) {
  const meta = stageById(id);
  const data = stageData(id);
  const open = useProgress((p) => p.open);
  const pass = useProgress((p) => p.pass);
  const peek = useProgress((p) => p.peek);
  const peeked = useProgress((p) => p.peeked);
  const done = useProgress((p) => p.done);
  const drafts = useProgress((p) => p.drafts);
  const setDraft = useProgress((p) => p.setDraft);
  const sound = useProgress((p) => p.sound);
  const setSound = useProgress((p) => p.setSound);

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
  /** 실행한 코드의 지연(#N), 출력 신호 이름 → 틱 수. 건물에서 지연을 셀 때 쓴다 (걷기 박자 계획 5.3) */
  const [delays, setDelays] = useState<Record<string, number>>({});
  /** 실행 횟수. 틀릴 때마다 징검다리의 지금 칸을 다시 흔든다 (걷기 박자와 상단 바 계획 6.3) */
  const [runs, setRuns] = useState(0);
  /** 이번 실행으로 처음 통과했는지. 징검다리 칸은 해가 진 뒤에 채운다 */
  const [freshPass, setFreshPass] = useState(false);

  useEffect(() => {
    if (meta) open(meta.id);
    runner.warmUp();
  }, [meta, open]);

  // 재생: 틱은 언제나 240ms(속도로 나눈다)라서 코드에 쓴 시간이 화면에서 비례한다. 끝 시각에 해가 지고 결과 판이 뜬다 (6.2)
  const end = timeline?.end ?? 0;
  const isPlaying = playing && timeline !== null && t < end;
  /** 값이 바뀌는 시각들 (이전·다음 변화로 건너뛰기, 효과음) */
  const events = useMemo(() => {
    if (!timeline || !data) return [] as number[];
    const set = new Set<number>([0, timeline.end]);
    for (const full of Object.values(data.bind)) for (const [ct] of timeline.signals[full]?.changes ?? []) set.add(ct);
    return [...set].filter((x) => x <= timeline.end).sort((a, b) => a - b);
  }, [timeline, data]);
  /** 시각 at에 바뀐 값에 맞는 소리 */
  const cue = useCallback(
    (at: number) => {
    if (!timeline || !data) return;
    if (at >= timeline.end) {
      if (verdict?.pass) sfx.pass();
      else sfx.fail();
      return;
    }
    let up = false;
    let fog = false;
    for (const full of Object.values(data.bind)) {
      const ch = timeline.signals[full]?.changes.find(([ct]) => ct === at);
      if (!ch) continue;
      if (ch[1].includes('x')) fog = true;
      if (ch[1].includes('1')) up = true;
    }
    if (fog) sfx.fog();
    else sfx.step(up);
    },
    [timeline, data, verdict],
  );
  /** 건물마다 지금 출력을 바꾸는 중인지: 코드의 지연(#N)과 타임라인의 변화로 센다. 표시용이다 (걷기 박자 계획 5.3) */
  const passing = useMemo(() => {
    const out: Record<string, Passing> = {};
    if (!timeline || !data) return out;
    for (const g of data.scene.gates) {
      if (!g.out) continue;
      const full = data.bind[g.out];
      const p = passingAt(full ? timeline.signals[full]?.changes : undefined, delays[g.out] ?? 0, t);
      if (p) out[g.id] = p;
    }
    return out;
  }, [timeline, data, delays, t]);

  // 재생 시계: 기준점(재생을 시작하거나 속도를 바꾼 순간의 틱과 시각)에서 지금 틱을 계산한다.
  // 틱마다 타이머를 다시 걸지 않으니 늦어진 시간이 쌓이지 않는다. 정수 틱이 바뀔 때만 setT를 부른다.
  // 월드의 걷기도 같은 기준점에서 박자 위치를 얻는다. 시계는 하나다 (걷기 박자 계획 5.1, 5.2)
  const base = useRef<PlayBase | null>(null);
  const tRef = useRef(t);
  const realTick = useRef(0);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  useEffect(() => {
    if (!isPlaying) return;
    // 속도만 바꿨으면 지금 자리(소수 틱)에서 이어 가고, 건너뛰었으면 그 틱에서 시작한다
    const start = Math.floor(realTick.current) === tRef.current ? realTick.current : tRef.current;
    base.current = { tick: start, at: performance.now(), speed };
    let raf = 0;
    const frame = (now: number) => {
      const b = base.current;
      if (!b) return;
      const real = Math.min(end, tickAt(b, now));
      realTick.current = real;
      const whole = Math.floor(real);
      const prev = tRef.current;
      if (whole !== prev) {
        // 한 프레임에 여러 틱을 건너뛰었으면 효과음은 마지막 변화 하나만 낸다
        const crossed = events.filter((x) => x > prev && x <= whole);
        const last = crossed[crossed.length - 1];
        if (whole >= end) cue(end);
        else if (last !== undefined) cue(last);
        tRef.current = whole;
        setT(whole);
      }
      if (whole < end) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      base.current = null;
    };
  }, [isPlaying, speed, end, events, cue]);
  // 탭이 가려지면 재생을 멈춘다
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  /** 월드의 박자 시계: 재생 중이면 박자 위치, 아니면 null(길 가운데에 선다) */
  const beatTicks = data?.scene.beatTicks ?? BEAT_TICKS;
  const walkClock = useCallback(
    (now: number) => {
      const b = base.current;
      return b ? beatAt(Math.min(end, tickAt(b, now)), beatTicks) : null;
    },
    [end, beatTicks],
  );
  const jump = (to: number) => {
    setPlaying(false);
    setT(Math.max(0, Math.min(end, to)));
    if (to >= end) cue(end);
  };
  const prevEvent = () => jump([...events].reverse().find((x) => x < t) ?? 0);
  const nextEvent = () => jump(events.find((x) => x > t) ?? end);
  const sheet = verdict !== null && timeline !== null && t >= end && !dismissed;

  const run = useCallback(async () => {
    if (!data || running) return;
    // 예측·타이밍형은 답을 먼저 고른다(6.2). afterRun 문제(보스)는 실행해서 파형을 본 뒤에 고른다
    if (data.question && !data.question.afterRun && !(values[ANSWER] ?? '').trim()) {
      setError(data.question.kind === 'number' ? '먼저 숫자를 적어요.' : '먼저 답을 골라요. 고른 뒤에 재생해서 확인해요.');
      return;
    }
    setRunning(true);
    setRuns((n) => n + 1);
    sfx.run();
    setError(null);
    setPlaying(false);
    setDismissed(true);
    try {
      const files = stageSources(data, values);
      const res = await runner.run({ files, top: data.top });
      setResult(res);
      setDelays(delaysBySignal(files.map((f) => f.text).join('\n')));
      if (!res.ok || !res.vcd) {
        setTimeline(null);
        setVerdict(null);
        setT(0);
        sfx.error();
        return;
      }
      const tl = buildTimeline(res.vcd, res.log);
      const g = gradeStage(data, values, tl);
      setTimeline(tl);
      setVerdict(g);
      setFreshPass(g.pass && !!meta && !done[meta.id]);
      if (g.pass && meta) pass(meta.id);
      setDismissed(false);
      if (res.timedOut) {
        // 해가 지지 않은 코드는 상한(10,000틱)까지 재생하지 않고 바로 결과를 보여 준다 (6.3)
        setT(tl.end);
        setPlaying(false);
        sfx.fail();
      } else {
        setT(0);
        setPlaying(true);
      }
    } catch (e) {
      setError(`엔진을 불러오지 못했어요: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
    }
  }, [data, running, values, meta, pass, done]);

  /** 도움 칸의 다음 단계를 연다. 정답까지 열면 정답을 본 스테이지로 적는다 */
  const openHelp = () => {
    if (!data || !meta) return;
    const next = Math.min(hints + 1, data.hints.length + 1);
    setHints(next);
    if (next > data.hints.length) peek(meta.id);
  };

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
    ? error
    : result
      ? result.timedOut
        ? `${result.log}\n해가 지지 않아요. $finish가 있는지 봐요.`
        : result.log || '(출력 없음)'
      : '실행하면 $monitor와 $display 출력이 여기에 나와요.';
  const failure = verdict?.failures[0];
  const ended = timeline !== null && t >= end;
  const dusk = ended;
  // 이번 실행으로 처음 통과했으면 해가 질 때까지 지금 칸을 채우지 않는다
  const stoneDone: Record<string, boolean | undefined> = freshPass && !ended ? { ...done, [meta.id]: false } : done;

  return (
    <div className={s.page}>
      <header className={dusk ? `${s.bar} ${s.barDusk}` : s.bar}>
        <a href="#/stages" className={s.back} aria-label="스테이지 목록으로">
          ‹
        </a>
        <ZonePin zone={zone.id} size="sm" />
        <div className={s.titleBox}>
          <span className={s.crumb}>
            {zone.name} · {meta.no}
            <span className={s.count}>
              {' '}
              · {index} / {zoneStages.length}
            </span>
            {done[meta.id] ? ' · 통과' : ''}
            {meta.types.map((x) => (
              <span key={x} className={s.typeTag}>
                {TYPE_NAMES[x] ?? x}
              </span>
            ))}
          </span>
          <h1 className={s.title}>{meta.title}</h1>
        </div>
        {/* 징검다리: 이 구역의 스테이지. 좁은 화면에서는 숨기고 윗줄에 4 / 15를 되돌린다 (6.2, 6.4) */}
        <div className={s.stones}>
          <StageStones
            stages={zoneStages}
            current={meta.id}
            done={stoneDone}
            zone={zone.id}
            peeked={peeked}
            hop={ended && verdict?.pass}
            shake={ended && verdict && !verdict.pass ? runs : 0}
          />
        </div>
        <div className={s.barTools}>
          <IconButton label={sound ? '소리 끄기' : '소리 켜기'} pressed={sound} onClick={() => setSound(!sound)}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3 8h3l4-3v10l-4-3H3Z" fill="currentColor" />
              {sound ? (
                <path d="M13 7a4 4 0 0 1 0 6M15 5a7 7 0 0 1 0 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              ) : (
                <path d="m13 8 4 4m0-4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              )}
            </svg>
          </IconButton>
          <IconButton
            label="힌트"
            pressed={hints > 0}
            onClick={() => {
              // 도움 칸으로 가서 다음 힌트를 연다. 좁은 화면에서는 에디터가 월드 아래에 있다 (게이트 입구 계획 7장)
              if (hints < data.hints.length) openHelp();
              const help = document.getElementById('help');
              help?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              help?.querySelector<HTMLButtonElement>('button[aria-pressed="true"], button')?.focus({ preventScroll: true });
            }}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="10" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 15h4M8.5 17.5h3" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </IconButton>
          <Button onClick={() => void run()} disabled={running} className={s.run}>
            {running ? '실행 중' : '실행'}
          </Button>
        </div>
        {/* 해의 길: 바의 아래 선. 왼쪽 끝이 t=0, 오른쪽 끝이 $finish (6.2, 6.3) */}
        <div className={s.sunLine}>
          <SunTrack
            state={running ? 'loading' : !timeline ? 'idle' : ended ? 'dusk' : 'time'}
            value={running ? undefined : end > 0 ? t / end : 0}
            passed={verdict?.pass}
          />
        </div>
      </header>

      <main className={s.grid}>
        <section className={s.worldPane} aria-label="월드">
          <World data={data} timeline={timeline} t={t} highlight={hover} passing={passing} clock={walkClock} />
          <div className={s.transport}>
            <div className={s.tbtns}>
              <button type="button" className={s.tbtn} onClick={() => jump(0)} disabled={!timeline} aria-label="처음으로" title="처음으로">
                ⏮
              </button>
              <button type="button" className={s.tbtn} onClick={prevEvent} disabled={!timeline} aria-label="이전 변화로" title="이전 변화로">
                ◀
              </button>
              <button
                type="button"
                className={`${s.tbtn} ${s.tplay}`}
                onClick={() => {
                  if (timeline && t >= timeline.end) setT(0);
                  setPlaying(!isPlaying);
                }}
                disabled={!timeline}
                aria-label={isPlaying ? '정지' : '재생'}
              >
                {isPlaying ? '❚❚' : '▶'}
              </button>
              <button type="button" className={s.tbtn} onClick={nextEvent} disabled={!timeline} aria-label="다음 변화로" title="다음 변화로">
                ▶|
              </button>
              <button type="button" className={s.tbtn} onClick={() => jump(end)} disabled={!timeline} aria-label="끝으로" title="끝으로(결과 보기)">
                ⏭
              </button>
            </div>
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
          <Help data={data} opened={hints} onOpen={openHelp} onFill={(v) => setDraft(id, { ...values, ...v })} />
          {fileNames.length > 1 && (
            <Tabs label="파일" idPrefix="file" items={fileNames.map((n) => ({ id: n, label: n }))} value={tab} onChange={setTab} />
          )}
          {fileNames.length === 1 && <div className={s.fileName}>{fileNames[0]}</div>}
          <div role={fileNames.length > 1 ? 'tabpanel' : undefined} id={`file-${tab}`}>
            {data.type === 'fill' ? (
              <FillEditor
                template={data.files[tab]?.template ?? ''}
                values={values}
                onChange={(bid, v) => setDraft(id, { ...values, [bid]: v })}
                wrong={verdict ? !verdict.pass : false}
                errorLines={errorLines}
                labels={Object.fromEntries(Object.entries(data.blanks ?? {}).map(([k, b]) => [k, b.label]))}
              />
            ) : (
              <CodeEditor
                label={tab}
                value={visibleSource(data, tab, values)}
                readOnly={!editable(data.type)}
                errorLines={errorLines}
                onChange={(v) => setDraft(id, { ...values, [fileKey(tab)]: v })}
              />
            )}
          </div>
          {data.question && (
            <Question
              q={data.question}
              value={values[ANSWER] ?? ''}
              onChange={(v) => setDraft(id, { ...values, [ANSWER]: v })}
              result={verdict && timeline && t >= timeline.end ? verdict.answer : undefined}
            />
          )}
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

      {/* 좁은 화면: 실행 버튼을 화면 아래에 붙인다 (6.1) */}
      <div className={s.dock}>
        <Button block onClick={() => void run()} disabled={running}>
          {running ? '실행 중' : '실행'}
        </Button>
      </div>

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
