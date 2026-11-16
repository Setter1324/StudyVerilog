import { describe, expect, it } from 'vitest';
import { delaysBySignal, passingAt } from '../src/sim/delays';
import { beatAt, phaseOf, tickAt, TICK_MS } from '../src/world/beat';

describe('재생 시계 (걷기 박자 계획 5.1, 5.2)', () => {
  it('기준점에서 계산하므로 오차가 쌓이지 않는다', () => {
    const base = { tick: 0, at: 1000, speed: 1 };
    expect(tickAt(base, 1000 + 19_200)).toBe(80);
    expect(tickAt({ ...base, speed: 0.5 }, 1000 + 19_200)).toBe(40);
    expect(tickAt({ ...base, speed: 2 }, 1000 + 19_200)).toBe(160);
    // 건너뛰거나 속도를 바꾸면 그 자리에서 기준점을 새로 잡는다
    expect(tickAt({ tick: 13, at: 5000, speed: 1 }, 5000 + 2 * TICK_MS)).toBe(15);
  });

  it('틱은 언제나 같은 길이라 #3은 #2의 1.5배다', () => {
    const base = { tick: 10, at: 0, speed: 1 };
    const msTo = (tick: number) => ((tick - base.tick) * TICK_MS) / base.speed;
    expect(msTo(13) - msTo(10)).toBe(720);
    expect(msTo(15) - msTo(13)).toBe(480);
  });

  it('값이 바뀌는 틱(박자의 배수)에 알파카가 길 가운데(위상 0.5)에 있다', () => {
    for (const t of [0, 10, 20, 80]) expect(phaseOf(beatAt(t))).toBeCloseTo(0.5, 9);
    expect(phaseOf(beatAt(5))).toBeCloseTo(0, 9);
    expect(phaseOf(beatAt(2, 4))).toBeCloseTo(0, 9);
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
