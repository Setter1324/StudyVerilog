// 기본 Runner: Web Worker 안의 Icarus Verilog. (최종계획서 9.2)
import { DEFAULT_LIMITS, type RunRequest, type RunResult, type Runner } from './types';
import type { WorkerRequest, WorkerResponse } from './worker';

export class WasmRunner implements Runner {
  private worker: Worker | null = null;
  private seq = 0;

  private spawn(): Worker {
    this.worker ??= new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    return this.worker;
  }

  /** 엔진 파일을 미리 받아 둔다(첫 화면이나 플레이 화면에 들어올 때) */
  warmUp(): void {
    void this.run({ files: [{ name: 'warm.v', text: 'module warm; endmodule\n' }], top: 'warm' }).catch(() => undefined);
  }

  run(req: RunRequest): Promise<RunResult> {
    const limits = { ...DEFAULT_LIMITS, ...req.limits };
    const worker = this.spawn();
    const id = ++this.seq;
    return new Promise<RunResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        // 끝나지 않는 코드: 워커를 끝내고 새로 만든다 (9.5)
        worker.terminate();
        if (this.worker === worker) this.worker = null;
        cleanup();
        resolve({ ok: true, stage: 'run', log: '', diagnostics: [], timedOut: true });
      }, limits.wallMs + 15_000 /* 첫 실행은 엔진을 받는 시간까지 */);
      const onMessage = (e: MessageEvent<WorkerResponse>) => {
        if (e.data.id !== id) return;
        cleanup();
        if (e.data.result) resolve(e.data.result);
        else reject(new Error(e.data.error ?? '엔진 오류'));
      };
      const onError = (e: ErrorEvent) => {
        cleanup();
        if (this.worker === worker) this.worker = null;
        reject(new Error(e.message || '엔진을 불러오지 못했어요'));
      };
      const cleanup = () => {
        clearTimeout(timer);
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
      };
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      const msg: WorkerRequest = {
        id,
        base: import.meta.env.BASE_URL,
        req,
        simTime: limits.simTime,
        logLines: limits.logLines,
      };
      worker.postMessage(msg);
    });
  }
}
