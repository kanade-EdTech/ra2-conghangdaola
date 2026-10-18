const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const fs=require('node:fs');
const {createHash}=require('node:crypto');
const root=pathToFileURL(path.resolve(__dirname,'..')+path.sep);
async function load(platform){
  const build=await import('../scripts/production-files.mjs'),context=vm.createContext({window:{}});
  for(const f of build.scriptsFor(platform)){
    vm.runInContext(await build.sourceText(root,f,platform),context);
    if(f==='core/storage.js')break;
  }
  return context.window.RA2;
}
test('XHS physically excludes specialty-only content and keeps regular buildings, T4 and signatures',async()=>{
  const a=await load('xhs'),full=await load('toy'),build=await import('../scripts/production-files.mjs');
  assert.ok(a.units.every(i=>['regular','t4'].includes(i.rankingPool)));
  assert.ok(full.units.some(i=>i.rankingPool==='others'));
  assert.ok(full.units.some(i=>i.rankingPool==='structures'));
  for(const version of ['ra2','yr']){
    assert.equal(a.catalog.ids({mode:'units',version}).length,version==='ra2'?89:126);
    assert.equal(a.catalog.ids({mode:'t4',version}).length,version==='ra2'?4:3);
  }
  for(const version of ['combined','ra2','yr'])assert.equal(a.catalog.ids({mode:'signatures',version}).length,9);
  assert.equal(a.catalog.getItem('unit:yr:BUS'),null);
  assert.equal(a.catalog.getItem('building:yr:CAOILD'),null);
  const files=await build.productionFiles(root,'xhs');assert.ok(!files.includes('data/others.js'));
  assert.ok(!files.some(f=>f.endsWith('/hind.png')));
  const html=await build.sourceText(root,'index.html','xhs');assert.doesNotMatch(html,/data-specialty="(?:others|structures)"/);
  assert.match(html,/data-specialty="t4"/);assert.match(html,/data-specialty="signatures"/);
});
test('XHS migrates a removed active board, retains supported ranks, and leaves original V3 untouched',async()=>{
  const full=await load('toy'),a=await load('xhs'),s=full.core.initial();
  const q={mode:'units',version:'yr'},special={mode:'others',version:'yr'};
  full.core.ensureBoard(s,q);full.core.ensureBoard(s,special);
  s.boards['yr|units']=full.core.move(s.boards['yr|units'],q,'unit:yr:CIVAN','hang');
  s.boards['yr|others']=full.core.move(s.boards['yr|others'],special,'unit:yr:BUS','la');
  s.activeContext=full.catalog.context(special);s.activeBoardKey='yr|others';s.lastGameVersion='yr';s.lastContexts['yr|others']=s.activeContext;
  const bytes=JSON.stringify(s),data=new Map([['ra2-tier-list:save:v3',bytes]]);
  const store=a.createStorage(()=>({getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,v)}));
  const loaded=store.load();assert.equal(loaded.status,'migrated');assert.equal(loaded.state.activeBoardKey,'yr|units');
  assert.equal(loaded.state.boards['yr|units'].tiers.hang[0],'unit:yr:CIVAN');
  assert.ok(!loaded.state.boards['yr|others']);assert.ok(!loaded.state.lastContexts['yr|others']);
  assert.equal(store.save(loaded.state),'saved');assert.equal(data.get('ra2-tier-list:save:v3'),bytes);
  assert.ok(data.has('ra2-tier-list:xhs:save:v3'));assert.equal(store.load().status,'restored');
});
test('Shared XHS icons are byte-identical and every unit retains its version-specific data',async()=>{
  const a=await load('xhs'),full=await load('toy'),build=await import('../scripts/production-files.mjs');
  const profile=await build.xhsAssetProfile(root),files=await build.productionFiles(root,'xhs');
  assert.ok(profile.uniqueCount<profile.originalCount);
  const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
  const iconBytes=(app,i)=>fs.readFileSync(new URL(app.itemIcon(i),root));
  const metadata=i=>{const v=JSON.parse(JSON.stringify(i));delete v.iconPath;return v;};
  const all=a.countries.concat(a.units,a.signatures);
  for(const item of all){
    const before=full.catalog.getItem(item.id);assert.ok(before,item.id);
    assert.deepEqual(metadata(item),metadata(before),item.id+' metadata');
    assert.equal(sha(iconBytes(a,item)),sha(iconBytes(full,before)),item.id+' icon pixels unchanged');
    assert.ok(files.includes(a.itemIcon(item).slice(2)),item.id+' icon included');
  }
  for(const p of Object.values(a.factionIcons))assert.ok(files.includes(p.slice(2)));
  const hashes=files.filter(f=>f.endsWith('.png')).map(f=>sha(fs.readFileSync(new URL(f,root))));
  assert.equal(new Set(hashes).size,hashes.length,'No duplicate PNG content remains');
});
