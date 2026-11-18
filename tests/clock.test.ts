import { describe, expect, it } from 'vitest';
import { delaysBySignal, passingAt } from '../src/sim/delays';
import { FADE, GAP_MS, GATE_MS, GATE_TICK_MS, WALK_MS } from '../src/world/beat';

describe('대본 시계 (순차 재생 계획 5.3)', () => {
  it('재생 길이는 틱 수가 아니라 변화의 수가 정한다', () => {
    // 1-4의 한 구간: 걷기 → OR #3 → 걷기 → AND #2 → 걷기 → 기다림
    const one = WALK_MS + (GATE_MS + 3 * GATE_TICK_MS) + WALK_MS + (GATE_MS + 2 * GATE_TICK_MS) + WALK_MS + GAP_MS;
    expect(one).toBe(3650);
  });

  it('#3과 #2는 지연 칸 수로 구분한다: 건물 조각이 한 틱에 150ms씩 길다', () => {
    expect(GATE_MS + 3 * GATE_TICK_MS - (GATE_MS + 2 * GATE_TICK_MS)).toBe(GATE_TICK_MS);
  });

  it('걷기의 앞 8% 동안 나타난다', () => {
    expect(FADE).toBe(0.08);
  });
});

describe('지연 읽기 (5.3)', () => {
  it('프리미티브는 첫 포트가 출력이다', () => {
    expect(delaysBySignal('or  #3 (w1, A, B);\nand #2 (E, w1, C);')).toEqual({ w1: 3, E: 2 });
    expect(delaysBySignal('xor #(4) g1 (w, A, B);')).toEqual({ w: 4 });
  });

  it('assign 지연도 읽는다', () => {
    expect(delaysBySignal('assign #5 D = A | B;\nassign E = D & C;')).toEqual({ D: 5 });
  });

  it('주석, 지연 없는 게이트, 못 읽는 지연은 뺀다', () => {
    const src = '// or #9 (x, A, B);\n/* and #9 (y, A, B); */\nnot (n, A);\nand #(1,2) (p, A, B);\nor #2.5 (q, A, B);';
    expect(delaysBySignal(src)).toEqual({});
  });

  it('출력이 c에 바뀌면 c−N부터 c 직전까지 지나는 중이다', () => {
    // 1-4: A가 t=10에 바뀌고, OR #3을 지나 w1이 t=13에 바뀐다
    const w1: [number, string][] = [[0, 'x'], [3, '0'], [13, '1']];
    expect(passingAt(w1, 3, 9)).toBeNull();
    expect(passingAt(w1, 3, 10)).toEqual({ step: 1, total: 3, left: 3 });
    expect(passingAt(w1, 3, 12)).toEqual({ step: 3, total: 3, left: 1 });
    expect(passingAt(w1, 3, 13)).toBeNull();
    // 빈칸에 #5를 쓰면 칸도 5개, 실제 변화도 5틱 뒤라 화면과 결과가 맞는다
    expect(passingAt([[0, 'x'], [15, '1']], 5, 10)).toEqual({ step: 1, total: 5, left: 5 });
  });
});
