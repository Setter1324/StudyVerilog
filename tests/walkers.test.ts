import { describe, expect, it } from 'vitest';
import { BEAT_SECONDS } from '../src/world/beat';
import { project, tripPose } from '../src/world/walkers';

type Cells = [number, number][];
// 스테이지 1-1의 A(4칸)와 C(5칸): 지금은 길이가 달라 점점 어긋나던 두 길
const A: Cells = [[0, 1], [1, 1], [2, 1], [2, 2]];
const C: Cells = [[3, 5], [4, 5], [5, 5], [6, 5], [6, 4]];

/** 길 끝(마지막 칸 뒤 반 칸)의 화면 좌표 = 건물에 닿는 자리 */
function exitOf(cells: Cells): [number, number] {
  const a = cells[cells.length - 2]!;
  const b = cells[cells.length - 1]!;
  return project(b[0] + 0.5 + (b[0] - a[0]) * 0.5, b[1] + 0.5 + (b[1] - a[1]) * 0.5);
}
const near = (p: { x: number; y: number }, q: [number, number], tol: number) => Math.hypot(p.x - q[0], p.y - q[1]) <= tol;

describe('한 박자 걷기 (걷기 박자 계획 4장)', () => {
  it('길이가 다른 두 길이 60초 동안 매번 같은 순간에 도착한다', () => {
    // 페이지 시각으로 위상을 구하는 Walkers와 같은 식: 위상 = 초 ÷ 한 박자
    const arrivals = (cells: Cells) => {
      const out: number[] = [];
      for (let ms = 0; ms <= 60_000; ms += 10) {
        const pose = tripPose(cells, ms / 1000 / BEAT_SECONDS);
        if (near(pose, exitOf(cells), 4)) out.push(Math.round(ms / 100)); // 0.1초 단위로 묶는다
      }
      return [...new Set(out)];
    };
    const a = arrivals(A);
    expect(a.length).toBeGreaterThanOrEqual(Math.floor(60 / BEAT_SECONDS));
    expect(arrivals(C)).toEqual(a);
  });

  it('위상 0.5는 길 가운데이고 다 보인다', () => {
    for (const cells of [A, C]) expect(tripPose(cells, 0.5).opacity).toBe(1);
    // 4칸 길은 첫 칸 앞 가장자리(x=0)에서 2칸 걸은 자리, 두 번째 칸과 세 번째 칸의 경계다. 이 순간에는 걸음이 땅에 닿아 있다
    expect(near(tripPose(A, 0.5), project(2, 1.5), 0.01)).toBe(true);
    // 5칸 길은 2.5칸 걸은 자리, 세 번째 칸의 가운데다
    expect(near(tripPose(C, 0.5), project(5.5, 5.5), 0.01)).toBe(true);
  });

  it('출발과 도착에서는 투명하다', () => {
    expect(tripPose(C, 0).opacity).toBe(0);
    expect(tripPose(C, 0.999).opacity).toBeLessThan(0.05);
    expect(tripPose(C, 0.04).opacity).toBeCloseTo(0.5, 5);
  });

  it('스테이지 장면의 길 길이 규칙(2~6칸, 가장 긴 길이 가장 짧은 길의 2.5배 이하)은 경고로 알린다', () => {
    const stages = import.meta.glob<{ id: string; scene?: { roads: { cells: unknown[] }[] } }>('../content/verilog/stages/*.json', {
      eager: true,
      import: 'default',
    });
    const warnings: string[] = [];
    for (const stage of Object.values(stages)) {
      const lens = (stage.scene?.roads ?? []).map((r) => r.cells.length);
      if (!lens.length) continue;
      const lo = Math.min(...lens);
      const hi = Math.max(...lens);
      if (lo < 2 || hi > 6 || hi / lo > 2.5) warnings.push(`${stage.id}: 길 길이 ${lens.join(', ')}`);
    }
    if (warnings.length) console.warn('길 길이 규칙을 벗어난 장면(속도 차이가 커진다):\n' + warnings.join('\n'));
    expect(Array.isArray(warnings)).toBe(true);
  });
});
