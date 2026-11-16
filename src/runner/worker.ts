// Web Worker 안에서 Icarus Verilog(wasm)를 돌린다. (최종계획서 9.2, 9.5)
// 엔진 파일은 사이트의 engine/ 폴더에서 처음 실행할 때 받고, 브라우저 캐시에 둔다.
import { extraModules, runIverilog, type EmFactory, type IverilogModules } from './iverilog';
import type { RunRequest, RunResult } from './types';

declare const self: DedicatedWorkerGlobalScope;

let mods: Promise<IverilogModules> | null = null;

function load(base: string): Promise<IverilogModules> {
  const url = (name: string) => new URL(`${base}engine/${name}.js`, self.location.href).href;
  const one = async (name: string) => (await import(/* @vite-ignore */ url(name))).default as EmFactory;
  return Promise.all([one('ivlpp'), one('ivl'), one('vvp')]).then(([ivlpp, ivl, vvp]) => ({ ivlpp, ivl, vvp }));
}

export interface WorkerRequest {
  id: number;
  base: string;
  req: RunRequest;
  /** 덤프 모듈을 붙일 때 쓸 최상위 모듈 */
  dumpTop?: string;
  simTime: number;
  logLines: number;
}

export interface WorkerResponse {
  id: number;
  result?: RunResult;
  error?: string;
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, base, req, simTime, logLines } = e.data;
  try {
    mods ??= load(base);
    const m = await mods;
    const files = [...req.files, ...extraModules(req.files, req.top, simTime)];
    const out = await runIverilog(m, files, { generation: '2012' });
    let log = out.log;
    const lines = log.split('\n');
    if (lines.length > logLines) log = lines.slice(0, logLines).join('\n') + '\n…';
    const guard = /__kwss_guard\.v:\d+: \$finish called/.test(out.log);
    // 감시 모듈과 덤프 모듈의 흔적은 사용자에게 보이지 않는다
    log = log
      .split('\n')
      .filter((l) => !/__kwss_guard|__kwss_dump/.test(l))
      .join('\n');
    // 파일 경로는 수업 화면처럼 이름만 보인다 (/testbench.sv:14 → testbench.sv:14)
    const strip = (text: string) => text.replace(/(^|[\s(])\/([\w.-]+\.s?v):/gm, '$1$2:');
    const result: RunResult = {
      ok: out.ok,
      stage: out.stage,
      log: strip(out.ok ? log : out.compileLog),
      diagnostics: out.diagnostics.filter((d) => !d.file.startsWith('__kwss')),
      vcd: out.vcd,
      timedOut: guard,
    };
    self.postMessage({ id, result } satisfies WorkerResponse);
  } catch (err) {
    mods = null;
    self.postMessage({ id, error: String(err) } satisfies WorkerResponse);
  }
};
