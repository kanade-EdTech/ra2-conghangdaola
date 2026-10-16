async (page) => {
  const context = await page.context().browser().newContext({viewport:{width:1200,height:900}});
  try {
    const p = await context.newPage();
    await p.goto('http://127.0.0.1:4175/dist/toy-release-0.2.0-preview/index.html');
    await p.screenshot({path:'release/toy-cover-0.2.0.png',style:'.masthead { height:64px; } .intro { padding:20px 0; } h1 { font-size:54px; } .controls { margin-bottom:18px; } .tier-row { min-height:82px; } .page-shell { padding-bottom:0; } .page-footer { padding-bottom:12px; } .selection-bar, .toast { display:none !important; }'});
    await p.locator('.brand-mark').screenshot({path:'release/toy-icon-0.2.0.png',style:'.brand-mark { width:512px; height:512px; flex-shrink:0; transform:none; font-size:340px; margin:0; border:12px solid #ee6258; background:#131719; letter-spacing:0; } .masthead { height:560px; }'});
    return {cover:'release/toy-cover-0.2.0.png',icon:'release/toy-icon-0.2.0.png'};
  } finally { await context.close(); }
}
