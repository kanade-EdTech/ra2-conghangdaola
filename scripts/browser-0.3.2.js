async(page)=>{
  const checks=[], browser=page.context().browser();
  function check(ok,label){if(!ok)throw Error(label);checks.push(label);}
  for(const platform of ['toy','xhs']) {
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    try {
      const p=await context.newPage();
      // Exercise the real image error path, including export retries.
      await p.route('**/units/hind.png',route=>route.abort());
      await p.goto('http://127.0.0.1:4175/dist/'+platform+'/index.html');
      await p.locator('[data-mode="signatures"]').tap();
      await p.locator('[data-specialty="others"]').tap();
      for(const version of ['ra2','yr']) {
        await p.locator('[data-version="'+version+'"]').tap();
        const expected={VLADIMIR:'soviet',PENTGEN:'allied',PRES:'allied',SSRV:'allied',VLAD:'soviet',HIND:'soviet',TRUCKA:'neutral'};
        if(version==='yr')expected.SLAV='yuri';
        for(const [gid,faction] of Object.entries(expected)) {
          const img=p.locator('[data-item="unit:'+version+':'+gid+'"] img');
          await img.evaluate(n=>n.complete&&n.naturalWidth?Promise.resolve():new Promise(resolve=>n.addEventListener('load',resolve,{once:true})));
          check((await img.getAttribute('src')).endsWith('/factions/'+faction+'.png'),platform+': '+version+' '+gid+'使用'+faction+'标志');
        }
        const result=await p.evaluate(async(version)=>{
          const drawn=[], original=CanvasRenderingContext2D.prototype.drawImage;
          CanvasRenderingContext2D.prototype.drawImage=function(img){drawn.push(img.src);return original.apply(this,arguments);};
          try {
            const app=window.RA2, c={mode:'others',version};
            const poster=await app.createPoster(app.core.createBoard(c),c,720);
            return {drawn,data:poster.data.slice(0,22),width:poster.width};
          }finally{CanvasRenderingContext2D.prototype.drawImage=original;}
        },version);
        check(result.width===720&&result.data==='data:image/png;base64,',platform+': '+version+'海报可生成');
        check(result.drawn.some(s=>s.endsWith('/factions/soviet.png'))&&result.drawn.some(s=>s.endsWith('/factions/allied.png')),platform+': '+version+'海报采用阵营标志');
        check(result.drawn.every(s=>!/(vladimir|pentgen|pres|ssrv|vlad|hind)\.png$/.test(s)),platform+': '+version+'海报不使用借图或失败资源');
      }
      await p.unroute('**/units/hind.png');
      await p.reload();
      if(platform==='toy')await p.screenshot({path:'output/playwright/0.3.2-faction-icons.png',fullPage:true});
    }finally{await context.close();}
  }
  return {count:checks.length,checks};
}
