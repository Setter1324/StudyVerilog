// 네이티브와 wasm 결과를 비교하고 case.json의 검사를 돌린다. (최종계획서 13.1)
// 사용: node engine/golden/compare.mjs <골든 폴더> <결과 폴더(native/, wasm/ 를 담은)>
// 판정: 로그(정규화 후)와 VCD 신호 변화가 같고, 검사가 양쪽에서 모두 통과해야 한다.
// VCD 원문 일치(날짜·버전 줄 제외)는 참고로만 적는다.
import { appendFile, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseVcd, valueAt } from '../../src/sim/vcd.ts';

const [goldenDir, outDir] = process.argv.slice(2).map((p) => path.resolve(p));

const read = async (p) => {
  try {
    return await readFile(p, 'utf8');
  } catch {
    return undefined;
  }
};

/**
 * 알려진 버전 차이(engine/README.md). 비교할 때만 지우고, 신호와 VCD는 그대로 비교한다.
 * - 네이티브 12.0은 -g2012에서 범위 없는 $dumpvars(1)에 $unit 경고를 찍고, 14.0 devel(wasm)은 찍지 않는다(골든 7, 스테이지 1-14)
 */
export const KNOWN_LOG_DIFFS = [/^VCD warning: \$dumpvars: Package \(\$unit\) is not dumpable with VCD\.$/];

