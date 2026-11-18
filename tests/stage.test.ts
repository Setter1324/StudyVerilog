import { describe, expect, it } from 'vitest';
import { changedLines, fileKey, solutionView, visibleSource, type StageData } from '../src/sim/stage';

// 도움 칸의 정답 보기 (순차 재생과 게이트 입구 계획 7장)
const stages = import.meta.glob<StageData>('../content/verilog/stages/*.json', { eager: true, import: 'default' });

describe('정답 보기 solutionView', () => {
  const all = Object.values(stages);

  it('스테이지 15개를 모두 읽는다', () => {
    expect(all.length).toBe(15);
  });

  for (const data of all) {
    it(`${data.id}: 보여 줄 것이 있고, 넣기 단추가 채우는 값은 solution과 같다`, () => {
      const v = solutionView(data);
      expect(v.blankLines.length + v.files.length + (v.answer === undefined ? 0 : 1)).toBeGreaterThan(0);
      const filled = { ...v.fillBlanks, ...v.fillFiles, ...v.fillAnswer };
      expect(filled).toEqual(data.solution);
      // 빈칸을 넣은 코드는 정답 예시로 만든 코드와 같다
      for (const name of Object.keys(data.files)) {
        expect(visibleSource(data, name, filled)).toBe(visibleSource(data, name, data.solution ?? {}));
      }
    });
  }

  it('1-4: and #2 (E, w1, C); 줄과 답 0이 보이고, 빈칸에 넣기는 #2를 넣는다', () => {
    const v = solutionView(stages['../content/verilog/stages/v1-04.json']!);
    const line = v.blankLines.map((l) => l.parts.map((p) => p.text).join('')).find((x) => x.includes('(E, w1, C)'));
    expect(line?.trim()).toBe('and #2 (E, w1, C);');
    expect(v.blankLines[0]!.parts.find((p) => p.filled)?.text).toBe('#2');
    expect(v.answer).toBe('0');
    expect(v.fillBlanks).toEqual({ b1: '#2' });
  });

  it('1-3(버그 수정): 고친 줄을 강조한다', () => {
    const data = stages['../content/verilog/stages/v1-03.json']!;
    const v = solutionView(data);
    const f = v.files[0]!;
    expect(f.changed.map((n) => f.lines[n - 1]!.trim())).toEqual(['and (Y, w, B);']);
    expect(v.fillFiles[fileKey('testbench.sv')]).toBe(data.solution![fileKey('testbench.sv')]);
  });
});

describe('줄 비교 changedLines', () => {
  it('바뀐 줄과 더한 줄만 고른다', () => {
    expect(changedLines(['a', 'b', 'c'], ['a', 'B', 'c'])).toEqual([2]);
    expect(changedLines(['a', 'c'], ['a', 'b', 'c'])).toEqual([2]);
    expect(changedLines(['a', 'b'], ['a', 'b'])).toEqual([]);
    expect(changedLines([], ['x'])).toEqual([1]);
  });
});
