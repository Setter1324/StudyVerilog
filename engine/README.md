# engine/

브라우저에서 도는 Icarus Verilog(WebAssembly)와 그 검증을 둔다. (최종계획서 2.2, 9.5, 13.1, 15.1)

## 라이선스

Icarus Verilog는 GPL-2.0-or-later다. 이 폴더의 엔진 관련 파일과 엔진에 넣는 패치는 GPL을 따르고, 전문은 [`COPYING`](COPYING)에 있다.
앱 코드(`src/` 등)는 엔진을 별도 프로그램으로 불러 쓰기만 하므로 MIT다.

## 지금 상태: 0단계 엔진 검증

0단계에서는 [VeriSim](https://github.com/senolgulgonul/verisim)(GPL-2.0)이 빌드한 wasm을 그대로 쓴다.

- 고정한 커밋과 파일 해시: [`verisim.lock.json`](verisim.lock.json)
  - Icarus Verilog 14.0 (devel), upstream 커밋 `c7530db`, Emscripten 6.0.0
  - 소스와 패치: VeriSim 저장소의 `build/build.sh`, `build/iverilog-wasm.patch`
- 받기: `node engine/fetch-verisim.mjs engine/.cache/verisim` (해시를 확인한다)
- 아직 사이트에는 싣지 않는다. 사이트에 싣는 엔진은 `engine.yml`로 직접 빌드해 Release 자산으로 올린 것을 쓴다(14.2의 2번 후반).

## 골든 테스트

`golden/` 아래 프로그램 6개를 네이티브 Icarus Verilog와 브라우저 엔진으로 돌려 비교한다. CI의 `golden` 작업이 한다.

| 파일 | 하는 일 |
| --- | --- |
| `golden/NN-이름/testbench.sv`, `design.sv` | 골든 프로그램. 수업 문법으로 새로 쓴 짧은 코드 |
| `golden/NN-이름/case.json` | 제목과 검사(`signalAt`, `logIncludes`, `end`, `hasSignal`, `noSignal`, `sameWaveform`) |
| `golden/run-native.sh` | `iverilog -g2012` → `vvp -n`. CI(ubuntu)에서 `apt-get install iverilog` |
| `golden/run-wasm.mjs` | `src/runner/iverilog.ts`로 ivlpp → ivl → vvp를 Node에서 돌린다. 브라우저 워커와 같은 코드다 |
| `golden/compare.mjs` | 로그(경로만 정규화)와 VCD 신호 변화를 비교하고 검사를 돌린다. 표를 Actions 요약에 쓴다 |

판정 기준: 컴파일 성공, 로그 같음, VCD 신호 변화 같음, 검사가 양쪽 모두 통과. VCD 원문(날짜·버전 줄 제외)이 같은지는 참고로 적는다.

로컬에서 돌리려면(리눅스나 WSL, iverilog 설치 필요):

```bash
node engine/fetch-verisim.mjs engine/.cache/verisim
bash engine/golden/run-native.sh engine/golden engine/.out/native
node engine/golden/run-wasm.mjs engine/.cache/verisim engine/golden engine/.out/wasm
node engine/golden/compare.mjs engine/golden engine/.out
```

Node 22.18 이상이 필요하다(`.ts`를 타입 제거로 바로 불러온다).
