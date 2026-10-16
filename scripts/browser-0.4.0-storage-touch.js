async(page)=>{
  const browser=page.context().browser(),checks=[];
  function check(ok,label){if(!ok)throw Error(label);checks.push(label);}
  for(const platform of ['toy','xhs'])for(const fallback of [false,true]) {
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    try{
      if(fallback)await context.addInitScript(()=>Object.defineProperty(window,'PointerEvent',{value:undefined}));
      const p=await context.newPage();await p.goto('http://127.0.0.1:4175/dist/'+platform+'/index.html');
      const original=await p.evaluate(()=>{
        const a=window.RA2,all={mode:'units',version:'ra2',faction:'all',category:'all',stage:'all'},subset={...all,faction:'allied',category:'infantry'};
        function oldBoard(c){const b=a.core.createBoard(c);b.unranked=b.unranked.filter(id=>a.catalog.getItem(id).rankingPool==='regular'&&a.catalog.getItem(id).kind==='unit');b.context=c;return b;}
        const b=oldBoard(all),f=oldBoard(subset);
        b.unranked=b.unranked.filter(id=>id!=='unit:ra2:E2');b.tiers.top=['unit:ra2:E2'];
        f.unranked=f.unranked.filter(id=>!['unit:ra2:E1','unit:ra2:ENGINEER'].includes(id));f.tiers.hang=['unit:ra2:E1','unit:ra2:ENGINEER'];f.title='迁移与触屏';
        const raw={schemaVersion:2,catalogRevision:1,activeBoardKey:'ra2|units|allied|infantry|stage:all',lastGameVersion:'ra2',lastRegularContexts:{ra2:subset},boards:{'ra2|units|all|all|stage:all':b,'ra2|units|allied|infantry|stage:all':f}};
        const bytes=JSON.stringify(raw);localStorage.clear();localStorage.setItem('ra2-tier-list:save:v2',bytes);return bytes;
      });
      await context.addInitScript(bytes=>{if(!sessionStorage.getItem('migration-seeded')){localStorage.clear();localStorage.setItem('ra2-tier-list:save:v2',bytes);sessionStorage.setItem('migration-seeded','1');}},original);
      await p.reload();const prefix=platform+'/'+(fallback?'Touch':'Pointer')+': ';
      const row=z=>p.locator('[data-dropzone="'+z+'"] [data-item]').evaluateAll(ns=>ns.map(n=>n.dataset.item));
      const saved=()=>p.evaluate(()=>{dispatchEvent(new Event('pagehide'));return JSON.parse(localStorage.getItem('ra2-tier-list:save:v3'));});
      check(await p.locator('#board-title').inputValue()==='迁移与触屏'&&(await row('hang')).join()==='unit:ra2:E1,unit:ra2:ENGINEER',prefix+'真实页面恢复旧v2活动筛选和同行顺序');
      check(await p.evaluate(bytes=>localStorage.getItem('ra2-tier-list:save:v2')===bytes,original),prefix+'迁移保留旧键原始字节');
      const cdp=await context.newCDPSession(p),touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
      async function begin(id){const n=p.locator('[data-item="'+id+'"]');await n.evaluate(n=>n.scrollIntoView({block:'center'}));const b=await n.boundingBox(),pt={x:b.x+b.width/2,y:b.y+b.height/2,id:1};await touch('touchStart',[pt]);return pt;}
      const pt=await begin('unit:ra2:E1');await touch('touchMove',[{...pt,x:pt.x+12}]);
      check(await p.locator('.drag-ghost.unit-card').count()===1,prefix+'单位整卡触摸显示正确比例拖影');
      const target=await p.locator('[data-dropzone="hang"] [data-item="unit:ra2:ENGINEER"]').boundingBox();
      await touch('touchMove',[{x:target.x+target.width-3,y:target.y+target.height/2,id:1}]);await touch('touchEnd',[]);
      check((await row('hang')).join()==='unit:ra2:ENGINEER,unit:ra2:E1',prefix+'真实触摸同行重排');
      const n=await saved();check(n.boards['ra2|units'].tiers.top.join()==='unit:ra2:E2'&&n.boards['ra2|units'].tiers.hang.join()==='unit:ra2:ENGINEER,unit:ra2:E1',prefix+'隐藏苏军和最新触屏顺序同时持久化');
      await p.reload();check((await row('hang')).join()==='unit:ra2:ENGINEER,unit:ra2:E1',prefix+'触屏顺序刷新恢复');
      const start=await begin('unit:ra2:E1');await touch('touchMove',[{...start,x:start.x+15}]);await touch('touchStart',[{...start,x:start.x+15},{x:30,y:start.y,id:2}]);await touch('touchEnd',[]);
      check(await p.locator('.drag-ghost').count()===0&&(await row('hang')).join()==='unit:ra2:ENGINEER,unit:ra2:E1',prefix+'第二指取消且不改排名');
      await p.locator('#clear-all-filters').tap();
      // Force batches with a seed that has already passed the real migration above.
      const full=await saved();const ids=full.boards['ra2|units'].unranked;
      await p.locator('#country-pool .show-more').tap();
      check(await p.locator('#country-pool [data-item]').count()===80,prefix+'继续显示支持真实触屏会话');
      const card=p.locator('#country-pool [data-item]').nth(41);const id=await card.getAttribute('data-item');await card.evaluate(n=>n.scrollIntoView({block:'center'}));await card.locator('.card-main').tap();
      await p.locator('#selection-prev').tap();
      const after=await saved(),expected=ids.slice(),idx=expected.indexOf(id);expected.splice(idx,1);expected.splice(idx-1,0,id);
      check(after.boards['ra2|units'].unranked.join()===expected.join(),prefix+'第二批项目移动索引正确且未显示尾项保留');
    }finally{await context.close();}
  }
  // Broken newer storage must not fall back to or overwrite the older data in the UI.
  const context=await browser.newContext();try{
    await context.addInitScript(()=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('ra2-tier-list:save:v3','{broken');localStorage.setItem('ra2-tier-list:save:v2','legacy bytes');sessionStorage.setItem('seeded','1');}});
    const p=await context.newPage();await p.goto('http://127.0.0.1:4175/dist/toy/index.html');await p.locator('[data-mode="units"]').click();
    check(await p.locator('#save-status').textContent().then(t=>t.includes('不会覆盖')),'损坏新版草稿在页面显示保护提示');
    check(await p.evaluate(()=>localStorage.getItem('ra2-tier-list:save:v3')==='{broken'&&localStorage.getItem('ra2-tier-list:save:v2')==='legacy bytes'),'损坏存档切换操作后仍保留两个原键');
  }finally{await context.close();}
  return {count:checks.length,checks};
}
