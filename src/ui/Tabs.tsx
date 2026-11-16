import { useRef, type KeyboardEvent } from 'react';
import s from './Tabs.module.css';

export interface TabItem {
  id: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** 탭 목록 이름. 예: "파일" */
  label: string;
  /** 탭 패널 id 앞부분. 패널은 `${idPrefix}-${item.id}` id를 쓴다 */
  idPrefix?: string;
}

/** 파일 탭(design.sv, testbench.sv). 왼쪽·오른쪽 화살표로 옮긴다. (최종계획서 7.7) */
export function Tabs({ items, value, onChange, label, idPrefix = 'tab' }: TabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, index: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (index + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const item = items[next];
    if (item) onChange(item.id);
    refs.current[next]?.focus();
  };

  return (
    <div className={s.list} role="tablist" aria-label={label}>
      {items.map((item, i) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${item.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-${item.id}`}
            tabIndex={selected ? 0 : -1}
            className={selected ? `${s.tab} ${s.selected}` : s.tab}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
