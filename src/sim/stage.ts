// 스테이지 한 판의 소스 만들기와 채점. 플레이 화면과 CI의 스테이지 검증(engine/golden/stages.mjs)이 같이 쓴다.
// (최종계획서 8.3, 8.5, 9.4) Node의 타입 제거 실행으로도 불리므로 import에 확장자를 붙인다.
import { fillTemplate, grade, type Check, type Grade } from './grade.ts';
import type { Timeline } from './types.ts';
import { valueAt } from './vcd.ts';

export type StageType = 'fill' | 'predict' | 'fix' | 'convert' | 'design' | 'timing';

export type QuestionSpec =
  | { kind: 'choice'; prompt: string; signal: string; time: number; choices: string[] }
  | { kind: 'number'; prompt: string; answer: number; unit?: string };

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
  /** CI가 확인하는 정답 예시. 빈칸 값, 'file:이름' 파일 내용, 'answer' 답 */
  solution?: Record<string, string>;
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
    const a = (values[ANSWER] ?? '').trim();
    if (q.kind === 'choice') {
      const truth = valueAt(tl.signals[data.bind[q.signal] ?? q.signal], q.time);
      if (a !== truth) g.failures.unshift({ message: `t=${q.time}에서 ${q.signal}는 ${truth}이에요. 재생해서 확인해 봐요`, time: q.time });
    } else if (Number(a) !== q.answer || a === '') {
      g.failures.unshift({ message: '숫자가 달라요. 가장 늦게(또는 가장 먼저) 도착하는 길을 따라 지연을 더해 봐요' });
    }
    g.pass = g.failures.length === 0;
  }
  return g;
}
