// 스테이지 한 판의 소스 만들기와 채점. 플레이 화면과 CI의 스테이지 검증(engine/golden/stages.mjs)이 같이 쓴다.
// (최종계획서 8.3, 8.5, 9.4) Node의 타입 제거 실행으로도 불리므로 import에 확장자를 붙인다.
import { evalExpr } from './expr.ts';
import { fillTemplate, grade, type Check, type Failure, type Grade } from './grade.ts';
import type { Timeline } from './types.ts';
import { valueAt } from './vcd.ts';

export type StageType = 'fill' | 'predict' | 'fix' | 'convert' | 'design' | 'timing';

interface QuestionBase {
  prompt: string;
  /** true면 답 없이도 실행할 수 있다. 파형을 보고 답을 고른 뒤 다시 실행한다(보스). 기본은 답을 먼저 고른다 (6.2) */
  afterRun?: boolean;
}

/**
 * 문제 칸. 정답을 적어 두지 않고 시뮬레이션 결과와 비교한다(number만 예외). (최종계획서 8.5)
 * - choice: 시각 time에서 signal의 값
 * - number: 타이밍형 숫자 답
 * - dumped: signal이 파형(VCD)에 기록되는가. choices[0]은 "기록된다", choices[1]은 "기록되지 않는다"
 * - expr: 보기마다 불 함수(Verilog 식). 입력이 바뀌기 직전의 output 값과 모두 맞는 식이 정답
 */
export type QuestionSpec =
  | (QuestionBase & { kind: 'choice'; signal: string; time: number; choices: string[] })
  | (QuestionBase & { kind: 'number'; answer: number; unit?: string })
  | (QuestionBase & { kind: 'dumped'; signal: string; choices: string[] })
  | (QuestionBase & { kind: 'expr'; output: string; inputs: string[]; choices: string[] });

/** 장면 형식은 src/world/circuit.ts의 SceneSpec */
export interface StageData<Scene = unknown> {
  id: string;
  type: StageType;
  top: string;
  intro: string;
  draft?: string;
  /** 보이는 파일. fill은 {{b1}} 빈칸 템플릿, fix·convert·design은 고칠 수 있는 시작 코드 */
  files: Record<string, { template: string; lockOutsideBlanks?: boolean }>;
  /** 보이지 않는 파일(설계형의 채점용 테스트벤치) */
  hidden?: Record<string, string>;
  blanks?: Record<string, { label: string; chars?: number }>;
  question?: QuestionSpec;
  hints: string[];
  scene: Scene;
  bind: Record<string, string>;
  check: Check[];
  /** CI가 확인하는 정답 예시. 빈칸 값, 'file:이름' 파일 내용, 'answer' 답. 도움 칸의 정답 보기에도 쓴다 */
  solution?: Record<string, string>;
  /** 정답 보기의 해설(선택, 한두 문장). 문구는 주찬이 정한다(최종계획서 14.4) */
  explain?: string;
}

export const editable = (t: StageType) => t === 'fix' || t === 'convert' || t === 'design';
export const ANSWER = 'answer';
export const fileKey = (name: string) => `file:${name}`;

/** 사용자가 보는 파일의 지금 내용 */
export function visibleSource(data: StageData, name: string, values: Record<string, string>): string {
  const f = data.files[name];
  if (!f) return '';
  if (data.type === 'fill') return fillTemplate(f.template, values);
  if (editable(data.type)) return values[fileKey(name)] ?? f.template;
  return f.template;
}

/** 엔진에 넘길 파일: 보이는 파일 + 숨은 파일 */
export function stageSources(data: StageData, values: Record<string, string>): { name: string; text: string }[] {
  const out = Object.keys(data.files).map((name) => ({ name, text: visibleSource(data, name, values) }));
  for (const [name, text] of Object.entries(data.hidden ?? {})) out.push({ name, text });
  return out;
}

export function gradeStage(data: StageData, values: Record<string, string>, tl: Timeline): Grade {
  const visible = Object.keys(data.files).map((n) => visibleSource(data, n, values));
  const g = grade(tl, data.check, data.bind, visible);
  const q = data.question;
  if (q) {
    const f = judge(q, (values[ANSWER] ?? '').trim(), tl, data.bind);
    g.answer = !f;
    // 예측·타이밍형은 답이 먼저, 빈칸과 함께 쓰는 스테이지(1-4, 보스)는 코드의 실패가 먼저다
    if (f) {
      if (data.type === 'predict' || data.type === 'timing') g.failures.unshift(f);
      else g.failures.push(f);
    }
    g.pass = g.failures.length === 0;
  }
  return g;
}

/** 문제 칸의 답을 시뮬레이션 결과로 확인한다. 맞으면 undefined */
export function judge(q: QuestionSpec, a: string, tl: Timeline, bind: Record<string, string>): Failure | undefined {
  if (a === '') {
    return {
      message: q.afterRun
        ? '파형을 보고 답을 고른 뒤 다시 실행해요'
        : q.kind === 'number'
          ? '먼저 숫자를 적어요'
          : '먼저 답을 골라요',
    };
  }
  if (q.kind === 'choice') {
    const truth = valueAt(tl.signals[bind[q.signal] ?? q.signal], q.time);
    if (a !== truth) return { message: `t=${q.time}에서 ${q.signal}는 ${truth}이에요. 재생해서 확인해 봐요`, time: q.time };
    return undefined;
  }
  if (q.kind === 'number') {
    if (Number(a) !== q.answer) return { message: '숫자가 달라요. 가장 늦게(또는 가장 먼저) 도착하는 길을 따라 지연을 더해 봐요' };
    return undefined;
  }
  if (q.kind === 'dumped') {
    const recorded = tl.signals[bind[q.signal] ?? q.signal] !== undefined;
    const truth = recorded ? q.choices[0] : q.choices[1];
    if (a !== truth) return { message: `${q.signal}는 파형에 ${recorded ? '기록됐어요' : '기록되지 않았어요'}. $dumpvars를 다시 봐요` };
    return undefined;
  }
  return judgeExpr(q, a, tl, bind);
}

