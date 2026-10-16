async (page) => {
  const browser = page.context().browser(), checks = [];
  const assert = (ok, text) => { if (!ok) throw new Error(text); checks.push(text); };
  for (const platform of ['toy', 'xhs']) {
    const context = await browser.newContext();
    try {
      await context.addInitScript(() => {
        const key = 'ra2-tier-list:save:v1';
        if (sessionStorage.getItem('title-migration-seeded')) return;
        const ids = ['america','britain','france','germany','korea','russia','iraq','cuba','libya'];
        localStorage.setItem(key, JSON.stringify({schemaVersion:1,activeVersion:'ra2',boards:{
          ra2:{title:'我的红警 2 国家喜好榜',tiers:{hang:['america'],top:[],elite:[],npc:[],la:[]},unranked:ids.slice(1)},
          yr:{title:'我的尤复国家／阵营喜好榜',tiers:{hang:[],top:['yuri'],elite:[],npc:[],la:[]},unranked:ids}
        }}));
        sessionStorage.setItem('title-migration-seeded','true');
      });
      const p = await context.newPage();
      await p.goto('http://127.0.0.1:4175/dist/'+platform+'/index.html');
      assert(await p.locator('#board-title').inputValue()==='国家强度排序',platform+' 原版旧草稿标题更新');
      assert(await p.locator('[data-dropzone="hang"] [data-item="america"]').count()===1,platform+' 原版已有排名保留');
      await p.locator('[data-version="yr"]').click();
      assert(await p.locator('#board-title').inputValue()==='国家强度排序',platform+' 尤复旧默认更新');
      assert(await p.locator('[data-dropzone="top"] [data-item="yuri"]').count()===1,platform+' 尤里已有排名保留');
      await p.locator('[data-version="ra2"]').click(); await p.reload();
      assert(await p.locator('#board-title').inputValue()==='国家强度排序',platform+' 刷新仍显示新默认');
      await p.locator('#board-title').fill('我自己的喜好榜');
      await p.locator('#ranking-heading').click();
      await p.waitForFunction(()=>JSON.parse(localStorage.getItem('ra2-tier-list:save:v2')).boards['ra2|countries'].title==='我自己的喜好榜');
      await p.reload();
      assert(await p.locator('#board-title').inputValue()==='我自己的喜好榜',platform+' 自定义标题不受迁移影响');
    } finally { await context.close(); }
  }
  return {checks};
}
