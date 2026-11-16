// 스테이지 JSON 검증: 정답 예시(solution)는 통과하고, 시작 코드는 통과하지 않아야 한다. (최종계획서 8.5, 14.3)
// 사용: node engine/golden/stages.mjs <엔진 폴더> <스테이지 폴더>
import { appendFile, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { extraModules, runIverilog } from '../../src/runner/iverilog.ts';
import { gradeStage, stageSources } from '../../src/sim/stage.ts';
import { buildTimeline } from '../../src/sim/vcd.ts';

const [engineDir, stageDir] = process.argv.slice(2).map((p) => path.resolve(p));
const load = async (name) => (await import(pathToFileURL(path.join(engineDir, `${name}.js`)).href)).default;
const mods = { ivlpp: await load('ivlpp'), ivl: await load('ivl'), vvp: await load('vvp') };

async function attempt(data, values) {
  const files = stageSources(data, values);
  const out = await runIverilog(mods, [...files, ...extraModules(files, data.top, 10_000)], { generation: '2012' });
  if (!out.ok || !out.vcd) return { pass: false, why: `컴파일 실패: ${out.compileLog.split('\n')[0]}` };
  const tl = buildTimeline(out.vcd, out.log);
  const g = gradeStage(data, values, tl);
  return { pass: g.pass, why: g.failures.map((f) => f.message).join('; ') || '통과' };
}

const rows = [];
let ok = true;
for (const f of (await readdir(stageDir)).filter((n) => n.endsWith('.json')).sort()) {
  const data = JSON.parse(await readFile(path.join(stageDir, f), 'utf8'));
  if (!data.solution) {
    rows.push(`| ${data.id} | ${data.type} | 정답 예시 없음 | - |`);
    ok = false;
    continue;
  }
  const sol = await attempt(data, data.solution);
  const needsStartFail = ['fill', 'fix', 'convert', 'design'].includes(data.type);
  const start = needsStartFail ? await attempt(data, {}) : { pass: false, why: '(답을 고르기 전)' };
  const good = sol.pass && !start.pass;
  if (!good) ok = false;
  rows.push(`| ${data.id} | ${data.type} | ${sol.pass ? '통과' : '**실패**: ' + sol.why} | ${start.pass ? '**통과해 버림**' : start.why} | ${good ? '좋음' : '**문제**'} |`);
}

const report = ['## 스테이지 검증', '', '| 스테이지 | 유형 | 정답 예시 | 시작 코드 | 판정 |', '| --- | --- | --- | --- | --- |', ...rows, ''].join('\n');
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, report + '\n');
process.exit(ok ? 0 : 1);
