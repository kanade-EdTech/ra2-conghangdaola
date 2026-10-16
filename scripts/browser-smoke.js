async (page) => {
  const results = [];
  const errors = [];
  const badRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) badRequests.push(response.url());
  });
  const base = 'http://127.0.0.1:4175/dist/';
  const key = 'ra2-tier-list:save:v2';
  const check = (condition, label) => {
    if (!condition) throw new Error('FAIL: ' + label);
    results.push(label);
  };
  const count = async zone => page.locator('[data-dropzone="' + zone + '"] .country-card').count();
  const rank = async (name, tier) => {
    await page.getByRole('button', { name: '为' + name + '定档', exact: true }).click();
    await page.locator('#selection-edit').click();
    await page.getByRole('button', { name: '移至' + tier + '档', exact: true }).click();
  };
  const idsIn = async zone => page.locator('[data-dropzone="' + zone + '"] .country-card').evaluateAll(
    nodes => nodes.map(node => node.getAttribute('data-item'))
  );
  const drag = async (id, zone) => {
    const handle = page.locator('[data-item="' + id + '"] .drag-handle');
    await handle.scrollIntoViewIfNeeded();
    const a = await handle.boundingBox();
    const b = await page.locator('[data-dropzone="' + zone + '"]').boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width - 20, b.y + b.height / 2, { steps: 16 });
    await page.mouse.up();
  };
  await page.goto(base + 'toy/index.html');
  await page.addInitScript(({ key, marker }) => {
    if (!sessionStorage.getItem(marker)) {
      localStorage.removeItem(key); localStorage.removeItem('ra2-tier-list:save:v1');
      sessionStorage.setItem(marker, 'done');
    }
  }, { key, marker: 'ra2-smoke-' + Date.now() });
  await page.reload();
  await page.setViewportSize({ width: 1280, height: 960 });
  check(await count('unranked') === 9, '原版首次进入：9 国全部待排名');
  await page.screenshot({ path: 'output/playwright/desktop-initial.png', fullPage: true });
  await rank('美国', '夯');
  await rank('英国', '夯');
  check((await idsIn('hang')).join() === 'america,britain', '点选分档与追加顺序');
  await page.getByRole('button', { name: '为英国定档', exact: true }).click();
  await page.locator('#selection-edit').click();
  await page.getByRole('button', { name: '← 前移', exact: true }).click();
  check((await idsIn('hang')).join() === 'britain,america', '无拖拽同档前移');
  await page.locator('#undo-button').click();
  check((await idsIn('hang')).join() === 'america,britain', '撤销顺序调整');
  await drag('america', 'top');
  check((await idsIn('top')).join() === 'america', '鼠标拖拽跨档提交');
  const handle = page.locator('[data-item="britain"] .drag-handle');
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 25, box.y + 140, { steps: 6 });
  await page.evaluate(() => document.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true })));
  await page.mouse.up();
  check((await idsIn('hang')).join() === 'britain' && await page.locator('.drag-ghost').count() === 0, '取消拖拽恢复位置并清理浮层');
  await page.locator('[data-version="yr"]').click();
  check(await count('unranked') === 10 && await count('hang') === 0, '尤复独立初始化，包含尤里');
  await rank('尤里', '夯');
  await page.locator('[data-version="ra2"]').click();
  check(await count('hang') === 1 && await count('top') === 1 && await page.locator('[data-item="yuri"]').count() === 0, '切回原版保持排名且排除尤里');
  await page.locator('#board-title').fill('😀'.repeat(31));
  await page.locator('#ranking-heading').click();
  check(await page.locator('#title-count').textContent() === '30/30', '标题按 Unicode 码点限长');
  await page.locator('#undo-button').click();
  check(await page.locator('#board-title').inputValue() === '国家强度排序', '标题编辑整次撤销');
  await page.locator('#board-title').fill('我的对战回忆 · 从夯到拉');
  await page.locator('#ranking-heading').click();
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).boards['ra2|countries'].title.includes('对战回忆'), key);
  await page.reload();
  check(await count('top') === 1 && (await page.locator('#board-title').inputValue()).includes('对战回忆'), '刷新恢复排名与标题');
  await page.locator('#reset-button').click();
  await page.getByRole('button', { name: '保留排名', exact: true }).click();
  check(await count('top') === 1, '取消重置无变化');
  await page.locator('#reset-button').click();
  await page.getByRole('button', { name: '确认重置', exact: true }).click();
  check(await count('unranked') === 9 && (await page.locator('#board-title').inputValue()).includes('对战回忆'), '重置当前榜单并保留标题');
  await page.locator('#undo-button').click();
  check(await count('top') === 1, '撤销重置');
  await rank('法国', '顶级'); await rank('德国', 'NPC'); await rank('韩国', '人上人');
  await rank('苏俄', '夯'); await rank('伊拉克', '夯'); await rank('古巴', '拉');
  await page.screenshot({ path: 'output/playwright/desktop-ranked.png', fullPage: true });
  for (const width of [320, 375, 390, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
    check(dimensions.content <= dimensions.viewport, width + 'px 无横向页面溢出');
    if (width === 390) {
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({
        path: 'output/playwright/mobile-ranked.png', fullPage: true,
        style: '.action-bar { position: static !important; } .selection-bar { display: none !important; } body::before { position: absolute !important; } #toast { display: none !important; }'
      });
    }
  }
  await page.setViewportSize({ width: 1280, height: 960 });
  await page.locator('#export-button').click();
  await page.locator('.poster-preview').waitFor();
  const poster = await page.locator('.poster-preview').evaluate(img => ({
    width: img.naturalWidth, height: img.naturalHeight, data: img.src
  }));
  check(poster.width === 1080 && poster.height > 800 && poster.data.startsWith('data:image/png;base64,'), '未完成榜单生成有效 1080px 海报');
  await page.locator('.poster-preview').screenshot({ path: 'output/playwright/poster-preview.png' });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存图片', exact: true }).click();
  const download = await downloadPromise;
  await download.saveAs('output/playwright/poster-original.png');
  check(download.suggestedFilename() === 'ra2-tier-list-ra2-countries.png', '浏览器实际发起并取得 PNG 下载');
  await page.getByRole('button', { name: '轻量画质', exact: true }).click();
  await page.locator('.poster-preview').waitFor();
  check(await page.locator('.poster-preview').evaluate(img => img.naturalWidth) === 720, '轻量画质为 720px');
  await page.getByRole('button', { name: '关闭弹窗', exact: true }).click();
  await page.locator('[data-version="yr"]').click();
  check((await idsIn('hang')).join() === 'yuri', '刷新后尤复仍独立保留尤里排名');
  check(await page.locator('#undo-button').isDisabled() && (await idsIn('hang')).join() === 'yuri',
    '刷新后会话撤销历史为空，不串版本');

  await page.goto(base + 'xhs/index.html');
  await page.context().route('**/dist/xhs/**', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: {
      ...response.headers(),
      'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; worker-src 'none'; object-src 'none'"
    } });
  });
  await page.reload();
  check(await page.locator('.country-card').count() === 10, '小红书包在限制脚本和联网的 CSP 下初始化');
  await page.locator('#export-button').click();
  await page.locator('.poster-preview').waitFor();
  await page.getByRole('button', { name: '保存图片', exact: true }).click();
  check((await page.locator('.modal-note').textContent()).includes('系统截图'), '无原生桥时保留预览并提供截图提示');
  await page.evaluate(() => {
    window.bridgeCalls = [];
    window.xhs = { miniTool: {
      writeTempFile: async options => {
        window.bridgeCalls.push({ method: 'writeTempFile', keys: Object.keys(options), completeData: options.data.startsWith('data:image/png;base64,') });
        return { filePath: '/temporary/poster.png' };
      },
      saveImageToPhotosAlbum: async options => { window.bridgeCalls.push({ method: 'saveImageToPhotosAlbum', ...options }); }
    } };
  });
  await page.getByRole('button', { name: '保存图片', exact: true }).click();
  const calls = await page.evaluate(() => window.bridgeCalls);
  check(calls.length === 2 && calls[0].completeData && calls[0].keys.join() === 'data' &&
    calls[1].filePath === '/temporary/poster.png', '模拟桥：完整 dataURI → 临时文件 → 相册，参数正确');
  await page.evaluate(() => { window.xhs.miniTool.saveImageToPhotosAlbum = async () => { throw { errMsg: '相册权限被拒绝' }; }; });
  await page.getByRole('button', { name: '保存图片', exact: true }).click();
  check((await page.locator('.modal-note').textContent()).includes('权限被拒绝') &&
    await page.locator('.poster-preview').isVisible(), '模拟桥拒绝授权保留预览和重试入口');
  await page.getByRole('button', { name: '关闭弹窗', exact: true }).click();
  await page.context().unroute('**/dist/xhs/**');
  await page.context().setOffline(true);
  await rank('美国', '顶级');
  await page.locator('#export-button').click();
  await page.locator('.poster-preview').waitFor();
  check(await page.locator('.poster-preview').evaluate(img => img.naturalWidth) === 1080, '已加载页面断网可继续排名和生成图片');
  await page.context().setOffline(false);
  await page.getByRole('button', { name: '关闭弹窗', exact: true }).click();
  check(errors.length === 0, '交互过程中无未捕获页面错误');
  check(badRequests.length === 0, '业务资源无 404 或其他 HTTP 错误');
  return { checks: results, errors, badRequests };
}
