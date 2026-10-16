async(page)=>{
  const checks=[],browser=page.context().browser();
  function check(ok,label){if(!ok)throw Error(label);checks.push(label);}
  for(const platform of ['toy','xhs']){
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    try{
      const p=await context.newPage();await p.route('**/units/hind.png',route=>route.abort());
      await p.goto('http://127.0.0.1:4175/dist/'+platform+'/index.html');
      await p.locator('[data-mode="signatures"]').tap();await p.locator('[data-specialty="others"]').tap();
      for(const version of ['ra2','yr']){
        await p.locator('[data-version="'+version+'"]').tap();
        await p.locator('#filter-category').selectOption('air');await p.locator('#apply-filters').tap();
        const img=p.locator('[data-item="unit:'+version+':HIND"] img');
        await img.evaluate(n=>n.complete&&n.naturalWidth?Promise.resolve():new Promise(resolve=>n.addEventListener('load',resolve,{once:true})));
        check((await img.getAttribute('src')).endsWith('/factions/soviet.png'),platform+'/'+version+'图片失败改用苏军标志');
        const result=await p.evaluate(async version=>{
          const a=window.RA2,c={mode:'others',version,category:'air'},b=a.core.createBoard(c),drawn=[],original=CanvasRenderingContext2D.prototype.drawImage;
          CanvasRenderingContext2D.prototype.drawImage=function(img){drawn.push(img.src);return original.apply(this,arguments);};
          try{const poster=await a.createPoster(b,c,720);return {drawn,valid:poster.data.startsWith('data:image/png;base64,')};}finally{CanvasRenderingContext2D.prototype.drawImage=original;}
        },version);
        check(result.valid&&result.drawn.some(s=>s.endsWith('/factions/soviet.png'))&&!result.drawn.some(s=>s.endsWith('/units/hind.png')),platform+'/'+version+'海报实际使用失败资源的阵营回退');
        await p.locator('#filter-category').selectOption('infantry');await p.locator('#filter-source').selectOption('campaign');await p.locator('#apply-filters').tap();
        for(const [gid,faction] of Object.entries({VLADIMIR:'soviet',PENTGEN:'allied',PRES:'allied',SSRV:'allied'}))
          check((await p.locator('[data-item="unit:'+version+':'+gid+'"] img').getAttribute('src')).endsWith('/factions/'+faction+'.png'),platform+'/'+version+' '+gid+'不用无关单位借图');
        await p.locator('#clear-all-filters').tap();
      }
    }finally{await context.close();}
  }
  return {count:checks.length,checks};
}
