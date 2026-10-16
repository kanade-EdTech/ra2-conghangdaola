async(page)=>{
  const checks=[],errors=[],browser=page.context().browser();
  const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
  for(const platform of ['toy','xhs']) {
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    try {
      const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
      await p.goto('http://127.0.0.1:4175/dist/'+platform+'/index.html');
      const list=zone=>p.locator('[data-dropzone="'+zone+'"] [data-item]').evaluateAll(ns=>ns.map(n=>n.dataset.item));
      const prefix=platform+': ';
      check(await p.locator('.top-navigation').evaluate(n=>n.compareDocumentPosition(document.querySelector('.intro'))&Node.DOCUMENT_POSITION_FOLLOWING),prefix+'主导航先于标题和版本设置');
      check(await p.locator('[data-mode="signatures"]').textContent()==='特色榜',prefix+'主导航三个榜名称正确');
      await p.locator('[data-mode="signatures"]').tap();
      check(await p.locator('#specialty-tabs').isVisible()&&await p.locator('[data-specialty]').count()===3,prefix+'特色榜显示三子项');
      check((await list('unranked')).length===9&&await p.locator('#version-tabs').isHidden(),prefix+'国家特色仍两版共用');
      await p.locator('[data-specialty="t4"]').tap();
      check((await list('unranked')).length===4&&await p.locator('[data-mode="signatures"]').getAttribute('aria-pressed')==='true',prefix+'T4作为特色子榜并保持主导航选中');
      await p.locator('[data-version="yr"]').tap();
      check((await list('unranked')).length===3,prefix+'尤复T4独立');
      await p.locator('[data-specialty="others"]').tap();
      check((await list('unranked')).length===21&&await p.locator('#unit-controls').isHidden(),prefix+'尤复其他单位独立21项');
      check(await p.locator('.unit-fallback').count()===0&&await p.locator('[data-item="unit:yr:HORNET"]').count()===0,prefix+'仅收录有图标单位且排除舰载子机');
      const id=(await list('unranked'))[0], card=p.locator('[data-item="'+id+'"] .card-main');
      await card.evaluate(n=>n.scrollIntoView({block:'center'}));await card.tap();await p.locator('#selection-edit').tap();
      await p.getByRole('button',{name:'移至夯档',exact:true}).tap();
      check((await list('hang')).join()===id,prefix+'其他单位可正常定档');
      await p.locator('[data-version="ra2"]').tap();check((await list('unranked')).length===11&&(await list('hang')).length===0,prefix+'原版其他单位独立11项');
      await p.locator('[data-version="yr"]').tap();check((await list('hang')).join()===id,prefix+'返回另一版本保留其他单位排名');
      await p.reload();check((await list('hang')).join()===id&&await p.locator('[data-specialty="others"]').getAttribute('aria-pressed')==='true',prefix+'刷新恢复其他单位和两级导航');
      await p.locator('#export-button').tap();await p.locator('.poster-preview').waitFor({state:'visible'});
      const dimensions=await p.locator('.poster-preview').evaluate(n=>({w:n.naturalWidth,h:n.naturalHeight}));
      check(dimensions.w*dimensions.h<=4000000,prefix+'其他单位完整导出且低于像素预算');
      check((await p.locator('.modal-description').textContent()).includes('其他单位'),prefix+'导出注明榜单分类');
      await p.getByRole('button',{name:'关闭弹窗',exact:true}).tap();
      await p.locator('[data-mode="units"]').tap();check((await list('unranked')).length===68,prefix+'常规单位名单保持独立');
      await p.locator('[data-mode="signatures"]').tap();check((await list('hang')).join()===id,prefix+'特色主入口恢复最近子分类');
      for(const width of [320,375,430]) {await p.setViewportSize({width,height:844});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),prefix+width+'px无横向溢出');}
      await p.locator('[data-specialty="signatures"]').tap();await p.evaluate(()=>scrollTo(0,0));
      if(platform==='toy')await p.screenshot({path:'output/playwright/0.3.1-top-specialties.png'});
      check(errors.length===0,prefix+'无运行异常');
    }finally{await context.close();}
  }
  return {checks,errors};
}
