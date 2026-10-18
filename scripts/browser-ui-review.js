async(page)=>{
 const checks=[],errors=[];
 const base=new URL(page.url()).origin;
 const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
 page.on('pageerror',e=>errors.push(e.message));
 const visible=async selector=>page.locator(selector).evaluate(e=>{
  const b=e.getBoundingClientRect(),hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
  return b.top>=0&&b.bottom<=innerHeight&&e.contains(hit);
 });
 for(const platform of ['toy','xhs']) {
  await page.goto(base+'/dist/'+platform+'/index.html');
  await page.evaluate(()=>localStorage.clear());await page.reload();
  await page.locator('[data-mode="units"]').click();
  await page.locator('[data-version="yr"]').click();
  for(const size of [{width:320,height:568},{width:390,height:844},{width:768,height:400},{width:1024,height:768}]) {
   await page.setViewportSize(size);
   await page.locator('#export-button').click();await page.locator('.poster-preview').waitFor();
   const label=platform+' '+size.width+'×'+size.height;
   check(await visible('.poster-actions .primary-button'),label+' 保存按钮直接可见');
   check(await visible('#modal-close'),label+' 关闭按钮可见');
   check(await visible('.poster-pager button:last-child'),label+' 翻页按钮可见');
   check(await page.locator('.poster-scroll').evaluate(e=>e.clientHeight>24&&e.scrollHeight>e.clientHeight),label+' 长图在独立区域滚动');
   await page.locator('.poster-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);
   check(await visible('#modal-close')&&await visible('.poster-actions .primary-button'),label+' 图片滚到底仍能关闭和保存');
   await page.locator('.poster-pager button:last-child').click();
   await page.waitForFunction(()=>{const n=document.querySelector('.poster-pager span');return n&&n.textContent.indexOf('第 2 /')!==-1;});
   await page.locator('.poster-actions .secondary-button').click();
   await page.waitForFunction(()=>{const n=document.querySelector('.modal-description');return n&&n.textContent.indexOf('720 ×')!==-1;});
   check((await page.locator('.poster-pager span').textContent()).includes('第 2 /'),label+' 轻量画质保留当前页');
   const snapshot=await page.locator('.poster-preview').getAttribute('src');
   check(snapshot.startsWith('data:image/png;base64,'),label+' 图片生成正常');
   if(size.width===390)await page.screenshot({path:'output/playwright/ui-'+platform+'-export-fixed.png'});
   await page.locator('#modal-close').click();
  }
 }
 check(errors.length===0,'两端无脚本运行错误');
 return {passed:checks.length,checks};
}
