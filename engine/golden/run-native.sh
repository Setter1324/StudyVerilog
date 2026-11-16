#!/usr/bin/env bash
# 골든 프로그램을 네이티브 Icarus Verilog로 돌린다. (최종계획서 13.1)
# 사용: bash engine/golden/run-native.sh <골든 폴더> <결과 폴더>
set -uo pipefail
GOLDEN=$(cd "$1" && pwd)
mkdir -p "$2"
OUT=$(cd "$2" && pwd)
iverilog -V 2>&1 | head -n 1 > "$OUT/VERSION"
for dir in "$GOLDEN"/[0-9]*/; do
  name=$(basename "$dir")
  work=$(mktemp -d)
  cp "$dir"/*.sv "$work"/
  files=()
  for f in design.sv testbench.sv; do
    if [ -f "$work/$f" ]; then files+=("$f"); fi
  done
  mkdir -p "$OUT/$name"
  (cd "$work" && iverilog -g2012 -o sim.vvp "${files[@]}") > "$OUT/$name/compile.txt" 2>&1
  rc=$?
  ok=false
  if [ $rc -eq 0 ]; then
    ok=true
    (cd "$work" && timeout 20 vvp -n sim.vvp) > "$OUT/$name/log.txt" 2>&1
    if [ -f "$work/dump.vcd" ]; then cp "$work/dump.vcd" "$OUT/$name/dump.vcd"; fi
  fi
  printf '{ "ok": %s }\n' "$ok" > "$OUT/$name/status.json"
  echo "native $name: compile rc=$rc"
  rm -rf "$work"
done
