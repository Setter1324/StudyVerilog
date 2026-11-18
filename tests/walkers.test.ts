import { describe, expect, it } from 'vitest';
import { BEAT_SECONDS } from '../src/world/beat';
import { project, tripPose, type Track } from '../src/world/walkers';

// 스테이지 1-1의 A(4칸)와 C(3칸). A는 OR(3,2)의 위 문, C는 AND(6,3)의 아래 문으로 들어간다
const A: Track = { cells: [[0, 1], [1, 1], [2, 1], [3, 1]], to: [3, 2] };
const C: Track = { cells: [[4, 4], [5, 4], [6, 4]], to: [6, 3] };
// OR의 앞 문에서 나와 AND의 위 문으로 들어가는 D
const D: Track = { cells: [[4, 2], [5, 2], [6, 2]], from: [3, 2], to: [6, 3] };

/** 길 끝 = 문 칸과 도착 건물이 만나는 변의 가운데 (게이트 입구 계획 4.5) */
function exitOf(t: Track): [number, number] {
  const b = t.cells[t.cells.length - 1]!;
  const to = t.to!;
  return project((b[0] + to[0]) / 2 + 0.5, (b[1] + to[1]) / 2 + 0.5);
}
const near = (p: { x: number; y: number }, q: [number, number], tol: number) => Math.hypot(p.x - q[0], p.y - q[1]) <= tol;

describe('한 박자 걷기 (걷기 박자 계획 4장)', () => {
  it('길이가 다른 두 길이 60초 동안 매번 같은 순간에 도착한다', () => {
    // 페이지 시각으로 위상을 구하는 Walkers와 같은 식: 위상 = 초 ÷ 한 박자
    const arrivals = (cells: Track) => {
      const out: number[] = [];
      for (let ms = 0; ms <= 60_000; ms += 10) {
        const pose = tripPose(cells, ms / 1000 / BEAT_SECONDS);
        if (near(pose, exitOf(cells), 2)) out.push(Math.round(ms / 100)); // 0.1초 단위로 묶는다
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
    // 3칸 길은 1.5칸 걸은 자리, 두 번째 칸의 가운데다
    expect(near(tripPose(C, 0.5), project(5.5, 4.5), 0.01)).toBe(true);
  });

  it('출발과 도착에서는 투명하다', () => {
    expect(tripPose(C, 0).opacity).toBe(0);
    expect(tripPose(C, 0.999).opacity).toBeLessThan(0.05);
    expect(tripPose(C, 0.04).opacity).toBeCloseTo(0.5, 5);
  });

  it('마지막 반 칸은 직전 방향이 아니라 건물 쪽으로 꺾는다', () => {
    // C는 +x로 오다가 마지막 칸 가운데에서 -y(AND 쪽)로 꺾는다
    expect(tripPose(C, 0.5).dir).toBe(0);
    expect(tripPose(C, 0.95).dir).toBe(3);
    expect(near(tripPose(C, 0.9999), exitOf(C), 1)).toBe(true);
    // D는 +x로 걷다가 AND의 위 문으로 +y
    expect(tripPose(D, 0.95).dir).toBe(1);
  });

  it('첫 반 칸은 출발 건물과 맞닿은 변에서 나온다', () => {
    // D는 OR(3,2)과 첫 칸 (4,2)이 만나는 변 x=4에서 나온다
    const p = tripPose(D, 0);
    const [x, y] = project(4, 2.5);
    expect(Math.hypot(p.x - x, p.y - y)).toBeLessThan(0.01);
  });
});
