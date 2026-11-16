// 화면 코드는 Runner와 Timeline만 안다. 엔진을 바꿔도 화면은 그대로다. (최종계획서 9.2, 14.3)
export interface RunRequest {
  files: { name: string; text: string }[]; // design.sv, testbench.sv
  top: string; // 최상위 모듈 이름
  limits?: { simTime?: number; logLines?: number; wallMs?: number };
}

export interface Diagnostic {
  file: string;
  line: number;
  message: string;
}

export interface RunResult {
  ok: boolean; // 컴파일 성공 여부
  stage: 'compile' | 'run';
  log: string; // $monitor, $display 출력
  diagnostics: Diagnostic[];
  vcd?: string; // dump.vcd 원문
  timedOut: boolean;
}

export interface Runner {
  run(req: RunRequest): Promise<RunResult>;
}

// 시작값 (9.5절). 쓰면서 조정한다.
export const DEFAULT_LIMITS = { simTime: 10_000, logLines: 2_000, wallMs: 5_000 } as const;
