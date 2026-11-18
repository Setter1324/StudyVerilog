import { describe, expect, it } from 'vitest';
import { project, standPose, walkPose, type Track } from '../src/world/walkers';

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

describe('한 번 걷기 (순차 재생 계획 5.5)', () => {
  it('같은 물결의 두 길은 길이가 달라도 같은 순간에 문 앞에 선다', () => {
    const arrival = (t: Track) => {
      const door = standPose(t);
      for (let k = 0; k <= 100; k++) {
        if (near(walkPose(t, k / 100), [door.x, door.y], 0.5)) return k;
      }
      return -1;
    };
    expect(arrival(A)).toBe(100);
    expect(arrival(C)).toBe(100);
  });

  it('문 앞은 마지막 칸 가운데이고, 건물 쪽을 본다', () => {
    const a = standPose(A);
    expect(near(a, project(3.5, 1.5), 0.01)).toBe(true);
    expect(a.dir).toBe(1); // A는 OR(3,2)의 위 문: +y
    expect(standPose(C).dir).toBe(3); // C는 AND(6,3)의 아래 문: -y
    expect(standPose(D).dir).toBe(1);
    expect(a.opacity).toBe(1);
  });

  it('출발 문에서 나타나고, 도착해서는 사라지지 않는다', () => {
    expect(walkPose(C, 0).opacity).toBe(0);
    expect(walkPose(C, 0.04).opacity).toBeCloseTo(0.5, 5);
    expect(walkPose(C, 1).opacity).toBe(1);
  });

  it('첫 반 칸은 출발 건물과 맞닿은 변에서 나온다', () => {
    // D는 OR(3,2)과 첫 칸 (4,2)이 만나는 변 x=4에서 나온다
    const p = walkPose(D, 0);
    expect(near(p, project(4, 2.5), 0.01)).toBe(true);
    expect(p.dir).toBe(0);
  });

  it('도착 칸은 건물로 들어가는 변의 반 칸 앞이다', () => {
    const [ex, ey] = exitOf(C);
    const door = standPose(C);
    // 문 앞(칸 가운데)과 변 사이는 반 칸: 화면에서 -y 방향 반 칸은 (16, -8)
    expect(Math.round(ex - door.x)).toBe(16);
    expect(Math.round(ey - door.y)).toBe(-8);
  });
});
