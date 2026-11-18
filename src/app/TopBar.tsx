import { useEffect, useState } from 'react';
import { stageById } from '../state/content';
import { useProgress } from '../state/progress';
import { IconButton } from '../ui';
import s from './TopBar.module.css';

const NAV = [
  { href: '#/', label: '홈', name: 'home' },
  { href: '#/stages', label: '스테이지', name: 'stages' },
  { href: '#/free', label: '자유 Verilog', name: 'free' },
  { href: '#/guide', label: '도감', name: 'guide' },
] as const;

/** 큐브 로고: 세 면만 그린 블록 하나 (7.4) */
export function CubeLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 3 28 9 16 15 4 9Z" style={{ fill: 'var(--accent)' }} />
      <path d="M4 9 16 15v14L4 23Z" style={{ fill: 'color-mix(in srgb, var(--accent), var(--world-shade) 16%)' }} />
      <path d="M28 9 16 15v14l12-6Z" style={{ fill: 'color-mix(in srgb, var(--accent), var(--world-shade) 30%)' }} />
    </svg>
  );
}

/** 상단 바: 로고, 메뉴(홈·스테이지·자유 Verilog·도감), 소리·테마. (최종계획서 5.1, 게이트 입구 계획 8.1) */
export function TopBar({ current }: { current: string }) {
  const sound = useProgress((p) => p.sound);
  const setSound = useProgress((p) => p.setSound);
  const last = useProgress((p) => p.last);
  // 홈이 아닌 화면에서는 마지막으로 연 스테이지로 한 번에 돌아간다 (걷기 박자와 상단 바 계획 6.5)
  const resume = current !== 'home' && last ? stageById(last) : undefined;
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark');

  useEffect(() => {
    if (dark) document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
  }, [dark]);

  return (
    <header className={s.bar}>
      <a className={s.brand} href="#/" aria-label="KW STUDY SITE 홈">
        <CubeLogo />
        <span>
          <b className={s.kw}>KW</b> STUDY SITE
        </span>
      </a>
      <nav className={s.nav} aria-label="메뉴">
        {NAV.map((n) => (
          <a key={n.name} href={n.href} className={s.link} aria-current={current === n.name ? 'page' : undefined}>
            {n.label}
          </a>
        ))}
      </nav>
      <div className={s.tools}>
        {resume && (
          <a className={s.resume} href={`#/play/${resume.id}`} aria-label={`${resume.no} ${resume.title} 이어서 하기`}>
            {resume.no} 이어서
          </a>
        )}
        <IconButton label={sound ? '소리 끄기' : '소리 켜기'} pressed={sound} onClick={() => setSound(!sound)}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 8h3l4-3v10l-4-3H3Z" fill="currentColor" />
            {sound ? (
              <path d="M13 7a4 4 0 0 1 0 6M15 5a7 7 0 0 1 0 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            ) : (
              <path d="m13 8 4 4m0-4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            )}
          </svg>
        </IconButton>
        <IconButton label={dark ? '밝은 테마' : '어두운 테마'} pressed={dark} onClick={() => setDark(!dark)}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            {dark ? (
              <path d="M15 12.5A6 6 0 0 1 7.5 5a6 6 0 1 0 7.5 7.5Z" fill="currentColor" />
            ) : (
              <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="10" cy="10" r="3.5" />
                <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" />
              </g>
            )}
          </svg>
        </IconButton>
      </div>
    </header>
  );
}
