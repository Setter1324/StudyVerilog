import { useEffect, useId, useRef, type ReactNode } from 'react';
import s from './Sheet.module.css';

export interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** 아래쪽 버튼 줄 */
  actions?: ReactNode;
}

/** 플레이 위에 뜨는 판(결과, 설정). Esc로 닫고, 열리면 판 안으로 초점을 옮긴다. (최종계획서 4장, 7.7) */
export function Sheet({ open, title, onClose, children, actions }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const panel = ref.current;
    const first = panel?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    (first ?? panel)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab' && panel) {
        // 초점을 판 안에 가둔다
        const items = panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const a = items[0];
        const b = items[items.length - 1];
        if (!a || !b) return;
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault();
          b.focus();
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault();
          a.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      before?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className={s.scrim} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={s.panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <h2 id={titleId} className={s.title}>
          {title}
        </h2>
        <div className={s.body}>{children}</div>
        {actions && <div className={s.actions}>{actions}</div>}
      </div>
    </div>
  );
}
