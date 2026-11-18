// 자유 Verilog의 최상위 모듈 찾기. (순차 재생과 게이트 입구 계획 8.1)
// 다른 모듈이 인스턴스로 쓰지 않은 모듈이 최상위다. 여럿이면 initial이 있는 것, 그래도 여럿이면 마지막 것.
// 플레이 화면과 Node 검증이 같이 쓸 수 있게 import에 .ts를 붙이고 런타임 TS 문법을 쓰지 않는다.
import { stripComments } from './grade.ts';

const ID = '[A-Za-z_][\\w$]*';

export interface ModuleInfo {
  name: string;
  /** module 줄부터 endmodule까지 */
  body: string;
}

/** 소스의 모듈들(나온 순서대로). 주석은 지운다 */
export function modulesOf(source: string): ModuleInfo[] {
  const code = stripComments(source);
  const out: ModuleInfo[] = [];
  const re = new RegExp(`\\b(?:module|macromodule)\\s+(${ID})([\\s\\S]*?)\\bendmodule\\b`, 'g');
  for (const m of code.matchAll(re)) out.push({ name: m[1]!, body: m[2]! });
  return out;
}

/** 모듈 body 안에서 name을 인스턴스로 쓰는가: `name [#(...)] inst [범위] (` */
function instantiates(body: string, name: string): boolean {
  const esc = name.replace(/\$/g, '\\$');
  const re = new RegExp(`(?:^|[;\\s])${esc}\\s*(?:#\\s*\\((?:[^()]|\\([^()]*\\))*\\)\\s*)?${ID}\\s*(?:\\[[^\\]]*\\]\\s*)?\\(`, 'm');
  return re.test(body);
}

/** 최상위 모듈 이름. 모듈이 없으면 undefined */
export function findTop(source: string): string | undefined {
  const mods = modulesOf(source);
  if (!mods.length) return undefined;
  const used = new Set<string>();
  for (const a of mods) for (const b of mods) if (a !== b && instantiates(b.body, a.name)) used.add(a.name);
  const roots = mods.filter((m) => !used.has(m.name));
  const pool = roots.length ? roots : mods;
  const withInitial = pool.filter((m) => /\binitial\b/.test(m.body));
  const pick = withInitial.length ? withInitial : pool;
  return pick[pick.length - 1]!.name;
}
