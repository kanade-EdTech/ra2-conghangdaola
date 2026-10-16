async(page)=>{
  const browser=page.context().browser(),checks=[],errors=[];
  function check(ok,label){if(!ok)throw Error(label);checks.push(label);}
  for(const platform of ['toy','xhs']) {
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    try {
      const p=await context.newPage();p.on('pageerror',e=>errors.push(platform+': '+e.message));
      await p.goto('http://127.0.0.1:4175/dist/'+platform+'/index.html');
      const tap=async(sel)=>{if(sel==='#clear-filters'&&await p.locator(sel).isHidden())sel='#clear-all-filters';const n=p.locator(sel);await n.evaluate(e=>e.scrollIntoView({block:'center'}));await n.tap();};
      const row=zone=>p.locator('[data-dropzone="'+zone+'"] [data-item]').evaluateAll(ns=>ns.map(n=>n.dataset.item));
      const flush=()=>p.evaluate(()=>dispatchEvent(new Event('pagehide')));
      const saved=async()=>{await flush();return p.evaluate(()=>JSON.parse(localStorage.getItem('ra2-tier-list:save:v3')));};
      const filter=async(values)=>{for(const [k,v] of Object.entries(values)){if(k==='national')await p.locator('#filter-national').setChecked(v);else await p.locator('#filter-'+k).selectOption(v);}await tap('#apply-filters');};
      const rank=async(id,tier)=>{await tap('[data-item="'+id+'"] .card-main');await tap('#selection-edit');await p.getByRole('button',{name:'移至'+tier+'档',exact:true}).tap();};
      const label=s=>platform+': '+s;
      check(await p.locator('[data-mode="units"]').textContent()==='常规榜',label('顶部改名常规榜'));
      await tap('[data-mode="units"]');
      check(await p.locator('#pool-count').textContent()==='89',label('原版常规含单位、T4和建筑89项'));
      check(await p.locator('#country-pool [data-item]').count()===40&&await p.locator('#country-pool .show-more').isVisible(),label('长列表首批40项'));
      for(const id of ['E1','E2','ENGINEER'])await rank('unit:ra2:'+id,'夯');
      await filter({category:'infantry',faction:'allied'});
      check((await row('hang')).join()==='unit:ra2:E1,unit:ra2:ENGINEER',label('筛选隐藏苏军并保留已排盟军'));
      await tap('[data-item="unit:ra2:ENGINEER"] .card-main');await tap('#selection-prev');
      check((await row('hang')).join()==='unit:ra2:ENGINEER,unit:ra2:E1',label('筛选内同行前移'));
      await filter({category:'ground'});check((await row('hang')).length===0,label('其他类别不泄漏已排步兵'));
      await filter({category:'infantry'});await flush();await p.reload();
      check((await row('hang')).join()==='unit:ra2:ENGINEER,unit:ra2:E1',label('刷新保持筛选和最新同行顺序'));
      await tap('#clear-filters');check((await row('hang')).join()==='unit:ra2:ENGINEER,unit:ra2:E2,unit:ra2:E1',label('完整行合并可见顺序且隐藏项目保留'));
      await filter({category:'infantry',faction:'allied'});await tap('#reset-button');await p.getByRole('button',{name:'确认重置',exact:true}).tap();
      await tap('#clear-filters');check((await row('hang')).join()==='unit:ra2:E2',label('筛选重置只清匹配项目'));
      await tap('#undo-button');check((await row('hang')).join()==='unit:ra2:ENGINEER,unit:ra2:E2,unit:ra2:E1',label('跨筛选撤销完整榜'));
      await filter({stage:'spy'});check(await p.locator('#pool-count').textContent()==='4',label('原版间谍科技阶段4项'));
      await filter({category:'naval'});check(await p.locator('#empty-state').isVisible()&&await p.locator('#export-button').isDisabled(),label('空筛选安全提示与禁用导出'));
      await tap('#clear-filters');check((await row('hang')).length===3,label('空筛选返回后排名仍在'));
      await filter({category:'defense'});await rank('building:ra2:GTGCAN','顶级');
      await filter({national:true});check(!((await row('top')).includes('building:ra2:GTGCAN')),label('屏蔽国家专属含巨炮'));
      await filter({national:false});check((await row('top')).includes('building:ra2:GTGCAN'),label('取消屏蔽恢复国家建筑排名'));
      await tap('[data-version="yr"]');check((await row('top')).length===0,label('常规榜两版本排名隔离'));
      await tap('#clear-filters');check(await p.locator('#pool-count').textContent()==='126',label('尤复常规含126项'));
      await tap('[data-mode="signatures"]');
      check(await p.locator('[data-specialty]').count()===4&&await p.locator('[data-version="combined"]').isVisible(),label('四个特色子榜与综合版本入口'));
      check(await p.locator('[data-version]').filter({has:p.locator('span')}).first().getAttribute('data-version')==='combined',label('综合位于版本最左'));
      await rank('signature:france','夯');
      await tap('[data-version="ra2"]');check((await row('hang')).join()==='signature:france',label('原版空特色榜继承综合'));
      await rank('signature:france','拉');await tap('[data-version="combined"]');check((await row('hang')).join()==='signature:france',label('版本榜修改不覆盖综合'));
      await tap('[data-version="yr"]');check((await row('hang')).join()==='signature:france',label('尤复空特色榜独立继承综合'));
      await filter({faction:'soviet'});check(await p.locator('#pool-count').textContent()==='4'&&(await row('hang')).length===0,label('国家特色阵营筛选'));
      await tap('#clear-filters');await tap('[data-version="ra2"]');check((await row('la')).join()==='signature:france',label('原版特色独立排名持续保留'));
      await tap('[data-specialty="t4"]');check(await p.locator('#stage-field').isHidden()&&await p.locator('#source-field').isHidden(),label('T4仅显示适用筛选'));
      await tap('[data-version="yr"]');await rank('unit:yr:CIVAN','夯');
      await tap('[data-mode="units"]');await filter({stage:'spy'});check((await row('hang')).length===0&&await p.locator('#pool-count').textContent()==='3',label('常规T4与特色T4排名独立'));
      await tap('[data-mode="signatures"]');await tap('[data-specialty="others"]');
      await filter({category:'animal',source:'civilian',faction:'neutral'});
      check((await row('unranked')).includes('unit:yr:COW')&&(await row('unranked')).includes('unit:yr:DNOB'),label('无图标平民动物完整收录'));
      check((await p.locator('[data-item="unit:yr:COW"] img').getAttribute('src')).includes('/factions/neutral.png'),label('平民缺图使用阵营标志'));
      await filter({category:'ground'});await rank('unit:yr:BUS','顶级');await filter({category:'animal'});await filter({category:'ground'});
      check((await row('top')).join()==='unit:yr:BUS',label('其他单位筛选切换保留排名'));
      await tap('[data-specialty="structures"]');
      check(await p.locator('#source-field').isVisible()&&await p.locator('#stage-field').isHidden(),label('特殊建筑有来源且无常规科技筛选'));
      check(await p.locator('#pool-count').textContent()==='319',label('特殊建筑过滤辅助对象后319项'));
      const before=await p.locator('#country-pool [data-item]').count();await tap('#country-pool .show-more');
      check(before===40&&await p.locator('#country-pool [data-item]').count()===80,label('继续显示不改变名单'));
      await filter({source:'neutral',category:'building'});
      const oil=p.locator('[data-item="building:yr:CAOILD"]');
      while(!(await oil.count()))await tap('#country-pool .show-more');
      await rank('building:yr:CAOILD','人上人');await filter({source:'campaign'});check((await row('elite')).length===0,label('战役筛选隐藏中立科技建筑'));
      await tap('#clear-filters');check((await row('elite')).join()==='building:yr:CAOILD',label('特殊建筑恢复已排中立条目'));
      const state=await saved();check(state.boards['yr|units']&&state.boards['yr|structures']&&Object.keys(state.boards).every(k=>!k.includes('stage:')),label('本地只持久化版本和榜类型的完整排名'));
      await p.reload();check((await row('elite')).join()==='building:yr:CAOILD',label('特殊建筑刷新恢复'));
      const pages=await p.evaluate(async()=>{
        const a=window.RA2,c={mode:'structures',version:'yr'},s=JSON.parse(localStorage.getItem('ra2-tier-list:save:v3')),b=a.core.project(s.boards['yr|structures'],c),expected=[];
        a.core.locations.forEach(l=>expected.push.apply(expected,a.core.list(b,l)));
        const ids=[],sizes=[];let count=1;
        for(let n=0;n<count;n++){const poster=await a.createPoster(b,c,1080,n);count=poster.pageCount;ids.push.apply(ids,poster.itemIds);sizes.push(poster.width*poster.height);poster.data='';}
        const light=await a.createPoster(b,c,720,1);
        return {same:JSON.stringify(ids)===JSON.stringify(expected),unique:new Set(ids).size===ids.length,count,sizes,light:light.width===720&&light.page===1};
      });
      check(pages.same&&pages.unique&&pages.count===7,label('遍历7页导出无重复遗漏且保持档位同行顺序'));
      check(pages.sizes.every(n=>n<=4000000)&&pages.light,label('各页画布预算与720画质通过'));
      if(platform==='xhs')await p.evaluate(()=>{window.__saved=[];window.xhs={miniTool:{writeTempFile:async o=>{window.__saved.push(o.data.slice(0,22));return {filePath:'/tmp/poster.png'};},saveImageToPhotosAlbum:async o=>{window.__saved.push(o.filePath);}}};});
      await tap('#export-button');await p.locator('.poster-preview').waitFor();
      check(await p.locator('.poster-pager').textContent().then(t=>t.includes('第 1 / 7 页')),label('导出弹窗第一页页码'));
      await p.getByRole('button',{name:'下一页',exact:true}).tap();await p.locator('.poster-preview').waitFor();
      check(await p.locator('.poster-pager').textContent().then(t=>t.includes('第 2 / 7 页')),label('导出弹窗实际翻页'));
      await p.getByRole('button',{name:'轻量画质',exact:true}).tap();await p.locator('.poster-preview').waitFor();
      check(await p.locator('.poster-pager').textContent().then(t=>t.includes('第 2 / 7 页')),label('切换轻量保留当前页'));
      if(platform==='xhs'){await p.getByRole('button',{name:'保存图片',exact:true}).tap();check(await p.evaluate(()=>window.__saved.join()==='data:image/png;base64,,/tmp/poster.png'),label('分页图片经模拟桥接写文件再保存'));}
      await p.locator('#modal-close').tap();
      for(const width of [320,390,430]){await p.setViewportSize({width,height:844});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label(width+'px无横向溢出'));}
      await tap('[data-mode="units"]');await tap('#clear-filters');await filter({category:'defense'});await p.evaluate(()=>scrollTo(0,0));
      if(platform==='toy')await p.screenshot({path:'output/playwright/0.4.0-regular-mobile.png',fullPage:true});
      check(errors.length===0,label('无页面运行异常'));
    }finally{await context.close();}
  }
  return {count:checks.length,checks,errors};
}
