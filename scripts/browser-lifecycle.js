async (page) => {
  const context = await page.context().browser().newContext({viewport:{width:1280,height:960}});
  try {
    const p = await context.newPage();
    await p.goto('http://127.0.0.1:4175/dist/toy/index.html');
    return await p.evaluate(() => {
      const checks = [];
      const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label); };
      const root = document.createElement('div');
      root.style.cssText='position:fixed;left:10px;top:10px;width:400px;height:550px;z-index:500;background:#222';
      root.innerHTML='<div data-dropzone="hang" style="height:160px"><div class="country-card" data-item="america"><button class="card-main">A</button></div></div><div data-dropzone="top" style="height:160px"></div><div data-dropzone="la" style="height:160px"></div>';
      document.body.appendChild(root);
      const card=root.querySelector('.country-card');
      const emit=(type,x,y,target=card)=>target.dispatchEvent(new PointerEvent(type,{pointerId:77,pointerType:'mouse',isPrimary:true,button:0,bubbles:true,cancelable:true,clientX:x,clientY:y}));
      let version='ra2', moves=[], selected=[];
      const options={disabled:()=>false,getVersion:()=>version,move:(...args)=>moves.push(args),select:id=>selected.push(id),dragging:()=>{}};
      let controller=window.RA2.installDrag(root,options);
      emit('pointerdown',60,50); emit('pointermove',100,210); emit('pointerup',100,380);
      check(moves.length===1 && moves[0][1]==='la','最终松手坐标覆盖上一帧候选目标');
      emit('pointerup',100,380);
      check(moves.length===1,'重复结束不重复提交');
      emit('pointerdown',60,50); emit('pointermove',100,210);
      emit('lostpointercapture',100,210,root); emit('pointerup',100,210);
      check(moves.length===1 && !root.querySelector('.is-dragging'),'丢失捕获取消并清理');
      emit('pointerdown',60,50); emit('pointermove',100,210);
      window.dispatchEvent(new Event('blur')); emit('pointerup',100,210);
      check(moves.length===1 && !document.querySelector('.drag-ghost'),'失焦零提交且移除浮层');
      emit('pointerdown',60,50); emit('pointermove',100,210); version='yr'; emit('pointerup',100,210);
      check(moves.length===1,'旧版本手势不能写入新版本');
      version='ra2'; controller.destroy();
      for(let i=0;i<10;i++) {
        controller=window.RA2.installDrag(root,options);
        emit('pointerdown',60,50); emit('pointermove',100,210);
        controller.destroy(); controller.destroy(); emit('pointerup',100,210);
      }
      const before=selected.length;
      emit('pointerdown',60,50); emit('pointerup',60,50);
      check(moves.length===1 && selected.length===before && !document.querySelector('.drag-ghost'),'重复安装销毁不留下事件、浮层或提交');
      root.remove();
      return {checks};
    });
  } finally { await context.close(); }
}
