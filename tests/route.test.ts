import { describe, expect, it } from 'vitest';
import { parseHash } from '../src/app/route';

describe('parseHash', () => {
  it('빈 해시와 #/ 는 첫 화면이다', () => {
    expect(parseHash('')).toEqual({ name: 'home' });
    expect(parseHash('#/')).toEqual({ name: 'home' });
  });

  it('스테이지 목록과 도감', () => {
    expect(parseHash('#/stages')).toEqual({ name: 'stages' });
    expect(parseHash('#/guide')).toEqual({ name: 'guide' });
    expect(parseHash('#/ui')).toEqual({ name: 'ui' });
  });

  it('플레이 화면은 스테이지 id를 읽는다', () => {
    expect(parseHash('#/play/v1-04')).toEqual({ name: 'play', id: 'v1-04' });
    expect(parseHash('#/play/v1-04/')).toEqual({ name: 'play', id: 'v1-04' });
  });

  it('?ms=는 대본 위치(개발용)이고 경로와 따로 읽는다', () => {
    expect(parseHash('#/play/v1-04?ms=5400')).toEqual({ name: 'play', id: 'v1-04', ms: 5400 });
    expect(parseHash('#/play/v1-04?x=1&ms=12.5')).toEqual({ name: 'play', id: 'v1-04', ms: 12.5 });
    expect(parseHash('#/play/v1-04?ms=abc')).toEqual({ name: 'play', id: 'v1-04' });
    expect(parseHash('#/stages?ms=10')).toEqual({ name: 'stages' });
  });

  it('모르는 주소는 notFound', () => {
    expect(parseHash('#/play')).toEqual({ name: 'notFound' });
    expect(parseHash('#/nope')).toEqual({ name: 'notFound' });
  });
});
