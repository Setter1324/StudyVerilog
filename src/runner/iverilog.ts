// Icarus Verilog의 세 프로그램(ivlpp → ivl → vvp)을 차례로 부른다. (최종계획서 2.2, 9.2)
// 브라우저 워커(WasmRunner)와 Node 골든 테스트(engine/golden/run-wasm.mjs)가 같이 쓴다.
// 엔진 모듈은 인자로 받으므로 이 파일은 엔진 파일 위치를 모른다.
// Node의 타입 제거 실행으로도 불리므로 타입 import 외의 import와 enum 등을 쓰지 않는다.
import type { Diagnostic } from './types';

/** Emscripten 모듈에서 쓰는 부분만 적었다. */
export interface EmModule {
  FS: {
    writeFile(path: string, data: string | Uint8Array): void;
    readFile(path: string, opts: { encoding: 'utf8' }): string;
    readFile(path: string): Uint8Array;
  };
  callMain(args: string[]): number | void;
}

export type EmFactory = (opts: {
  print: (s: string) => void;
  printErr: (s: string) => void;
}) => Promise<EmModule>;

export interface IverilogModules {
  ivlpp: EmFactory;
  ivl: EmFactory;
  vvp: EmFactory;
}

export type Generation = '2005' | '2009' | '2012';

export interface IverilogFile {
  name: string;
  text: string;
}

export interface IverilogOutput {
  ok: boolean; // 컴파일 성공 여부
  stage: 'compile' | 'run';
  compileLog: string; // ivlpp, ivl의 오류와 경고
  log: string; // vvp 출력 ($monitor, $display, VCD info, $finish 안내)
  diagnostics: Diagnostic[];
  vcd?: string;
}

/** iverilog 드라이버가 ivl에 넘기는 설정 파일을 흉내 낸다. */
export function ivlConf(generation: Generation): string {
  return [
    'basedir:/',
    'module:system.vpi',
    `generation:${generation}`,
    'generation:no-specify',
    'out:/out.vvp',
    'iwidth:32',
    'widthcap:65536',
    'functor:cprop',
    'functor:nodangle',
    'flag:DLL=vvp.tgt',
    '',
  ].join('\n');
}

const DIAG = /^\/?([^:\s]+):(\d+):\s*(.*)$/;

/** "testbench.sv:5: syntax error" 같은 줄을 진단으로 바꾼다. */
export function parseDiagnostics(text: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const line of text.split('\n')) {
    const m = DIAG.exec(line.trim());
    if (m) out.push({ file: m[1] ?? '', line: Number(m[2]), message: m[3] ?? '' });
  }
  return out;
}

function call(m: EmModule, args: string[]): number {
  try {
    const rc = m.callMain(args);
    return typeof rc === 'number' ? rc : 0;
  } catch (e) {
    // exit()는 ExitStatus를 던질 수 있다
    const status = (e as { status?: unknown }).status;
    if (typeof status === 'number') return status;
    throw e;
  }
}

/** 이 포트가 정적 링크라서 생기는, 결과와 상관없는 안내 줄 */
const NOISE = /dynamic linking not enabled|system\.vpi/;

export async function runIverilog(
  mods: IverilogModules,
  files: IverilogFile[],
  opts: { generation?: Generation; vcdPath?: string } = {},
): Promise<IverilogOutput> {
  const generation = opts.generation ?? '2012';
  const vcdPath = opts.vcdPath ?? '/dump.vcd';
  const errs: string[] = [];

  // 1. ivlpp: 모든 파일을 한 번에 전처리한다. -L은 `line 지시문을 남겨 오류가 원래 파일과 줄을 가리키게 한다.
  const pp: string[] = [];
  const m1 = await mods.ivlpp({ print: (s) => pp.push(s), printErr: (s) => errs.push(s) });
  const args = ['-L'];
  for (const f of files) {
    m1.FS.writeFile('/' + f.name, f.text.endsWith('\n') ? f.text : f.text + '\n');
    args.push('/' + f.name);
  }
  call(m1, args);

  // 2. ivl: 컴파일해서 .vvp를 만든다.
  const m2 = await mods.ivl({ print: (s) => errs.push(s), printErr: (s) => errs.push(s) });
  m2.FS.writeFile('/ivl.conf', ivlConf(generation));
  m2.FS.writeFile('/src.v', pp.join('\n') + '\n');
  call(m2, ['-C/ivl.conf', '--', '/src.v']);
  let program: Uint8Array | undefined;
  try {
    program = m2.FS.readFile('/out.vvp');
  } catch {
    program = undefined;
  }
  const compileLog = errs.filter((l) => !NOISE.test(l)).join('\n');
  const diagnostics = parseDiagnostics(compileLog);
  if (!program) {
    return { ok: false, stage: 'compile', compileLog, log: '', diagnostics };
  }

  // 3. vvp: 실행한다.
  const out: string[] = [];
  const m3 = await mods.vvp({ print: (s) => out.push(s), printErr: (s) => out.push(s) });
  m3.FS.writeFile('/sim.vvp', program);
  call(m3, ['/sim.vvp']);
  let vcd: string | undefined;
  try {
    vcd = m3.FS.readFile(vcdPath, { encoding: 'utf8' });
  } catch {
    vcd = undefined;
  }
  return { ok: true, stage: 'run', compileLog, log: out.join('\n'), diagnostics, vcd };
}
