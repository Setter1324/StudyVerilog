import { describe, expect, it } from 'vitest';
import { attachLogTimes, buildTimeline, normalizeValue, parseVcd, valueAt } from '../src/sim/vcd';

// Icarus Verilog가 내는 모양을 본뜬 VCD (골든 2: or #3, and #2)
const VCD = `$date
	Mon Nov 16 2026
$end
$version
	Icarus Verilog
$end
$timescale
	1s
$end
$scope module test $end
$var wire 1 ! E $end
$var wire 1 " w1 $end
$var reg 1 # A $end
$var reg 4 $ count [3:0] $end
$scope module ha $end
$var wire 1 ! out $end
$upscope $end
$upscope $end
$enddefinitions $end
#0
$dumpvars
x"
x!
0#
bx $
$end
#3
0"
#5
0!
b0 $
#10
1#
b101 $
#13
1"
#15
1!
#20
`;

describe('parseVcd', () => {
  const p = parseVcd(VCD);

  it('계층 이름과 폭을 읽는다', () => {
    expect(Object.keys(p.signals).sort()).toEqual(['test.A', 'test.E', 'test.count', 'test.ha.out', 'test.w1']);
    expect(p.signals['test.count']?.width).toBe(4);
    expect(p.timescale).toBe('1s');
  });

  it('끝 시각은 마지막 #시각이다', () => {
    expect(p.end).toBe(20);
  });

  it('게이트 지연: t=14에 E=0, t=15에 E=1', () => {
    expect(valueAt(p.signals['test.E'], 4)).toBe('x');
    expect(valueAt(p.signals['test.E'], 5)).toBe('0');
    expect(valueAt(p.signals['test.E'], 14)).toBe('0');
    expect(valueAt(p.signals['test.E'], 15)).toBe('1');
  });

  it('같은 id를 쓰는 신호는 함께 바뀐다', () => {
    expect(p.signals['test.ha.out']?.changes).toEqual(p.signals['test.E']?.changes);
  });

  it('짧게 적힌 벡터를 왼쪽으로 채운다', () => {
    expect(valueAt(p.signals['test.count'], 0)).toBe('xxxx');
    expect(valueAt(p.signals['test.count'], 5)).toBe('0000');
    expect(valueAt(p.signals['test.count'], 10)).toBe('0101');
  });
});

describe('normalizeValue', () => {
  it('VCD 채우기 규칙', () => {
    expect(normalizeValue('1', 4)).toBe('0001');
    expect(normalizeValue('x1', 4)).toBe('xxx1');
    expect(normalizeValue('Z', 1)).toBe('z');
  });
});

describe('로그 시각', () => {
  it('"%3t:" 로 시작하는 줄은 그 시각, 아니면 앞 줄의 시각', () => {
    const log = attachLogTimes('  0: A=0\n 15: A=1\nVCD info: done\n');
    expect(log).toEqual([
      { t: 0, text: '  0: A=0' },
      { t: 15, text: ' 15: A=1' },
      { t: 15, text: 'VCD info: done' },
    ]);
  });

  it('buildTimeline은 VCD와 로그를 묶는다', () => {
    const tl = buildTimeline(VCD, ' 15: E=1');
    expect(tl.end).toBe(20);
    expect(tl.log).toEqual([{ t: 15, text: ' 15: E=1' }]);
  });
});
