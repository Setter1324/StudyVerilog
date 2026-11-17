import { describe, expect, it } from 'vitest';
import stage from '../content/verilog/stages/v1-01.json';
import { fillTemplate, grade, type Check } from '../src/sim/grade';
import { buildTimeline } from '../src/sim/vcd';
// 골든 1(같은 회로)의 네이티브 VCD로 채점기를 확인한다
import vcd from '../engine/golden/01-assign-monitor/native/dump.vcd?raw';
import log from '../engine/golden/01-assign-monitor/native/log.txt?raw';

describe('grade', () => {
  it('정답 회로(OR, AND)는 1-1의 검사를 모두 통과한다', () => {
    const tl = buildTimeline(vcd, log);
    const g = grade(tl, stage.check as Check[], stage.bind);
    expect(g.failures).toEqual([]);
    expect(g.pass).toBe(true);
  });

  it('틀리면 시각과 함께 한 줄로 말한다', () => {
    const tl = buildTimeline(vcd, log);
    const g = grade(tl, [{ kind: 'signalAt', signal: 'E', time: 15, value: '1' }], stage.bind);
    expect(g.pass).toBe(false);
    expect(g.failures[0]).toEqual({ message: 't=15에서 E가 1이어야 하는데 0이에요', time: 15 });
  });

  it('logLine은 줄 전체가 같아야 한다($monitor 형식)', () => {
    const tl = buildTimeline(vcd, log);
    expect(grade(tl, [{ kind: 'logLine', text: ' 20: A=1 B=0 C=1 D=1 E=1' }], stage.bind).pass).toBe(true);
    expect(grade(tl, [{ kind: 'logLine', text: '20: A=1 B=0 C=1 D=1 E=1' }], stage.bind).pass).toBe(false);
    expect(grade(tl, [{ kind: 'logIncludes', text: '20: A=1 B=0 C=1 D=1 E=1' }], stage.bind).pass).toBe(true);
  });

  it('빈칸 템플릿을 채운다', () => {
    const src = fillTemplate(stage.files['testbench.sv'].template, { b1: '|', b2: '&' });
    expect(src).toContain('assign D = A | B;');
    expect(src).toContain('assign E = D & C;');
  });
});
