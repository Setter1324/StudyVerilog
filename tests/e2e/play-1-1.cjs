// 화면 스모크 테스트(임시): 1-1의 빈칸을 채우고 실행해서 결과 판을 본다.
// shots.yml에서 돈다. Playwright를 package.json에 넣기 전까지 쓰는 스크립트다.
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
