async(page)=>{
  const browser=page.context().browser(),checks=[],errors=[],base=new URL(page.url()).origin;
  const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  try{
    await context.addInitScript(()=>{
      if(sessionStorage.getItem('seed'))return;
      const tiers=()=>({hang:[],top:[],elite:[],npc:[],la:[]});
      const regular={context:{mode:'units',version:'yr'},title:'我的常规榜',tiers:tiers(),unranked:[]};regular.tiers.hang=['unit:yr:CIVAN'];
      const others={context:{mode:'others',version:'yr'},title:'旧平民榜',tiers:tiers(),unranked:['unit:yr:BUS']};
      const combined={context:{mode:'signatures',version:'combined'},title:'我的特色',tiers:tiers(),unranked:[]};combined.tiers.top=['signature:france'];
      const raw={schemaVersion:3,catalogRevision:2,lastGameVersion:'yr',activeBoardKey:'yr|others',activeContext:{mode:'others',version:'yr'},lastContexts:{'yr|others':{mode:'others',version:'yr'}},lastRegularContexts:{yr:{mode:'units',version:'yr'}},boards:{'yr|units':regular,'yr|others':others,'combined|signatures':combined}};
      const bytes=JSON.stringify(raw);localStorage.clear();localStorage.setItem('ra2-tier-list:save:v3',bytes);sessionStorage.setItem('original',bytes);sessionStorage.setItem('seed','1');
    });
    const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/dist/xhs/index.html');
    const tap=async sel=>{const n=p.locator(sel);await n.evaluate(e=>e.scrollIntoView({block:'center'}));await n.tap();};
    const row=zone=>p.locator('[data-dropzone="'+zone+'"] [data-item]').evaluateAll(ns=>ns.map(n=>n.dataset.item));
    check(await p.locator('[data-mode="units"]').getAttribute('aria-pressed')==='true','旧存档停在已移除榜时转到常规榜');
    check((await row('hang')).join()==='unit:yr:CIVAN','原有常规T4排名保留');
    check(await p.evaluate(()=>localStorage.getItem('ra2-tier-list:save:v3')===sessionStorage.getItem('original')),'完整旧版存档原样保留');
    check(await p.evaluate(()=>window.RA2.buildProfile.version==='0.4.3'&&window.RA2.units.every(i=>['regular','t4'].includes(i.rankingPool))),'运行数据版本正确且无特色专属条目');
    check(await p.locator('[data-specialty="others"], [data-specialty="structures"]').count()===0,'包内移除两个特色入口');
    check(await p.locator('script[src="./data/others.js"]').count()===0,'不加载其他单位数据脚本');
    for(const [version,count] of [['ra2','89'],['yr','126']]){await tap('[data-version="'+version+'"]');check(await p.locator('#progress-label').textContent().then(t=>t.endsWith('/ '+count)),version+'常规单位和建筑范围完整');}
    await p.locator('#filter-stage').selectOption('spy');await tap('#apply-filters');
    check((await row('hang')).includes('unit:yr:CIVAN')&&await p.locator('#pool-count').textContent()==='2','常规榜保留3项尤复T4及其排名');
    await tap('[data-mode="signatures"]');
    check(await p.locator('[data-specialty]').count()===2,'特色榜仅保留国家特色和T4');
    check((await row('top')).join()==='signature:france','国家特色综合旧排名保留');
    await tap('[data-version="ra2"]');check((await row('top')).join()==='signature:france','国家特色版本初始化继承正常');
    await tap('[data-specialty="t4"]');
    check(await p.locator('#pool-count').textContent()==='4','原版特色T4保留4项');
    await tap('[data-version="yr"]');check(await p.locator('#pool-count').textContent()==='3'&&(await row('hang')).length===0,'尤复特色T4保留3项且独立于常规榜');
    const id='unit:yr:CCOMAND';await tap('[data-item="'+id+'"] .card-main');await tap('#selection-edit');await p.getByRole('button',{name:'移至夯档',exact:true}).tap();
    await p.evaluate(()=>dispatchEvent(new Event('pagehide')));await p.reload();check((await row('hang')).join()===id,'精简版独立存档刷新恢复');
    check(await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('ra2-tier-list:xhs:save:v3'));return Object.values(s.boards).every(b=>!['others','structures'].includes(b.context.mode));}),'精简版存档无已删除榜');
    await p.evaluate(()=>{window.__saved=[];window.xhs={miniTool:{writeTempFile:async o=>{window.__saved.push(o.data.startsWith('data:image/png;base64,'));return {filePath:'/tmp/0.4.3.png'};},saveImageToPhotosAlbum:async o=>{window.__saved.push(o.filePath);}}};});
    await tap('#export-button');await p.locator('.poster-preview').waitFor();check(await p.locator('.poster-preview').getAttribute('src').then(s=>s.startsWith('data:image/png;base64,')),'T4海报生成成功');
    await p.getByRole('button',{name:'保存图片',exact:true}).tap();check(await p.evaluate(()=>window.__saved[0]===true&&window.__saved[1]==='/tmp/0.4.3.png'),'小红书模拟桥接保存成功');
    await p.locator('#modal-close').tap();
    for(const width of [320,390,430]){await p.setViewportSize({width,height:844});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+'px无横向溢出');}
    const icons=await p.evaluate(async()=>{
      const a=window.RA2,paths=Array.from(new Set(a.countries.concat(a.units,a.signatures).map(i=>a.itemIcon(i)).concat(Object.values(a.factionIcons))));
      const result=await Promise.all(paths.map(path=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img.naturalWidth>0);img.onerror=()=>resolve(false);img.src=path;})));
      return {count:paths.length,ok:result.every(Boolean)};
    });
    check(icons.count===138&&icons.ok,'全部138个共享图标及回退图标离线加载成功');
    check(errors.length===0,'无页面异常');
    await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:'output/playwright/xhs-0.4.3.png',fullPage:true});
  }finally{await context.close();}
  return {count:checks.length,checks,errors};
}

