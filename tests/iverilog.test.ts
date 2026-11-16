import { describe, expect, it } from 'vitest';
import { ivlConf, parseDiagnostics } from '../src/runner/iverilog';

describe('iverilog 오케스트레이션', () => {
  it('ivl 설정 파일에 세대와 vvp 대상이 들어간다', () => {
    const conf = ivlConf('2012');
    expect(conf).toContain('generation:2012');
    expect(conf).toContain('flag:DLL=vvp.tgt');
    expect(conf).toContain('out:/out.vvp');
  });

  it('컴파일 오류를 파일, 줄, 메시지로 나눈다', () => {
    expect(parseDiagnostics('/testbench.sv:5: syntax error\nI give up.')).toEqual([
      { file: 'testbench.sv', line: 5, message: 'syntax error' },
    ]);
  });
});
