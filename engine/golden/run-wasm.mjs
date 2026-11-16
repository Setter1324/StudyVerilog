// 골든 프로그램을 브라우저와 같은 wasm 엔진으로 Node에서 돌린다. (최종계획서 13.1)
// 사용: node engine/golden/run-wasm.mjs <엔진 폴더> <골든 폴더> <결과 폴더>
// src/runner/iverilog.ts를 Node의 타입 제거 실행으로 불러온다(Node 22.18 이상).
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runIverilog } from '../../src/runner/iverilog.ts';

const [engineDir, goldenDir, outDir] = process.argv.slice(2).map((p) => path.resolve(p));
const load = async (name) =>
  (await import(pathToFileURL(path.join(engineDir, `${name}.js`)).href)).default;
const mods = { ivlpp: await load('ivlpp'), ivl: await load('ivl'), vvp: await load('vvp') };

await mkdir(outDir, { recursive: true });
const built = existsSync(path.join(engineDir, 'IVERILOG_COMMIT'))
  ? (await readFile(path.join(engineDir, 'IVERILOG_COMMIT'), 'utf8')).trim()
  : '';
await writeFile(
  path.join(outDir, 'VERSION'),
  built
    ? `직접 빌드한 wasm (Icarus Verilog ${built.slice(0, 7)}, engine/build)\n`
    : 'VeriSim wasm (Icarus Verilog 14.0 devel, c7530db)\n',
);

const cases = (await readdir(goldenDir, { withFileTypes: true }))
  .filter((d) => d.isDirectory() && /^\d/.test(d.name))
  .map((d) => d.name)
  .sort();

for (const name of cases) {
  const dir = path.join(goldenDir, name);
  const files = [];
  for (const f of ['design.sv', 'testbench.sv']) {
    if (existsSync(path.join(dir, f))) files.push({ name: f, text: await readFile(path.join(dir, f), 'utf8') });
  }
  const out = path.join(outDir, name);
  await mkdir(out, { recursive: true });
  const t0 = performance.now();
  const res = await runIverilog(mods, files, { generation: '2012' });
  const ms = Math.round(performance.now() - t0);
  await writeFile(path.join(out, 'compile.txt'), res.compileLog);
  await writeFile(path.join(out, 'log.txt'), res.log);
  if (res.vcd !== undefined) await writeFile(path.join(out, 'dump.vcd'), res.vcd);
  await writeFile(path.join(out, 'status.json'), JSON.stringify({ ok: res.ok, ms }) + '\n');
  console.log(`wasm ${name}: ok=${res.ok} ${ms}ms`);
}
