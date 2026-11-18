// 자막: 대본의 조각 → 월드와 재생 바 사이의 한 줄. (순차 재생 계획 6.3)
// 신호 이름 뒤에는 조사를 붙이지 않는다(영문 이름이라 받침을 알 수 없다).
import type { Change } from '../sim/script';
import type { Frame, Layout } from './beat';

export interface CaptionGate {
  id: string;
  /** 건물 이름표. 끝의 "#3"은 떼고 코드에서 읽은 지연을 붙인다 */
  label: string;
  outs: string[];
}

const changeText = (cs: Change[]) => cs.map((c) => `${c.signal}: ${c.from} → ${c.to}`).join(', ');
const nameOf = (label: string) => label.replace(/\s*#\d+\s*$/, '');

/**
 * 지금 조각의 자막.
 * - 구간 시작(입력이 걷는다): `구간 2/4 · t=10 · 입력이 바뀌었어요 (A: 0 → 1)`
 * - 건물(지나는 중, 그 출력이 걷는 중): `OR #3 · 3틱 뒤 t=13에 w1: 0 → 1`, 지연이 없으면 `OR · 바로 D: 0 → 1`
 * - 기다림: 출력이 그대로인 건물이 있으면 `AND · 입력이 바뀌어도 출력(E)은 그대로예요`, 없으면 `다음 입력까지 5틱 · t=20`
 * - 끝: `t=40 · 해가 졌어요`
 */
export function captionAt(layout: Layout, f: Frame, gates: CaptionGate[]): string {
  if (f.kind === 'end') return `t=${layout.end} · 해가 졌어요`;
  const step = layout.steps[f.step];
  if (!step) return '';
  if (f.kind === 'gap') {
    const quiet = step.quiet.flatMap((id) => {
      const g = gates.find((x) => x.id === id);
      return g ? [`${nameOf(g.label)} · 입력이 바뀌어도 출력(${g.outs.join(', ')})은 그대로예요`] : [];
    });
    if (quiet.length) return quiet.join(' · ');
    const from = layout.pieces[f.piece]?.t0 ?? f.t;
    return `다음 입력까지 ${step.end - from}틱 · t=${step.end}`;
  }
  const wave = step.waves[f.wave];
  if (!wave) return '';
  if (wave.level === 0) return `구간 ${f.step + 1}/${layout.steps.length} · t=${wave.t} · 입력이 바뀌었어요 (${changeText(wave.changes)})`;
  return wave.gates
    .map(({ id, delay }) => {
      const g = gates.find((x) => x.id === id);
      const mine = wave.changes.filter((c) => g?.outs.includes(c.signal));
      const name = g ? nameOf(g.label) : id;
      return delay > 0
        ? `${name} #${delay} · ${delay}틱 뒤 t=${wave.t}에 ${changeText(mine)}`
        : `${name} · 바로 ${changeText(mine)}`;
    })
    .join(' / ');
}
