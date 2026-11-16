// 채점: 글자가 아니라 결과(신호 값, 로그)로 한다. (최종계획서 8.5, 14.3)
import type { Timeline } from './types';
import { valueAt } from './vcd.ts';

export type Check =
  | { kind: 'signalAt'; signal: string; time: number; value: string }
  | { kind: 'logIncludes'; text: string }
  | { kind: 'end'; time: number }
  /** 구조 검사: 소스에 있어야 하는 것 / 없어야 하는 것 (정규식, 주석은 빼고 본다) */
  | { kind: 'sourceHas'; pattern: string; message: string }
  | { kind: 'sourceLacks'; pattern: string; message: string };

export interface Failure {
  message: string;
  /** "그 시각으로 가기"에 쓰는 시각 */
  time?: number;
}

export interface Grade {
  pass: boolean;
  failures: Failure[];
}

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
    } else if (c.kind === 'end') {
      if (tl.end !== c.time) failures.push({ message: `t=${c.time}에 끝나야 하는데 t=${tl.end}에 끝났어요`, time: tl.end });
    } else if (c.kind === 'sourceHas') {
      if (!new RegExp(c.pattern).test(code)) failures.push({ message: c.message });
    } else if (c.kind === 'sourceLacks') {
      if (new RegExp(c.pattern).test(code)) failures.push({ message: c.message });
    }
  }
  return { pass: failures.length === 0, failures };
}

/** 빈칸 템플릿({{b1}})을 채운 소스로 바꾼다 */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, id: string) => values[id] ?? '');
}

/** 한 줄 주석과 블록 주석을 지운다 (구조 검사용) */
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
