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
