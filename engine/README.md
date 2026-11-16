# engine/

브라우저에서 도는 Icarus Verilog(WebAssembly)와 그 검증을 둔다. (최종계획서 2.2, 9.5, 13.1, 15.1)

## 라이선스

Icarus Verilog는 GPL-2.0-or-later다. 이 폴더의 엔진 관련 파일과 엔진에 넣는 패치는 GPL을 따르고, 전문은 [`COPYING`](COPYING)에 있다.
앱 코드(`src/` 등)는 엔진을 별도 프로그램으로 불러 쓰기만 하므로 MIT다.

## 사이트가 싣는 엔진

[`engine-v0.1.0`](https://github.com/Setter1324/StudyVerilog/releases/tag/engine-v0.1.0) Release다. `engine.yml`이 `build/`의 스크립트로 Icarus Verilog `c7530db`를 빌드하고 골든 6개를 통과한 뒤 올렸다. 고정한 주소와 해시는 [`engine.lock.json`](engine.lock.json)에 있고, 빌드·CI는 `node engine/fetch-engine.mjs <폴더>`로 받는다.

새 엔진을 낼 때는 `engine/build/`를 고치는 PR을 합친 뒤, Actions → engine → Run workflow에 `release_tag`(예: `engine-v0.2.0`)를 넣어 실행하고 `engine.lock.json`을 바꾼다.

## 0단계 엔진 검증 (기록)

0단계에서는 [VeriSim](https://github.com/senolgulgonul/verisim)(GPL-2.0)이 빌드한 wasm을 그대로 쓴다.

- 고정한 커밋과 파일 해시: [`verisim.lock.json`](verisim.lock.json)
  - Icarus Verilog 14.0 (devel), upstream 커밋 `c7530db`, Emscripten 6.0.0
  - 소스와 패치: VeriSim 저장소의 `build/build.sh`, `build/iverilog-wasm.patch`
- 받기: `node engine/fetch-engine.mjs engine/.cache/verisim engine/verisim.lock.json` (해시를 확인한다)
- 지금은 비교용 기록이다. 사이트는 위의 Release를 싣는다.

## 골든 테스트

`golden/` 아래 프로그램 6개를 네이티브 Icarus Verilog와 브라우저 엔진으로 돌려 비교한다. CI의 `golden` 작업이 한다.

| 파일 | 하는 일 |
| --- | --- |
| `golden/NN-이름/testbench.sv`, `design.sv` | 골든 프로그램. 수업 문법으로 새로 쓴 짧은 코드 |
| `golden/NN-이름/native/` | 네이티브(Icarus Verilog 12.0, ubuntu)의 `log.txt`와 `dump.vcd`. CI 로그에서 옮긴 기준 결과. 나중에 `FixtureRunner`와 예측형 스테이지가 쓴다 |
| `golden/NN-이름/case.json` | 제목과 검사(`signalAt`, `logIncludes`, `end`, `hasSignal`, `noSignal`, `sameWaveform`) |
| `golden/run-native.sh` | `iverilog -g2012` → `vvp -n`. CI(ubuntu)에서 `apt-get install iverilog` |
| `golden/run-wasm.mjs` | `src/runner/iverilog.ts`로 ivlpp → ivl → vvp를 Node에서 돌린다. 브라우저 워커와 같은 코드다 |
| `golden/compare.mjs` | 로그(경로만 정규화)와 VCD 신호 변화를 비교하고 검사를 돌린다. 표를 Actions 요약에 쓴다 |

판정 기준: 컴파일 성공, 로그 같음, VCD 신호 변화 같음, 검사가 양쪽 모두 통과. VCD 원문(날짜·버전 줄 제외)이 같은지는 참고로 적는다.

### 결과 (2026-11-16, PR #2)

네이티브 Icarus Verilog 12.0 (ubuntu apt)과 VeriSim wasm (14.0 devel, `c7530db`)이 6개 모두 같았다.

| # | 확인하는 것 | 로그 | VCD 신호 | VCD 원문 | 검사 | wasm 실행 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `assign` OR·AND, `$monitor`의 `%3t` | 같음 | 같음 | 같음 | 5/5 | 179 ms (첫 실행) |
| 2 | `or #3`, `and #2`: t=14에 E=0, t=15에 E=1 | 같음 | 같음 | 같음 | 8/8 | 52 ms |
| 3 | 초기화 안 한 reg가 `x` | 같음 | 같음 | 같음 | 7/7 | 19 ms |
| 4 | `always #10`과 `$finish` (95에 끝남) | 같음 | 같음 | 같음 | 5/5 | 16 ms |
| 5 | `repeat`와 `forever`가 같은 자극 | 같음 | 같음 | 같음 | 4/4 | 16 ms |
| 6 | `$dumpvars(1)`: `test.ha.*`는 VCD에 없음 | 같음 | 같음 | 다름(*) | 5/5 | 15 ms |
| 7 | 범위 없는 `$dumpvars(1)`, 한글 `$display` (스테이지 1-7, 1-14) | 같음(**) | 같음 | 같음 | 7/7 | 16 ms |

(*) 같은 시각 안에서 값 변화 줄의 순서만 다르다(t=30에서 `0!`·`1"` 대 `1"`·`0!`). 신호 값은 같다. 그래서 판정은 원문이 아니라 신호 변화로 한다.

(**) 알려진 버전 차이: 네이티브 12.0은 `-g2012`에서 범위 없는 `$dumpvars(1)`에 `VCD warning: $dumpvars: Package ($unit) is not dumpable with VCD.` 한 줄을 더 찍는다. wasm(14.0 devel)은 찍지 않는다. VCD에 담기는 신호와 값은 같다. `compare.mjs`의 `KNOWN_LOG_DIFFS`가 비교할 때만 이 줄을 뺀다. 수업 화면(EDA Playground)이 12.0이면 학생은 이 경고를 볼 수 있으니 도감에 적는다.

로컬에서 돌리려면(리눅스나 WSL, iverilog 설치 필요):

```bash
node engine/fetch-engine.mjs engine/.cache/engine
bash engine/golden/run-native.sh engine/golden engine/.out/native
node engine/golden/run-wasm.mjs engine/.cache/engine engine/golden engine/.out/wasm
node engine/golden/compare.mjs engine/golden engine/.out
```

Node 22.18 이상이 필요하다(`.ts`를 타입 제거로 바로 불러온다).