/**
 * 고른 식을 파형과 맞춰 본다. 입력이 바뀌는 구간마다 다음 변화 직전(마지막 구간은 끝 시각)의 값을 쓴다.
 * 그래야 게이트 지연이 있어도 자리 잡은 값으로 비교한다.
 */
function judgeExpr(q: Extract<QuestionSpec, { kind: 'expr' }>, a: string, tl: Timeline, bind: Record<string, string>): Failure | undefined {
  const track = (name: string) => tl.signals[bind[name] ?? name];
  const out = track(q.output);
  if (!out) return { message: `${q.output} 신호를 찾지 못했어요` };
  const starts = [...new Set(q.inputs.flatMap((n) => track(n)?.changes.map(([ct]) => ct) ?? []))]
    .filter((x) => x < tl.end)
    .sort((x, y) => x - y);
  for (let k = 0; k < starts.length; k++) {
    const at = k + 1 < starts.length ? starts[k + 1]! - 1 : tl.end;
    const env: Record<string, string> = {};
    for (const n of q.inputs) env[n] = valueAt(track(n), at);
    const want = valueAt(out, at);
    let got: string;
    try {
      got = evalExpr(a, env);
    } catch (e) {
      return { message: e instanceof Error ? e.message : String(e) };
    }
    if (got !== want) {
      const ins = q.inputs.map((n) => env[n]).join('');
      return { message: `t=${at}에서 ${q.inputs.join('')}=${ins}일 때 ${q.output}는 ${want}인데, 이 식으로는 ${got}이에요`, time: at };
    }
  }
  return undefined;
}

/** 정답 보기에서 보여 줄 것 (순차 재생과 게이트 입구 계획 7장, 도움 칸) */
export interface SolutionView {
  /** 빈칸형: 빈칸이 있는 줄을 정답으로 채운 것. filled는 채운 곳 */
  blankLines: { file: string; no: number; parts: { text: string; filled: boolean }[] }[];
  /** 고치는 유형(버그 수정, 변환, 설계): 정답 파일 전체와 시작 코드와 다른 줄(1부터) */
  files: { name: string; lines: string[]; changed: number[] }[];
  /** 답(예측, 타이밍, 보스) */
  answer?: string;
  explain?: string;
  /** 넣기 단추가 채울 값: 빈칸에 넣기, 에디터에 넣기, 답 고르기 */
  fillBlanks: Record<string, string>;
  fillFiles: Record<string, string>;
  fillAnswer: Record<string, string>;
}

/** 줄 단위 비교: b의 줄 가운데 a와의 가장 긴 공통 부분에 들지 않는 줄 번호(1부터) */
export function changedLines(a: string[], b: string[]): number[] {
  const n = a.length;
  const m = b.length;
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) L[i]![j] = a[i] === b[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  const keep = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      keep.add(j);
      i++;
      j++;
    } else if (L[i + 1]![j]! >= L[i]![j + 1]!) i++;
    else j++;
  }
  const out: number[] = [];
  for (let k = 0; k < m; k++) if (!keep.has(k)) out.push(k + 1);
  return out;
}

const lines = (text: string) => text.replace(/\n$/, '').split('\n');

/** 스테이지 JSON의 solution에서 정답 보기를 만든다 */
export function solutionView(data: StageData): SolutionView {
  const sol = data.solution ?? {};
  const view: SolutionView = { blankLines: [], files: [], fillBlanks: {}, fillFiles: {}, fillAnswer: {} };
  if (data.type === 'fill') {
    for (const [name, f] of Object.entries(data.files)) {
      lines(f.template).forEach((line, k) => {
        const pieces = line.split(/(\{\{\w+\}\})/);
        if (pieces.length === 1) return;
        view.blankLines.push({
          file: name,
          no: k + 1,
          parts: pieces
            .filter((x) => x !== '')
            .map((x) => {
              const m = /^\{\{(\w+)\}\}$/.exec(x);
              return m ? { text: sol[m[1]!] ?? '', filled: true } : { text: x, filled: false };
            }),
        });
      });
    }
    for (const id of Object.keys(data.blanks ?? {})) if (sol[id] !== undefined) view.fillBlanks[id] = sol[id]!;
  }
  if (editable(data.type)) {
    for (const [name, f] of Object.entries(data.files)) {
      const text = sol[fileKey(name)];
      if (text === undefined) continue;
      view.files.push({ name, lines: lines(text), changed: changedLines(lines(f.template), lines(text)) });
      view.fillFiles[fileKey(name)] = text;
    }
  }
  if (data.question && sol[ANSWER] !== undefined) {
    view.answer = sol[ANSWER];
    view.fillAnswer[ANSWER] = sol[ANSWER]!;
  }
  if (data.explain) view.explain = data.explain;
  return view;
}
