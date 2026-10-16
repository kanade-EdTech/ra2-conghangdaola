async (page) => {
  const browser=page.context().browser(), results=[], errors=[];
  const check=(ok,label)=>{if(!ok) throw Error('FAIL '+label);results.push(label);};
  const initialIds=['america','britain','france','germany','korea','russia','iraq','cuba','libya'];
  const board=(ids,title)=>({title,tiers:{hang:[],top:[],elite:[],npc:[],la:[]},unranked:ids});
  const old={schemaVersion:1,activeVersion:'ra2',boards:{ra2:board(initialIds,'我的红警 2 国家喜好榜'),yr:board(initialIds.concat('yuri'),'尤复自定义')}};
  old.boards.ra2.tiers.top=['america'];old.boards.ra2.unranked=initialIds.slice(1);
  for(const platform of ['toy','xhs']) {
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    try {
      await context.addInitScript(seed=>{if(!localStorage.getItem('ra2-tier-list:save:v1'))localStorage.setItem('ra2-tier-list:save:v1',JSON.stringify(seed));},old);
      const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
      await p.goto('http://127.0.0.1:4175/dist/'+platform+'/index.html');
      const prefix=platform+': ', list=zone=>p.locator('[data-dropzone="'+zone+'"] [data-item]').evaluateAll(ns=>ns.map(n=>n.dataset.item));
      const count=()=>p.locator('.workspace [data-item]').count();
      const filters=async(category,faction,stage)=>{
        await p.selectOption('#filter-category',category);await p.selectOption('#filter-faction',faction);await p.selectOption('#filter-stage',stage);await p.locator('#apply-filters').tap();
      };
      const rank=async(id,tier='hang')=>{
        const card=p.locator('[data-item="'+id+'"] .card-main');await card.evaluate(n=>n.scrollIntoView({block:'center'}));await card.tap();
        await p.locator('#selection-edit').tap();await p.getByRole('button',{name:'移至'+({hang:'夯',top:'顶级'}[tier])+'档',exact:true}).tap();
      };
      const title=async(value)=>{await p.locator('#board-title').fill(value);await p.locator('#context-summary').tap();};
      check(await p.locator('#board-title').inputValue()==='国家强度排序' && (await list('top')).join()==='america',prefix+'v1默认标题迁移且排名保留');
      check(await p.evaluate(()=>JSON.parse(localStorage.getItem('ra2-tier-list:save:v1')).schemaVersion)===1,prefix+'原v1键保留');
      await p.locator('[data-version="yr"]').tap();check(await p.locator('#board-title').inputValue()==='尤复自定义',prefix+'另一版本自定义标题保留');
      await p.locator('[data-version="ra2"]').tap();await p.locator('[data-mode="units"]').tap();
      check(await count()===47,prefix+'原版全部常规47项');
      check(await p.locator('[data-item="unit:ra2:YURIPR"]').count()===0,prefix+'原版全部排除T4');
      await filters('infantry','allied','radar');
      check((await list('unranked')).sort().join()==='unit:ra2:JUMPJET,unit:ra2:SNIPE',prefix+'类别阵营科技交集正确');
      await title('我的盟军雷达步兵');await rank('unit:ra2:SNIPE');
      await filters('infantry','allied','all');check((await list('hang')).length===0,prefix+'不同组合独立评分');
      await filters('infantry','allied','radar');check((await list('hang')).join()==='unit:ra2:SNIPE' && await p.locator('#board-title').inputValue()==='我的盟军雷达步兵',prefix+'回组合恢复标题排名');
      await filters('air','soviet','basic');check(await p.locator('#empty-state').isVisible()&&await p.locator('#export-button').isDisabled(),prefix+'空组合禁用导出');
      await p.locator('#toggle-filters').tap();await p.locator('#secret-button').tap();
      check(await p.locator('#secret-panel').isVisible()&&await p.locator('#secret-button').getAttribute('aria-expanded')==='true',prefix+'零结果和折叠状态可展开机密档案');
      if(platform==='toy') { await p.waitForTimeout(300);await p.locator('#unit-controls').screenshot({path:'output/playwright/0.3.0-secret-mobile.png',animations:'disabled'}); }
      await p.locator('#enter-t4').tap();check(await count()===4 && await p.locator('#unit-controls').isHidden(),prefix+'原版T4独立四项且无普通筛选');
      await p.locator('#export-button').tap();await p.locator('.poster-preview').waitFor({state:'visible'});
      check((await p.locator('.modal-description').textContent()).includes('T4 间谍科技 · 独立榜'),prefix+'T4导出明确版本和独立榜');
      await p.getByRole('button',{name:'关闭弹窗',exact:true}).tap();
      await title('原版T4机密档案');await rank('unit:ra2:YURIPR');
      await p.locator('[data-version="yr"]').tap();check(await count()===3 && (await list('hang')).length===0,prefix+'尤复T4独立三项');
      await rank('unit:yr:CCOMAND','top');await p.locator('[data-version="ra2"]').tap();
      check((await list('hang')).join()==='unit:ra2:YURIPR'&&await p.locator('#board-title').inputValue()==='原版T4机密档案',prefix+'T4跨版本返回恢复');
      await p.locator('#undo-button').tap();check((await list('hang')).length===0,prefix+'T4撤销按版本独立');
      await rank('unit:ra2:YURIPR');await p.reload();check((await list('hang')).join()==='unit:ra2:YURIPR'&&await p.locator('#t4-heading').isVisible(),prefix+'刷新直接恢复T4');
      if(platform==='toy')await p.screenshot({path:'output/playwright/0.3.0-t4-mobile.png'});
      await p.locator('#return-units').tap();check(await p.locator('#empty-state').isVisible()&&await p.locator('#filter-category').inputValue()==='air',prefix+'返回普通榜恢复最近条件');
      await p.locator('#clear-filters').tap();await p.locator('[data-version="yr"]').tap();check(await count()===68,prefix+'尤复常规68项');
      check(await p.locator('[data-item="unit:yr:YURIPR"]').count()===1&&await p.locator('[data-item="unit:yr:CCOMAND"]').count()===0,prefix+'同ID不同版本身份正确');
      await rank('unit:yr:E1','top');
      const cdp=await context.newCDPSession(p), source=p.locator('[data-item="unit:yr:E1"]');
      await source.evaluate(n=>n.scrollIntoView({block:'center'}));
      const start=await source.boundingBox(), finish=await p.locator('[data-dropzone="hang"]').boundingBox();
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x+30,y:start.y+30,id:1}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:finish.x+30,y:finish.y+finish.height/2,id:1}]});
      check((await list('top')).join()==='unit:yr:E1',prefix+'单位真实触摸预览不写排名');
      const ghostImage=await p.locator('.drag-ghost .unit-image').boundingBox();
      check(Math.abs(ghostImage.width/ghostImage.height-1.25)<.01,prefix+'单位浮动卡片保持60×48比例');
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      check((await list('hang')).join()==='unit:yr:E1',prefix+'含版本化ID的单位真实触摸跨档');
      await p.locator('#undo-button').tap();check((await list('top')).join()==='unit:yr:E1',prefix+'单位拖动一次撤销');
      await p.locator('#undo-button').tap();await cdp.detach();
      await p.evaluate(()=>scrollTo(0,0));
      if(platform==='toy')await p.screenshot({path:'output/playwright/0.3.0-units-mobile.png'});
      await p.locator('#export-button').tap();await p.locator('.poster-preview').waitFor({state:'visible'});
      const dimensions=await p.locator('.poster-preview').evaluate(i=>({w:i.naturalWidth,h:i.naturalHeight}));
      check(dimensions.w===1080&&dimensions.w*dimensions.h<=4000000,prefix+'最大真实常规名单1080完整导出且预算内');
      if(platform==='toy') {
        const data=await p.locator('.poster-preview').getAttribute('src');
        const posterPage=await context.newPage();await posterPage.setViewportSize({width:1080,height:900});await posterPage.setContent('<body style="margin:0"><img style="display:block" src="'+data+'"></body>');await posterPage.screenshot({path:'output/playwright/0.3.0-units-poster.png',fullPage:true});await posterPage.close();
      }
      if(platform==='xhs') {
        await p.evaluate(()=>{window.bridgeCalls=[];window.xhs={miniTool:{writeTempFile:async o=>{window.bridgeCalls.push(['write',o.data.startsWith('data:image/png;base64,')]);return{filePath:'local/test.png'};},saveImageToPhotosAlbum:async o=>window.bridgeCalls.push(['save',o.filePath])}};});
        await p.getByRole('button',{name:'保存图片',exact:true}).tap();check(await p.evaluate(()=>JSON.stringify(window.bridgeCalls))==='[["write",true],["save","local/test.png"]]',prefix+'小红书宿主保存契约模拟正确');
      }
      await p.getByRole('button',{name:'关闭弹窗',exact:true}).tap();await p.locator('[data-mode="signatures"]').tap();await p.locator('[data-specialty="signatures"]').tap();
      check(await count()===9&&await p.locator('#version-tabs').isHidden(),prefix+'特色唯一共享九项');
      check((await p.locator('[data-item="signature:america"] img').getAttribute('src')).endsWith('aparicon.png'),prefix+'美国技能图标正确');
      await title('九种特色共用榜');await rank('signature:france');
      await p.locator('[data-mode="countries"]').tap();await p.locator('[data-version="ra2"]').tap();await p.locator('[data-mode="signatures"]').tap();await p.locator('[data-specialty="signatures"]').tap();
      check((await list('hang')).join()==='signature:france'&&await p.locator('#board-title').inputValue()==='九种特色共用榜',prefix+'另一版本入口恢复共享标题和档位');
      await p.locator('#undo-button').tap();check((await list('hang')).length===0,prefix+'共享特色撤销栈连续');
      await rank('signature:france');await p.reload();check((await list('hang')).join()==='signature:france',prefix+'共享特色刷新恢复');
      if(platform==='toy')await p.screenshot({path:'output/playwright/0.3.0-signatures-mobile.png'});
      await p.locator('#export-button').tap();await p.locator('.poster-preview').waitFor({state:'visible'});
      check((await p.locator('.modal-description').textContent()).includes('共用特色榜'),prefix+'特色导出标注两版共用');
      if(platform==='toy') {
        const data=await p.locator('.poster-preview').getAttribute('src');
        const posterPage=await context.newPage();await posterPage.setViewportSize({width:1080,height:900});await posterPage.setContent('<body style="margin:0"><img style="display:block" src="'+data+'"></body>');await posterPage.screenshot({path:'output/playwright/0.3.0-signatures-poster.png',fullPage:true});await posterPage.close();
      }
      await p.getByRole('button',{name:'关闭弹窗',exact:true}).tap();
      for(const width of [320,375,430]) { await p.setViewportSize({width,height:844});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),prefix+'手机宽度'+width+'无横向溢出'); }
      const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('ra2-tier-list:save:v2')));
      check(Object.keys(saved.boards).filter(k=>k.includes('signatures')).join()==='shared|signatures',prefix+'仅一份特色存档');
      check(Object.keys(saved.boards).filter(k=>k.endsWith('|t4')).length===2,prefix+'T4两版本各有存档');
      check(errors.length===0,prefix+'运行无页面异常');
    } finally {await context.close();}
  }
  return {checks:results.length,results,errors};
}
