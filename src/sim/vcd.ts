// VCD 원문을 타임라인으로 바꾼다. (최종계획서 9.1, 9.3)
// $var, #시각, 값 변화만 읽는다. 복잡해지면 vcd-stream으로 바꾼다.
// 이 파일은 Node의 타입 제거 실행(engine/golden/compare.mjs)으로도 불리므로
// 타입 import 외의 import를 두지 않고, enum 같은 런타임 TS 문법을 쓰지 않는다.
import type { Timeline } from './types';

export type SignalTrack = Timeline['signals'][string];

export interface ParsedVcd {
  end: number;
  timescale: string;
  signals: Record<string, SignalTrack>;
}

/** VCD 값 하나를 소문자로 맞추고, 짧게 적힌 벡터는 VCD 규칙대로 왼쪽을 채운다. */
export function normalizeValue(raw: string, width: number): string {
  let v = raw.toLowerCase();
  if (width <= 1) return v.slice(-1) || 'x';
  if (v.length < width) {
    const head = v[0] ?? '0';
    const pad = head === 'x' || head === 'z' ? head : '0';
    v = pad.repeat(width - v.length) + v;
  } else if (v.length > width) {
    v = v.slice(v.length - width);
  }
  return v;
}

export function parseVcd(text: string): ParsedVcd {
  const tokens = text.split(/\s+/).filter((t) => t.length > 0);
  const scopes: string[] = [];
  const byId = new Map<string, { names: string[]; width: number }>();
  const signals: Record<string, SignalTrack> = {};
  let timescale = '';
  let now = 0;
  let end = 0;
  let i = 0;

  const skipToEnd = () => {
    while (i < tokens.length && tokens[i] !== '$end') i++;
    i++; // $end
  };

  const record = (id: string, raw: string) => {
    const entry = byId.get(id);
    if (!entry) return;
    const v = normalizeValue(raw, entry.width);
    for (const name of entry.names) {
      const track = signals[name];
      if (!track) continue;
      const last = track.changes[track.changes.length - 1];
      if (last && last[0] === now) {
        last[1] = v;
        const prev = track.changes[track.changes.length - 2];
        if (prev && prev[1] === v) track.changes.pop();
      } else if (!last || last[1] !== v) {
        track.changes.push([now, v]);
      }
    }
  };

  // 헤더
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok === '$enddefinitions') {
      skipToEnd();
      break;
    }
    if (tok === '$scope') {
      // $scope module test $end
      scopes.push(tokens[i + 2] ?? '');
      skipToEnd();
    } else if (tok === '$upscope') {
      scopes.pop();
      skipToEnd();
    } else if (tok === '$timescale') {
      const parts: string[] = [];
      i++;
      while (i < tokens.length && tokens[i] !== '$end') parts.push(tokens[i++] ?? '');
      i++;
      timescale = parts.join('');
    } else if (tok === '$var') {
      // $var wire 4 ! count [3:0] $end
      const width = Number(tokens[i + 2] ?? '1') || 1;
      const id = tokens[i + 3] ?? '';
      const ref = tokens[i + 4] ?? '';
      const name = [...scopes, ref].join('.');
      const entry = byId.get(id) ?? { names: [], width };
      entry.names.push(name);
      byId.set(id, entry);
      signals[name] = { width, changes: [] };
      skipToEnd();
    } else if (tok?.startsWith('$')) {
      skipToEnd(); // $date, $version, $comment ...
    } else {
      i++;
    }
  }

  // 본문
  while (i < tokens.length) {
    const tok = tokens[i++] ?? '';
    const c = tok[0];
    if (c === '#') {
      now = Number(tok.slice(1));
      if (now > end) end = now;
    } else if (c === 'b' || c === 'B') {
      record(tokens[i++] ?? '', tok.slice(1));
    } else if (c === 'r' || c === 'R') {
      i++; // 실수 값은 쓰지 않는다
    } else if (c === '0' || c === '1' || c === 'x' || c === 'X' || c === 'z' || c === 'Z') {
      record(tok.slice(1), c);
    } else if (tok === '$comment') {
      while (i < tokens.length && tokens[i] !== '$end') i++;
      i++;
    }
    // $dumpvars, $dumpall, $dumpon, $dumpoff, $end 는 안의 값만 읽으면 된다
  }

  return { end, timescale, signals };
}

/** 시각 t에서 신호의 값. 아직 값이 없으면 'x'. */
export function valueAt(track: SignalTrack | undefined, t: number): string {
  if (!track) return '';
  let v = 'x'.repeat(Math.max(1, track.width));
  for (const [time, value] of track.changes) {
    if (time > t) break;
    v = value;
  }
  return v;
}

const LOG_TIME = /^\s*(\d+)\s*:/;

/**
 * 로그 줄에 시각을 붙인다. 줄이 "숫자:"로 시작하면(수업의 $monitor("%3t: ...") 형식) 그 시각을,
 * 아니면 앞 줄의 시각을 쓴다.
 */
export function attachLogTimes(log: string): Timeline['log'] {
  let t = 0;
  const out: Timeline['log'] = [];
  for (const text of log.split('\n')) {
    if (text.trim() === '') continue;
    const m = LOG_TIME.exec(text);
    if (m) t = Number(m[1]);
    out.push({ t, text });
  }
  return out;
}

export function buildTimeline(vcd: string, log: string): Timeline {
  const parsed = parseVcd(vcd);
  return { end: parsed.end, signals: parsed.signals, log: attachLogTimes(log) };
}
