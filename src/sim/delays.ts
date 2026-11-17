// 사용자가 쓴 코드에서 게이트와 assign의 지연(#N)을 읽고, 건물이 출력을 바꾸는 중인지 센다.
// 표시용이다. 채점은 지금처럼 결과(신호 값, 로그)로만 한다. (걷기 박자 계획 5.3)
// 플레이 화면과 Node 검증이 같이 쓸 수 있게 런타임 TS 문법을 쓰지 않는다.
import { stripComments } from './grade.ts';

const PRIMS = 'and|nand|or|nor|xor|xnor|not|buf|bufif0|bufif1|notif0|notif1';
const ID = '[A-Za-z_][\\w$]*';
/** 프리미티브: `or #3 (w1, A, B);`, `and #2 g1 (E, w1, C);`. 첫 포트가 출력이다 */
const PRIM = new RegExp(`\\b(?:${PRIMS})\\s*#\\s*(\\(\\s*)?(\\d+)\\s*(?:\\)\\s*)?(?:${ID}\\s*)?\\(\\s*(${ID})\\s*[,)]`, 'g');
/** 연속 할당: `assign #3 w1 = A | B;` */
const ASSIGN = new RegExp(`\\bassign\\s*#\\s*(\\(\\s*)?(\\d+)\\s*(?:\\)\\s*)?(${ID})\\s*=`, 'g');

/**
 * 출력 신호 이름 → 지연 틱 수. 정수 하나짜리 지연만 읽는다(#3, #(3)).
 * 상승·하강 지연(#(1,2))이나 소수(#2.5)처럼 못 읽는 것은 넣지 않는다. 그러면 화면에 표시하지 않는다.
 */
export function delaysBySignal(source: string): Record<string, number> {
  const code = stripComments(source);
  const out: Record<string, number> = {};
  for (const re of [PRIM, ASSIGN]) {
    re.lastIndex = 0;
    for (const m of code.matchAll(re)) {
      const n = Number(m[2]);
      if (n > 0) out[m[3]!] = n;
    }
  }
  return out;
}

export interface Passing {
  /** 지금이 몇 번째 틱인지 (1부터) */
  step: number;
  /** 건물을 지나는 데 걸리는 틱 수 */
  total: number;
  /** 출력이 바뀔 때까지 남은 틱 수 */
  left: number;
}

/**
 * 시각 t에 건물이 출력을 바꾸는 중인지. 출력이 시각 c에 바뀌면 c − N부터 c 직전까지 "지나는 중"이다.
 * @param changes 출력 신호의 변화 [시각, 값] (타임라인)
 * @param delay 지연 N
 */
export function passingAt(changes: [number, string][] | undefined, delay: number, t: number): Passing | null {
  if (!changes || !(delay > 0)) return null;
  for (const [c] of changes) {
    if (c > t && c - delay <= t) return { step: t - (c - delay) + 1, total: delay, left: c - t };
  }
  return null;
}
