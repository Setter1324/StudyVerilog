import { describe, expect, it } from 'vitest';
import stage13 from '../content/verilog/stages/v1-13.json';
import examples from '../content/verilog/examples.json';
import { findTop, modulesOf } from '../src/sim/modules';
import { fillTemplate } from '../src/sim/grade';

// 자유 Verilog의 최상위 모듈 찾기 (순차 재생과 게이트 입구 계획 8.1)
describe('findTop', () => {
  it('design.sv와 testbench.sv를 나눠 쓴 코드(1-13)에서 t_test를 고른다', () => {
    const src = Object.values(stage13.files)
      .map((f) => fillTemplate(f.template, stage13.solution as Record<string, string>))
      .join('\n');
    expect(findTop(src)).toBe('t_test');
  });

  it('주석 속 모듈과 인스턴스는 보지 않는다', () => {
    const src = `// module fake; endmodule\nmodule a; endmodule\n/* module b; a x(); endmodule */\nmodule t; initial $finish; endmodule\n`;
    expect(modulesOf(src).map((m) => m.name)).toEqual(['a', 't']);
    expect(findTop(src)).toBe('t');
  });

  it('인스턴스 이름, 파라미터, 배열이 붙은 인스턴스도 쓰인 것으로 센다', () => {
    const src = [
      'module add #(parameter N = 4) (input [N-1:0] a, output [N-1:0] y); assign y = a; endmodule',
      'module buf1(input a, output y); assign y = a; endmodule',
      'module top;',
      '  wire [3:0] y; reg [3:0] a;',
      '  add #(.N(4)) u_add (.a(a), .y(y));',
      '  buf1 bufs[3:0] (a, y);',
      'endmodule',
    ].join('\n');
    expect(findTop(src)).toBe('top');
  });

  it('쓰이지 않은 모듈이 여럿이면 initial이 있는 것, 그래도 여럿이면 마지막 것', () => {
    expect(findTop('module tb; initial $finish; endmodule\nmodule spare; endmodule\n')).toBe('tb');
    expect(findTop('module a; endmodule\nmodule b; endmodule\n')).toBe('b');
    expect(findTop('// 비었다')).toBeUndefined();
  });

  it('예제 세 개의 최상위는 테스트벤치다', () => {
    for (const ex of examples.examples) {
      const top = findTop(Object.values(ex.files).join('\n'));
      expect(top?.startsWith('t_')).toBe(true);
    }
  });
});
