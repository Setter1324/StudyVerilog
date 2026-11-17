import { describe, expect, it } from 'vitest';
import { evalExpr } from '../src/sim/expr';

const env = (abc: string) => ({ A: abc[0]!, B: abc[1]!, C: abc[2]! });
const table = (src: string) => ['000', '001', '010', '011', '100', '101', '110', '111'].map((v) => evalExpr(src, env(v))).join('');

describe('불 함수 계산 (보스 1-15)', () => {
  it('진리표를 만든다', () => {
    expect(table('(~A & B) | (A & C)')).toBe('00110101');
    expect(table('(A | B) & C')).toBe('00010101');
    expect(table('A ^ B ^ C')).toBe('01101001');
  });

  it('우선순위는 Verilog와 같다: ~ > & > ^ > |', () => {
    expect(table('~A & B | A & C')).toBe(table('((~A) & B) | (A & C)'));
    expect(table('A | B ^ C & A')).toBe(table('A | (B ^ (C & A))'));
  });

  it('상수, 논리 연산자, XNOR도 읽는다', () => {
    expect(evalExpr("1'b1 & A", { A: '0' })).toBe('0');
    expect(evalExpr('A && 1 || 0', { A: '1' })).toBe('1');
    expect(evalExpr('A ~^ B', { A: '1', B: '1' })).toBe('1');
    expect(evalExpr('!A', { A: '1' })).toBe('0');
  });

  it('x를 4값 논리처럼 다룬다', () => {
    expect(evalExpr('A & B', { A: '0', B: 'x' })).toBe('0');
    expect(evalExpr('A & B', { A: '1', B: 'x' })).toBe('x');
    expect(evalExpr('A | B', { A: '1', B: 'z' })).toBe('1');
    expect(evalExpr('A ^ B', { A: '1', B: 'x' })).toBe('x');
  });

  it('읽지 못하는 식은 이유와 함께 멈춘다', () => {
    expect(() => evalExpr('A & D', { A: '1' })).toThrow('모르는 이름');
    expect(() => evalExpr('(A & B', { A: '1', B: '1' })).toThrow('괄호');
    expect(() => evalExpr('A B', { A: '1', B: '1' })).toThrow('남은 글자');
  });
});