/** 경로를 파일 이름만 남기고, 줄 끝 공백과 빈 줄을 정리한다. */
export function normalizeLog(text) {
  return (text ?? '')
    .split('\n')
    .map((l) => l.replace(/(^|[\s(])(?:\/?[^\s:()]*\/)?([\w.-]+\.s?v):(\d+)/g, '$1$2:$3').replace(/\s+$/, ''))
    .filter((l) => l !== '')
    .join('\n');
}

/** 비교용: 알려진 버전 차이 줄을 뺀다 */
const comparable = (log) =>
  log
    .split('\n')
    .filter((l) => !KNOWN_LOG_DIFFS.some((re) => re.test(l)))
    .join('\n');

/** $date, $version, $comment 블록을 지우고 공백을 하나로 모은다. */
export function normalizeVcdText(text) {
  return (text ?? '')
    .replace(/\$(date|version|comment)[\s\S]*?\$end/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

function runChecks(checks, vcd, log) {
  const failures = [];
  for (const c of checks) {
    const sig = (name) => vcd?.signals[name];
    if (c.kind === 'signalAt') {
      const got = valueAt(sig(c.signal), c.time);
      if (got !== c.value) failures.push(`${c.signal}@${c.time}=${got || '(없음)'}, 기대 ${c.value}`);
    } else if (c.kind === 'logIncludes') {
      if (!log.includes(c.text)) failures.push(`로그에 "${c.text}" 없음`);
    } else if (c.kind === 'end') {
      if (vcd?.end !== c.time) failures.push(`끝 시각 ${vcd?.end}, 기대 ${c.time}`);
    } else if (c.kind === 'hasSignal') {
      if (!sig(c.signal)) failures.push(`${c.signal} 없음`);
    } else if (c.kind === 'noSignal') {
      if (sig(c.signal)) failures.push(`${c.signal}가 있으면 안 됨`);
    } else if (c.kind === 'sameWaveform') {
      const a = JSON.stringify(sig(c.a)?.changes);
      const b = JSON.stringify(sig(c.b)?.changes);
      if (!a || a !== b) failures.push(`${c.a}와 ${c.b}의 파형이 다름`);
    } else {
      failures.push(`모르는 검사 ${c.kind}`);
    }
  }
  return failures;
}

async function side(kind, name) {
  const dir = path.join(outDir, kind, name);
  const status = JSON.parse((await read(path.join(dir, 'status.json'))) ?? '{"ok":false}');
  const log = normalizeLog(await read(path.join(dir, 'log.txt')));
  const vcdText = await read(path.join(dir, 'dump.vcd'));
  const vcd = vcdText ? parseVcd(vcdText) : undefined;
  return { status, log, vcdText, vcd, compile: (await read(path.join(dir, 'compile.txt'))) ?? '' };
}

const cases = (await readdir(goldenDir, { withFileTypes: true }))
  .filter((d) => d.isDirectory() && /^\d/.test(d.name))
  .map((d) => d.name)
  .sort();

const yes = (b) => (b ? '같음' : '**다름**');
const rows = [];
const details = [];
let allPass = true;

for (const name of cases) {
  const spec = JSON.parse(await readFile(path.join(goldenDir, name, 'case.json'), 'utf8'));
  const n = await side('native', name);
  const w = await side('wasm', name);
  const compiled = n.status.ok && w.status.ok;
  const logSame = comparable(n.log) === comparable(w.log);
  const sigSame =
    !!n.vcd && !!w.vcd && n.vcd.end === w.vcd.end && JSON.stringify(n.vcd.signals) === JSON.stringify(w.vcd.signals);
  const rawSame = !!n.vcdText && normalizeVcdText(n.vcdText) === normalizeVcdText(w.vcdText);
  const nFail = runChecks(spec.checks ?? [], n.vcd, n.log);
  const wFail = runChecks(spec.checks ?? [], w.vcd, w.log);
  const pass = compiled && logSame && sigSame && nFail.length === 0 && wFail.length === 0;
  if (!pass) allPass = false;
  const checks = `${(spec.checks?.length ?? 0) - nFail.length}/${spec.checks?.length ?? 0} · ${(spec.checks?.length ?? 0) - wFail.length}/${spec.checks?.length ?? 0}`;
  rows.push(
    `| ${name.slice(0, 2)} | ${spec.title} | ${compiled ? '성공' : '**실패**'} | ${yes(logSame)} | ${yes(sigSame)} | ${rawSame ? '같음' : '다름'} | ${checks} | ${pass ? '통과' : '**실패**'} | ${w.status.ms ?? '-'} |`,
  );
  const line = `${name}: ${pass ? 'PASS' : 'FAIL'} compile=${compiled} log=${logSame} vcd=${sigSame} raw=${rawSame} checks(native)=${nFail.join('; ') || 'ok'} checks(wasm)=${wFail.join('; ') || 'ok'}`;
  console.log(line);
  console.log(`::${pass ? 'notice' : 'error'} title=golden ${name}::${line}`);
  if (!pass || !rawSame) {
    details.push(
      `### ${name}\n\n` +
        `native 컴파일:\n\n\`\`\`\n${n.compile}\n\`\`\`\nwasm 컴파일:\n\n\`\`\`\n${w.compile}\n\`\`\`\n` +
        `native 로그:\n\n\`\`\`\n${n.log}\n\`\`\`\nwasm 로그:\n\n\`\`\`\n${w.log}\n\`\`\`\n` +
        `검사 실패(native): ${nFail.join('; ') || '없음'}\n\n검사 실패(wasm): ${wFail.join('; ') || '없음'}\n`,
    );
    if (!rawSame && n.vcdText && w.vcdText) {
      const a = normalizeVcdText(n.vcdText).split(' ');
      const b = normalizeVcdText(w.vcdText).split(' ');
      let k = 0;
      while (k < a.length && a[k] === b[k]) k++;
      const around = (xs) => xs.slice(Math.max(0, k - 12), k + 12).join(' ');
      console.log(`--- VCD 원문 차이 (${name}, 토큰 ${k})\nnative: ${around(a)}\nwasm:   ${around(b)}`);
    }
    if (!logSame) {
      console.log(`--- native log (${name})\n${n.log}\n--- wasm log (${name})\n${w.log}`);
    }
  }
}

// 네이티브 결과를 로그에 남긴다. 저장소의 engine/golden/NN/native/에 옮겨 FixtureRunner와 비교 기준으로 쓴다.
if (process.env.GOLDEN_PRINT_NATIVE) {
  for (const name of cases) {
    for (const f of ['log.txt', 'dump.vcd']) {
      const text = await read(path.join(outDir, 'native', name, f));
      if (text === undefined) continue;
      console.log(`<<<NATIVE ${name}/${f}>>>\n${text}${text.endsWith('\n') ? '' : '\n'}<<<END>>>`);
    }
  }
}

const nativeVersion = ((await read(path.join(outDir, 'native', 'VERSION'))) ?? '').trim();
const wasmVersion = ((await read(path.join(outDir, 'wasm', 'VERSION'))) ?? '').trim();
const report = [
  '## 엔진 골든 테스트',
  '',
  `- 네이티브: ${nativeVersion || '(알 수 없음)'}`,
  `- 브라우저 엔진: ${wasmVersion || '(알 수 없음)'}`,
  '',
  '| # | 확인하는 것 | 컴파일 | 로그 | VCD 신호 | VCD 원문 | 검사(네이티브 · wasm) | 판정 | wasm ms |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...rows,
  '',
  allPass ? '모두 통과했다.' : '**실패한 프로그램이 있다.**',
  '',
  ...details,
].join('\n');

await writeFile(path.join(outDir, 'report.md'), report + '\n');
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, report + '\n');
console.log('\n' + report);
process.exit(allPass ? 0 : 1);
