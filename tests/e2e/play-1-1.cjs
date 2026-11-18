// 화면 스모크 테스트(임시): 1-1의 빈칸을 채우고 실행해서 결과 판을 본다.
// shots.yml에서 돈다. Playwright를 package.json에 넣기 전까지 쓰는 스크립트다.
/* global document, window -- page.evaluate 안의 코드는 브라우저에서 돈다 */
const { chromium } = require(process.env.PW_PATH || 'playwright');

(async () => {
  const base = process.env.BASE || 'http://localhost:4173/StudyVerilog/';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 1000 } });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  const step = async (name, fn) => {
    const t0 = Date.now();
    await fn();
    console.log(`ok ${name} (${Date.now() - t0}ms)`);
  };

  try {
    await step('open', () => page.goto(base + '#/play/v1-01'));
    // 틀린 답 먼저
    await step('wrong answer', async () => {
      await page.getByLabel('빈칸 1: D를 만드는 연산자').fill('&');
      await page.getByLabel('빈칸 2: E를 만드는 연산자').fill('&');
      await page.getByRole('button', { name: '실행', exact: true }).click();
      await page.getByRole('button', { name: '끝으로' }).click({ timeout: 30000 });
      await page.getByRole('dialog').waitFor({ timeout: 10000 });
      console.log('dialog:', (await page.getByRole('dialog').innerText()).replace(/\n+/g, ' | '));
      await page.screenshot({ path: 'shots/play-wrong.png' });
      await page.getByRole('button', { name: '고치러 가기' }).click();
    });
    await step('right answer', async () => {
      await page.getByLabel('빈칸 1: D를 만드는 연산자').fill('|');
      await page.keyboard.press('Control+Enter');
      await page.getByRole('button', { name: '끝으로' }).click({ timeout: 30000 });
      await page.getByRole('dialog').waitFor({ timeout: 10000 });
      const text = await page.getByRole('dialog').innerText();
      console.log('dialog:', text.replace(/\n+/g, ' | '));
      await page.screenshot({ path: 'shots/play-right.png' });
      if (!text.includes('맞았어요')) throw new Error('정답인데 맞았어요가 아니다');
    });
    await step('compile error', async () => {
      await page.getByRole('button', { name: '다시 보기' }).click();
      await page.getByLabel('빈칸 1: D를 만드는 연산자').fill('||| (');
      await page.getByRole('button', { name: '실행', exact: true }).click();
      await page.waitForTimeout(3000);
      console.log('console:', (await page.locator('pre').last().innerText()).slice(0, 400));
      await page.screenshot({ path: 'shots/play-error.png' });
    });
    await step('predict 1-2', async () => {
      await page.goto(base + '#/play/v1-02');
      await page.getByRole('radio', { name: '0' }).check();
      await page.getByRole('button', { name: '실행', exact: true }).click();
      await page.getByRole('button', { name: '끝으로' }).click({ timeout: 30000 });
      await page.getByRole('dialog').waitFor({ timeout: 10000 });
      console.log('dialog:', (await page.getByRole('dialog').innerText()).replace(/\n+/g, ' | '));
      await page.screenshot({ path: 'shots/play-predict.png' });
    });
    await step('design 1-12', async () => {
      await page.goto(base + '#/play/v1-12');
      await page.getByLabel('design.sv').fill('module circuit(input A, input B, input C, output Y);\n  assign Y = (A & B) | ~C;\nendmodule\n');
      await page.getByRole('button', { name: '실행', exact: true }).click();
      await page.getByRole('button', { name: '끝으로' }).click({ timeout: 30000 });
      await page.getByRole('dialog').waitFor({ timeout: 10000 });
      console.log('dialog:', (await page.getByRole('dialog').innerText()).replace(/\n+/g, ' | '));
      await page.screenshot({ path: 'shots/play-design.png' });
    });
    await step('timing 1-11', async () => {
      await page.goto(base + '#/play/v1-11');
      await page.getByRole('spinbutton').fill('5');
      await page.getByRole('button', { name: '실행', exact: true }).click();
      await page.getByRole('button', { name: '끝으로' }).click({ timeout: 30000 });
      await page.getByRole('dialog').waitFor({ timeout: 10000 });
      console.log('dialog:', (await page.getByRole('dialog').innerText()).replace(/\n+/g, ' | '));
      await page.screenshot({ path: 'shots/play-timing.png' });
    });
    const result = async (shot) => {
      await page.getByRole('button', { name: '끝으로' }).click({ timeout: 30000 });
      await page.getByRole('dialog').waitFor({ timeout: 10000 });
      const text = (await page.getByRole('dialog').innerText()).replace(/\n+/g, ' | ');
      console.log('dialog:', text);
      await page.screenshot({ path: `shots/${shot}.png` });
      return text;
    };
    await step('predict + fill 1-4', async () => {
      await page.goto(base + '#/play/v1-04');
      await page.getByLabel('빈칸 1: AND 건물을 지나는 데 걸리는 시간').fill('#2');
      await page.getByRole('radio', { name: '0', exact: true }).check();
      await page.getByRole('button', { name: '실행', exact: true }).click();
      if (!(await result('play-1-4')).includes('맞았어요')) throw new Error('1-4 정답인데 맞았어요가 아니다');
      // t=11: A가 t=10에 바뀌어 OR(#3)를 지나는 중이다. 칸 3개 중 2개가 찬다
      await page.getByRole('button', { name: '다시 보기' }).click();
      await page.getByRole('slider', { name: '시간' }).fill('11');
      const world = page.getByRole('img', { name: /3틱 중 2틱째/ });
      await world.waitFor({ timeout: 5000 });
      console.log('world at t=11:', await world.getAttribute('aria-label'));
      await page.screenshot({ path: 'shots/play-1-4-t11.png' });
      // 대본 위치 고정(개발용): 구간 2에서 w1이 걷는 순간(5,050~5,750ms). 걷는 동안 시각은 t=13에 멈춰 있다
      await page.evaluate(() => {
        window.location.hash = '#/play/v1-04?ms=5400';
      });
      const frozen = page.getByRole('img', { name: /^t=13의 마을\..*w1=1.*E=0/ });
      await frozen.waitFor({ timeout: 5000 });
      console.log('world at ms=5400:', await frozen.getAttribute('aria-label'));
      await page.waitForTimeout(300);
      await page.screenshot({ path: 'shots/play-1-4-ms5400.png' });
    });
    await step('no $finish 1-9', async () => {
      await page.goto(base + '#/play/v1-09');
      await page.getByRole('button', { name: '실행', exact: true }).click();
      // 해가 지지 않는 코드는 재생 없이 바로 결과 판이 뜬다
      await page.getByRole('dialog').waitFor({ timeout: 30000 });
      const text = (await page.getByRole('dialog').innerText()).replace(/\n+/g, ' | ');
      console.log('dialog:', text);
      await page.screenshot({ path: 'shots/play-1-9.png' });
      if (!text.includes('10000')) throw new Error('1-9 시작 코드에서 끝나지 않는다는 안내가 없다');
    });
    await step('boss 1-15 (실행 뒤 답하기)', async () => {
      await page.goto(base + '#/play/v1-15');
      await page.getByLabel('빈칸 1: 인스턴스 이름(문패)').fill('ins_name');
      await page.getByLabel('빈칸 2: 맨 위 모듈의 신호만 적는 깊이').fill('1');
      await page.getByLabel('빈칸 3: 나머지 일곱 조합을 넣는 되풀이').fill('repeat (7)');
      await page.getByRole('button', { name: '실행', exact: true }).click();
      if (!(await result('play-1-15-first')).includes('파형을 보고')) throw new Error('1-15 답 없이 실행하면 파형을 보라고 해야 한다');
      await page.getByRole('button', { name: '고치러 가기' }).click();
      await page.getByRole('radio', { name: '(~A & B) | (A & C)', exact: true }).check();
      await page.getByRole('button', { name: '실행', exact: true }).click();
      if (!(await result('play-1-15')).includes('맞았어요')) throw new Error('1-15 정답인데 맞았어요가 아니다');
    });
    await step('keyboard bar 1-4 (징검다리 → 실행)', async () => {
      await page.goto(base + '#/play/v1-04');
      // 뒤로 링크 다음 Tab 한 번에 징검다리의 지금 칸에 닿는다
      await page.getByRole('link', { name: '스테이지 목록으로' }).focus();
      await page.keyboard.press('Tab');
      const cur = await page.evaluate(() => document.activeElement?.getAttribute('aria-current'));
      if (cur !== 'step') throw new Error(`Tab 한 번에 지금 칸에 닿아야 하는데 ${cur}`);
      await page.keyboard.press('ArrowRight');
      const next = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
      console.log('arrow right:', next);
      if (!next.startsWith('1-5')) throw new Error('방향키로 다음 칸에 가야 한다');
      let tabs = 0;
      for (; tabs < 6; tabs++) {
        const name = await page.evaluate(() => (document.activeElement?.textContent ?? '').trim());
        if (name === '실행') break;
        await page.keyboard.press('Tab');
      }
      console.log('tabs from stones to run:', tabs);
      if (tabs >= 6) throw new Error('징검다리에서 Tab 몇 번 안에 실행 버튼에 닿아야 한다');
      await page.screenshot({ path: 'shots/play-bar.png' });
    });
    await step('mobile 1-1 (390px, touch)', async () => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const m = await ctx.newPage();
      await m.goto(base + '#/play/v1-01');
      await m.getByLabel('빈칸 1: D를 만드는 연산자').tap();
      await m.getByLabel('빈칸 1: D를 만드는 연산자').fill('|');
      await m.getByLabel('빈칸 2: E를 만드는 연산자').fill('&');
      const run = m.getByRole('button', { name: '실행', exact: true });
      if ((await run.count()) !== 1) throw new Error(`보이는 실행 버튼이 ${await run.count()}개`);
      const box = await run.boundingBox();
      console.log('mobile run button box:', JSON.stringify(box));
      if (!box || box.y + box.height > 844 || box.y < 0) throw new Error('실행 버튼이 화면 밖에 있다');
      const wide = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      console.log('mobile horizontal overflow:', wide);
      if (wide > 0) throw new Error(`폭 390px에서 가로 스크롤이 ${wide}px 생긴다`);
      await m.screenshot({ path: 'shots/mobile-before-run.png' });
      await run.tap();
      await m.getByRole('button', { name: '끝으로' }).tap({ timeout: 30000 });
      await m.getByRole('dialog').waitFor({ timeout: 10000 });
      console.log('mobile dialog:', (await m.getByRole('dialog').innerText()).replace(/\n+/g, ' | '));
      await m.screenshot({ path: 'shots/mobile-result.png' });
      await ctx.close();
    });
    console.log('E2E PASS');
  } catch (e) {
    console.log('E2E FAIL', e.message);
    await page.screenshot({ path: 'shots/play-fail.png' });
    process.exitCode = 1;
  } finally {
    console.log(logs.slice(-30).join('\n'));
    await browser.close();
  }
})();
