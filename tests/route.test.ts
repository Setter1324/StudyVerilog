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
    expect(parseHash('#/free')).toEqual({ name: 'free' });
    expect(parseHash('#/ui')).toEqual({ name: 'ui' });
  });

  it('플레이 화면은 스테이지 id를 읽는다', () => {
    expect(parseHash('#/play/v1-04')).toEqual({ name: 'play', id: 'v1-04' });
    expect(parseHash('#/play/v1-04/')).toEqual({ name: 'play', id: 'v1-04' });
  });

  it('모르는 주소는 notFound', () => {
    expect(parseHash('#/play')).toEqual({ name: 'notFound' });
    expect(parseHash('#/nope')).toEqual({ name: 'notFound' });
  });
});
