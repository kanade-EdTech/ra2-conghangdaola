async (page) => {
  const results = [];
  const check = (condition, label) => {
    if (!condition) throw new Error('FAIL: ' + label);
    results.push(label);
  };
  const browser = page.context().browser();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const target = await context.newPage();
  const errors = [];
  target.on('pageerror', error => errors.push(error.message));
  await target.goto('http://127.0.0.1:4175/dist/xhs/index.html');
  const rank = async (name, tier) => {
    await target.getByRole('button', { name: '为' + name + '定档', exact: true }).tap();
    await target.locator('#selection-edit').tap();
    await target.getByRole('button', { name: '移至' + tier + '档', exact: true }).tap();
  };
  await rank('美国', '夯');
  check(await target.locator('[data-dropzone="hang"] .country-card').count() === 1, '触屏点选分档');
  const cdp = await context.newCDPSession(target);
  await target.locator('[data-item="america"] .drag-handle').scrollIntoViewIfNeeded();
  const a = await target.locator('[data-item="america"] .drag-handle').boundingBox();
  const b = await target.locator('[data-dropzone="top"]').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x + a.width / 2, y: a.y + a.height / 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  check(await target.locator('[data-dropzone="top"] .country-card').count() === 1, '浏览器触摸事件拖拽跨档');
  await target.getByRole('button', { name: '为英国定档', exact: true }).tap();
  await target.locator('#selection-edit').tap();
  await target.locator('#modal-overlay').waitFor({ state: 'visible' });
  await target.keyboard.press('Tab');
  await target.keyboard.press('Shift+Tab');
  check(await target.evaluate(() => document.getElementById('modal').contains(document.activeElement)), '弹层焦点保持在弹层内');
  await target.keyboard.press('Escape');
  check(await target.locator('#modal-overlay').isHidden(), 'Escape 关闭弹层');
  await target.locator('#board-title').fill('<img src=x onerror=alert(1)>');
  await target.locator('#ranking-heading').tap();
  check(await target.locator('.title-field img').count() === 0, '标题按纯文本处理 HTML 输入');
  for (const name of ['英国', '法国', '德国', '韩国', '苏俄', '伊拉克', '古巴', '利比亚']) await rank(name, '顶级');
  await target.locator('#export-button').tap();
  await target.locator('.poster-preview').waitFor();
  check(await target.locator('.poster-preview').evaluate(img => img.naturalHeight) < 2500, '原版全部同档导出保持合理尺寸');
  await target.getByRole('button', { name: '关闭弹窗', exact: true }).tap();
  await target.locator('[data-version="yr"]').tap();
  for (const name of ['美国', '英国', '法国', '德国', '韩国', '苏俄', '伊拉克', '古巴', '利比亚', '尤里']) await rank(name, '夯');
  check(await target.locator('[data-dropzone="hang"] .country-card').count() === 10, '尤复十项全在一档不丢失');
  const hiddenGhost = await target.locator('.drag-ghost').count();
  check(hiddenGhost === 0, '连续触屏操作不残留拖拽浮层');
  await target.locator('#board-title').fill('一'.repeat(30));
  await target.locator('#ranking-heading').tap();
  await target.locator('#export-button').tap();
  await target.locator('.poster-preview').waitFor();
  check(await target.locator('.poster-preview').evaluate(img => img.naturalWidth) === 1080, '尤复十项同档与最长中文标题可导出');
  await target.locator('.poster-preview').screenshot({ path: 'output/playwright/poster-full-tier.png' });
  await target.getByRole('button', { name: '关闭弹窗', exact: true }).tap();
  const scrollStart = await target.evaluate(() => scrollY);
  await target.evaluate(() => scrollTo(0, 0));
  const scrollPoint = { x: 365, y: 700 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [scrollPoint] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 365, y: 350 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  check(await target.evaluate(() => scrollY) > 0, '拖拽区域之外触摸自然滚动');
  await cdp.detach();
  check(errors.length === 0, '触屏流程无未捕获异常');
  await context.close();

  for (const scenario of ['corrupt', 'future', 'quota', 'denied', 'fallback']) {
    const testContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
    await testContext.addInitScript(scenario => {
      const key = 'ra2-tier-list:save:v1';
      if (scenario === 'corrupt') localStorage.setItem(key, '{broken');
      if (scenario === 'future') localStorage.setItem(key, '{"schemaVersion":2}');
      if (scenario === 'quota') Storage.prototype.setItem = function () { throw new Error('quota'); };
      if (scenario === 'denied') Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied'); } });
      if (scenario === 'fallback') Object.defineProperty(window, 'PointerEvent', { value: undefined });
    }, scenario);
    const testPage = await testContext.newPage();
    const pageErrors = [];
    testPage.on('pageerror', error => pageErrors.push(error.message));
    await testPage.goto('http://127.0.0.1:4175/dist/xhs/index.html');
    await testPage.getByRole('button', { name: '为美国定档', exact: true }).click();
    await testPage.locator('#selection-edit').click();
    await testPage.getByRole('button', { name: '移至夯档', exact: true }).click();
    check(await testPage.locator('[data-dropzone="hang"] .country-card').count() === 1 && !pageErrors.length,
      scenario + '：仍可排名，无未捕获异常');
    if (scenario === 'corrupt' || scenario === 'future') {
      const raw = await testPage.evaluate(() => localStorage.getItem('ra2-tier-list:save:v1'));
      check(raw === (scenario === 'corrupt' ? '{broken' : '{"schemaVersion":2}'), scenario + '：原存档未被覆盖');
    }
    if (scenario === 'fallback') {
      const handle = await testPage.locator('[data-item="america"] .drag-handle').boundingBox();
      const zone = await testPage.locator('[data-dropzone="top"]').boundingBox();
      await testPage.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
      await testPage.mouse.down();
      await testPage.mouse.move(zone.x + 40, zone.y + 30, { steps: 10 });
      await testPage.mouse.up();
      check(await testPage.locator('[data-dropzone="top"] .country-card').count() === 1, '无 PointerEvent 时 Mouse 回退仍可拖拽');
    }
    await testContext.close();
  }
  return { checks: results };
}
