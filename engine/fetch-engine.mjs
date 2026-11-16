// 엔진 wasm을 고정한 곳에서 받아 sha256을 확인한다. (최종계획서 9.5, 14.2의 2번)
// 사용: node engine/fetch-engine.mjs <받을 폴더> [lock 파일]
//   기본 lock은 engine/engine.lock.json (이 저장소의 engine-v* Release)
//   engine/verisim.lock.json을 주면 0단계에서 쓴 VeriSim 빌드를 받는다
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const lockPath = process.argv[3] ? path.resolve(process.argv[3]) : path.join(here, 'engine.lock.json');
const lock = JSON.parse(await readFile(lockPath, 'utf8'));
const dest = path.resolve(process.argv[2] ?? path.join(here, '.cache', 'verisim'));
await mkdir(dest, { recursive: true });

for (const [name, sha] of Object.entries(lock.files)) {
  const target = path.join(dest, name);
  let data;
  try {
    data = await readFile(target);
    if (createHash('sha256').update(data).digest('hex') === sha) {
      console.log(`ok (cache) ${name}`);
      continue;
    }
  } catch {
    // 없으면 받는다
  }
  const url = lock.url
    ? lock.url.replace('{file}', name)
    : `https://raw.githubusercontent.com/${lock.repo}/${lock.commit}/${name}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  data = Buffer.from(await res.arrayBuffer());
  const got = createHash('sha256').update(data).digest('hex');
  if (got !== sha) throw new Error(`${name}: sha256 ${got} (기대 ${sha})`);
  await writeFile(target, data);
  console.log(`ok ${name} (${data.length} bytes)`);
}
