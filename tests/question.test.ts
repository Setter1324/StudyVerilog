import { describe, expect, it } from 'vitest';
import { grade } from '../src/sim/grade';
import { gradeStage, judge, type StageData } from '../src/sim/stage';
import type { Timeline } from '../src/sim/types';

// A, B, C가 10틱마다 000 → 111로 오르고, H = (~A & B) | (A & C)가 3틱 늦게 따라오는 타임라인
function counter(steps = 8, delay = 3): Timeline {
  const A: [number, string][] = [];
  const B: [number, string][] = [];
  const C: [number, string][] = [];
  const H: [number, string][] = [[0, 'x']];
  for (let n = 0; n < steps; n++) {
    const t = n * 10;
    const [a, b, c] = n.toString(2).padStart(3, '0').split('');
    A.push([t, a!]);
    B.push([t, b!]);
    C.push([t, c!]);
    H.push([t + delay, (a === '0' && b === '1') || (a === '1' && c === '1') ? '1' : '0']);
  }
  const dedupe = (ch: [number, string][]) => ch.filter((x, i) => i === 0 || ch[i - 1]![1] !== x[1]);
  const sig = (ch: [number, string][]) => ({ width: 1, changes: dedupe(ch) });
  return {
    end: steps * 10,
    signals: { 't.A': sig(A), 't.B': sig(B), 't.C': sig(C), 't.H': sig(H) },
    log: [],
  };
}
const bind = { A: 't.A', B: 't.B', C: 't.C', H: 't.H' };

describe('자극 검사 (covers)', () => {
  it('000부터 111까지 모두 거치면 통과한다', () => {
    expect(grade(counter(), [{ kind: 'covers', signals: ['A', 'B', 'C'] }], bind).pass).toBe(true);
  });

  it('빠진 조합을 알려 준다', () => {
    const g = grade(counter(6), [{ kind: 'covers', signals: ['A', 'B', 'C'] }], bind);
    expect(g.pass).toBe(false);
    expect(g.failures[0]!.message).toBe('A, B, C가 아직 거치지 않은 조합이 있어요: 110, 111');
  });
});

describe('문제 칸', () => {
  const expr = { kind: 'expr' as const, prompt: 'H는?', output: 'H', inputs: ['A', 'B', 'C'], choices: [], afterRun: true };

  it('expr: 자리 잡은 값으로 식을 맞춰 본다', () => {
    expect(judge(expr, '(~A & B) | (A & C)', counter(), bind)).toBeUndefined();
    expect(judge(expr, '(A | B) & C', counter(), bind)).toEqual({
      message: 't=29에서 ABC=010일 때 H는 1인데, 이 식으로는 0이에요',
      time: 29,
    });
  });

  it('afterRun 문제는 답이 비면 파형을 보고 고르라고 한다', () => {
    expect(judge(expr, '', counter(), bind)?.message).toBe('파형을 보고 답을 고른 뒤 다시 실행해요');
  });

  it('dumped: 파형에 기록됐는지를 본다', () => {
    const q = { kind: 'dumped' as const, prompt: '나올까요?', signal: 't.ins.w1', choices: ['나와요', '안 나와요'] };
    expect(judge(q, '안 나와요', counter(), bind)).toBeUndefined();
    expect(judge(q, '나와요', counter(), bind)?.message).toContain('기록되지 않았어요');
    expect(judge({ ...q, signal: 'H' }, '나와요', counter(), bind)).toBeUndefined();
  });

  it('빈칸과 함께 쓰면 코드의 실패가 먼저, 답의 실패가 나중이다', () => {
    const data: StageData = {
      id: 'x',
      type: 'fill',
      top: 't',
      intro: '',
      files: { 'testbench.sv': { template: '{{b1}}' } },
      hints: [],
      scene: null,
      bind,
      check: [{ kind: 'signalAt', signal: 'H', time: 5, value: '1' }],
      question: { kind: 'choice', prompt: 't=2의 H는?', signal: 'H', time: 2, choices: ['0', '1', 'x'] },
    };
    const g = gradeStage(data, { answer: '0' }, counter());
    expect(g.pass).toBe(false);
    expect(g.answer).toBe(false);
    expect(g.failures.map((f) => f.time)).toEqual([5, 2]);
    expect(gradeStage({ ...data, type: 'predict' }, { answer: '0' }, counter()).failures[0]!.time).toBe(2);
    expect(gradeStage(data, { answer: 'x' }, counter()).answer).toBe(true);
  });
});
