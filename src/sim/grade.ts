// 채점: 글자가 아니라 결과(신호 값, 로그)로 한다. (최종계획서 8.5, 14.3)
import type { Timeline } from './types';
import { valueAt } from './vcd.ts';

export type Check =
  | { kind: 'signalAt'; signal: string; time: number; value: string }
  | { kind: 'logIncludes'; text: string }
  /** 로그에 이 줄이 그대로 있어야 한다(끝 공백만 무시). $monitor 형식을 볼 때 쓴다 */
  | { kind: 'logLine'; text: string }
  | { kind: 'end'; time: number }
  /** 구조 검사: 소스에 있어야 하는 것 / 없어야 하는 것 (정규식, 주석은 빼고 본다) */
  | { kind: 'sourceHas'; pattern: string; message: string }
  | { kind: 'sourceLacks'; pattern: string; message: string }
  /** 자극 검사: 신호들을 이어 붙인 값이 모든 조합(예: A, B, C가 000부터 111까지)을 거쳤는가 */
  | { kind: 'covers'; signals: string[] };

export interface Failure {
  message: string;
  /** "그 시각으로 가기"에 쓰는 시각 */
  time?: number;
}

export interface Grade {
  pass: boolean;
  failures: Failure[];
  /** 문제 칸(예측·타이밍)이 있으면 그 답이 맞았는지 */
  answer?: boolean;
}

/** 자극 검사에서 다룰 수 있는 비트 수 상한 (2^10 = 1024 조합) */
const COVER_BITS = 10;

/**
 * @param bind 스테이지의 짧은 이름 → VCD 계층 이름 (예: E → test.E)
 */
export function grade(tl: Timeline, checks: Check[], bind: Record<string, string>, sources: string[] = []): Grade {
  const failures: Failure[] = [];
  const code = sources.map(stripComments).join('\n');
  for (const c of checks) {
    if (c.kind === 'signalAt') {
      const name = bind[c.signal] ?? c.signal;
      const got = valueAt(tl.signals[name], c.time);
      if (got !== c.value) {
        failures.push({
          message: got
            ? `t=${c.time}에서 ${c.signal}가 ${c.value}이어야 하는데 ${got}이에요`
            : `${c.signal} 신호를 찾지 못했어요`,
          time: c.time,
        });
      }
    } else if (c.kind === 'logIncludes') {
      if (!tl.log.some((l) => l.text.includes(c.text))) failures.push({ message: `로그에 "${c.text}"가 없어요` });
    } else if (c.kind === 'logLine') {
      if (!tl.log.some((l) => l.text.trimEnd() === c.text)) failures.push({ message: `로그에 "${c.text}" 줄이 없어요` });
    } else if (c.kind === 'end') {
      if (tl.end !== c.time) failures.push({ message: `t=${c.time}에 끝나야 하는데 t=${tl.end}에 끝났어요`, time: tl.end });
    } else if (c.kind === 'sourceHas') {
      if (!new RegExp(c.pattern).test(code)) failures.push({ message: c.message });
    } else if (c.kind === 'sourceLacks') {
      if (new RegExp(c.pattern).test(code)) failures.push({ message: c.message });
    } else if (c.kind === 'covers') {
      const f = coverage(tl, c.signals, bind);
      if (f) failures.push(f);
    }
  }
  return { pass: failures.length === 0, failures };
}

/** 자극 검사. 빠진 조합이 있으면 앞의 몇 개를 알려 준다. */
function coverage(tl: Timeline, signals: string[], bind: Record<string, string>): Failure | undefined {
  const tracks = signals.map((s) => tl.signals[bind[s] ?? s]);
  const lost = signals.filter((_, k) => !tracks[k]);
  if (lost.length) return { message: `${lost.join(', ')} 신호를 찾지 못했어요` };
  const width = tracks.reduce((n, tr) => n + tr!.width, 0);
  if (width > COVER_BITS) return { message: `${signals.join(', ')}는 조합이 너무 많아 검사하지 않아요` };
  const times = [...new Set(tracks.flatMap((tr) => tr!.changes.map(([ct]) => ct)))]
    .filter((x) => x <= tl.end)
    .sort((a, b) => a - b);
  const seen = new Set<string>();
  for (const at of times) {
    const v = tracks.map((tr) => valueAt(tr, at)).join('');
    if (/^[01]+$/.test(v)) seen.add(v);
  }
  const missing: string[] = [];
  for (let n = 0; n < 2 ** width; n++) {
    const b = n.toString(2).padStart(width, '0');
    if (!seen.has(b)) missing.push(b);
  }
  if (!missing.length) return undefined;
  const shown = missing.slice(0, 4).join(', ') + (missing.length > 4 ? ` 외 ${missing.length - 4}개` : '');
  return { message: `${signals.join(', ')}가 아직 거치지 않은 조합이 있어요: ${shown}` };
}

/** 빈칸 템플릿({{b1}})을 채운 소스로 바꾼다 */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, id: string) => values[id] ?? '');
}

/** 한 줄 주석과 블록 주석을 지운다 (구조 검사용) */
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
