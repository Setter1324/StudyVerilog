// 진행도: 브라우저에만 저장한다. 로그인과 서버는 없다. (최종계획서 2장 결정 7, 5.2)
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** 저장이 되는 브라우저인가 (사생활 보호 모드 등에서는 안 될 수 있다) */
export const storageAvailable = (() => {
  try {
    if (typeof window === 'undefined') return false;
    const k = '__kwss_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
})();

interface ProgressState {
  /** 마지막으로 연 스테이지 id */
  last: string | null;
  /** 통과한 스테이지 id */
  done: Record<string, true>;
  sound: boolean;
  open: (id: string) => void;
  pass: (id: string) => void;
  setSound: (on: boolean) => void;
  reset: () => void;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      last: null,
      done: {},
      sound: false,
      open: (id) => set({ last: id }),
      pass: (id) => set((s) => ({ done: { ...s.done, [id]: true } })),
      setSound: (on) => set({ sound: on }),
      reset: () => set({ last: null, done: {} }),
    }),
    {
      name: 'kwss-progress',
      version: 1,
      storage: createJSONStorage(() => (storageAvailable ? window.localStorage : memoryStorage())),
    },
  ),
);

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}
