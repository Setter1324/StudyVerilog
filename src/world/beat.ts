// 월드의 박자. 플레이 장면의 움직임은 이 파일의 값과 함수에서 계산한다. 컴포넌트마다 타이머를 두지 않는다.
// 원칙: 거리는 속도가 흡수하고, 시간은 코드만 정한다. (걷기 박자와 상단 바 계획 3장)

/** 1틱의 재생 길이(ms). 틱은 언제나 같은 길이라 #3은 #2의 1.5배로 보인다 */
export const TICK_MS = 240;
/** 한 박자의 틱 수. 수업 테스트벤치가 #10마다 값을 바꾸므로, 값이 한 번 바뀔 때 한 번 걷는다 */
export const BEAT_TICKS = 10;
/** 한 박자의 길이(초). 플레이 장면의 모든 길은 길이와 상관없이 출발에서 도착까지 한 박자다 */
export const BEAT_SECONDS = (TICK_MS * BEAT_TICKS) / 1000;
/** 한 박자의 걸음 수. 모든 알파카가 발을 맞춘다 */
export const STEPS_PER_BEAT = 6;
/** 박자의 앞뒤 이 비율 동안 나타나고 사라진다 */
export const FADE = 0.08;

/** 박자 위치(실수) → 위상(0 이상 1 미만) */
export const phaseOf = (beat: number) => beat - Math.floor(beat);

/**
 * 재생 시계의 기준점: 재생을 시작한 순간(속도를 바꾸거나 건너뛴 순간도)의 틱과 시각(ms), 속도.
 * 틱마다 타이머를 다시 걸지 않고 이 기준점에서 계산하므로, 늦어진 시간이 다음 틱으로 쌓이지 않는다. (걷기 박자 계획 5.1)
 */
export interface PlayBase {
  tick: number;
  at: number;
  speed: number;
}

/** 기준점에서 시각 now(ms)의 틱(실수) */
export const tickAt = (base: PlayBase, now: number) => base.tick + ((now - base.at) * base.speed) / TICK_MS;

/**
 * 틱(실수) → 박자 위치. 0.5를 더해 값이 바뀌는 틱(박자의 배수)에 알파카가 길 가운데에 있게 한다.
 * 값이 바뀌는 순간이 가장 잘 보이고, 멈췄을 때 서는 자리(위상 0.5)와 같아서 시작과 끝이 매끄럽다. (5.2)
 */
export const beatAt = (tick: number, beatTicks: number = BEAT_TICKS) => tick / beatTicks + 0.5;

/** 서는 자세와 걷는 자세 사이를 잇는 시간(ms). tokens.css의 --dur-ui와 같다 */
export const BLEND_MS = 180;
