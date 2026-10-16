const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function load(){const c=vm.createContext({window:{}});for(const f of ['data.js','data/units.js','data/others.js','data/buildings.js','data/signatures.js','core/catalog.js','core/ranking.js','core/storage.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',f),'utf8'),c);return c.window.RA2;}
const plain=v=>JSON.parse(JSON.stringify(v));
const ctx=(version='yr',mode='units',extras={})=>({version,mode,...extras});

test('Regular catalog includes legitimate buildings, national units and spy tech, with exact intersections',()=>{
 const a=load(),c=a.catalog;
 for(const version of ['ra2','yr']) {
  const all=plain(c.ids(ctx(version))),t4=plain(c.ids(ctx(version,'t4')));
  assert.equal(all.length,version==='ra2'?89:126);assert.equal(t4.length,version==='ra2'?4:3);
  assert.ok(t4.every(id=>all.includes(id)));
  assert.deepEqual(plain(c.ids(ctx(version,'units',{stage:'spy'}))),t4);
  for(const faction of ['all','allied','soviet',...(version==='yr'?['yuri']:[])])for(const category of Object.keys(a.categories))for(const stage of Object.keys(a.stages)) {
   const q=ctx(version,'units',{faction,category,stage});
   const expected=a.units.filter(i=>i.version===version&&['regular','t4'].includes(i.rankingPool)&&(faction==='all'||i.factions.includes(faction))&&(category==='all'||i.categories.includes(category))&&(stage==='all'||i.techStage===stage)).map(i=>i.id);
   assert.deepEqual(plain(c.ids(q)),plain(expected));
  }
 }
 assert.ok(c.ids(ctx('yr')).includes('building:yr:GTGCAN'));
 assert.ok(!c.ids(ctx('yr','units',{hideNational:true})).includes('building:yr:GTGCAN'));
 assert.ok(!c.ids(ctx('ra2','units',{hideNational:true})).includes('unit:ra2:SNIPE'));
 assert.ok(!c.ids(ctx('yr')).includes('building:yr:YADEPT')); // TechLevel 15, not standard skirmish
 assert.ok(c.ids(ctx('yr','structures')).includes('building:yr:YADEPT'));
 assert.ok(c.getItem('building:yr:NACLON').categories.includes('defense'));
 assert.ok(c.getItem('building:ra2:NACLON').categories.includes('building'));
 assert.equal(c.getItem('building:yr:NAPSIS').faction,'yuri');
 assert.equal(c.getItem('building:ra2:NAPSIS').faction,'soviet');
});

test('Civilian humans, vehicles, animals and neutral buildings are available; missiles and carrier children are excluded',()=>{
 const a=load(),c=a.catalog;
 for(const v of ['ra2','yr']) {
  const other=c.ids(ctx(v,'others'));
  for(const gid of ['CIV1','BUS','COW','POLARB'])assert.ok(other.includes('unit:'+v+':'+gid));
  for(const gid of ['HORNET','ASW','V3ROCKET','DMISL','CMISL','DEATHDUMMY'])assert.ok(!other.includes('unit:'+v+':'+gid));
  assert.equal(new Set(other).size,other.length);
  assert.ok(c.ids(ctx(v,'others',{category:'animal',source:'civilian'})).includes('unit:'+v+':COW'));
  assert.ok(c.ids(ctx(v,'structures',{source:'neutral'})).includes('building:'+v+':CAOILD'));
  assert.ok(c.ids(ctx(v,'structures',{source:'campaign'})).includes('building:'+v+':NAPSYA'));
  for(const gid of ['GALITE','REDLAMP','GAGREEN'])assert.ok(!c.ids(ctx(v,'structures')).includes('building:'+v+':'+gid));
  assert.ok(c.getItem('building:'+v+':GASAND').categories.includes('defense'));
 }
});

test('Missing or borrowed unit art uses faction emblems, genuine Tesla/carrier art remains',()=>{
 const a=load();for(const v of ['ra2','yr']) {
  for(const gid of ['VLADIMIR','PENTGEN','PRES','SSRV','VLAD'])assert.match(a.itemIcon(a.catalog.getItem('unit:'+v+':'+gid)),/assets\/factions\//);
  for(const gid of ['SHK','CARRIER'])assert.match(a.itemIcon(a.catalog.getItem('unit:'+v+':'+gid)),new RegExp('/'+gid.toLowerCase()+'\\.png$'));
 }
 for(const i of a.units.concat(a.signatures))assert.ok(fs.existsSync(path.join(__dirname,'..',a.itemIcon(i))),i.id);
});

test('Filtered reorder updates the master while hidden tiers and relative order survive',()=>{
 const a=load(),c=a.core,all=ctx('ra2'),filter=ctx('ra2','units',{faction:'allied',category:'infantry'});
 let b=c.createBoard(all);const ids=['unit:ra2:E1','unit:ra2:E2','unit:ra2:ENGINEER','unit:ra2:SHK'];
 for(const id of ids)b=c.move(b,all,id,'hang');
 let view=c.project(b,filter);view=c.move(view,filter,ids[2],'hang',0);b=c.mergeView(b,filter,view);
 assert.deepEqual(plain(b.tiers.hang),[ids[2],ids[1],ids[0],ids[3]]);
 view=c.project(b,filter);view=c.move(view,filter,ids[0],'la');b=c.mergeView(b,filter,view);
 assert.deepEqual(plain(b.tiers.hang),[ids[2],ids[1],ids[3]]);assert.deepEqual(plain(b.tiers.la),[ids[0]]);
 assert.ok(c.validate(b,all));assert.equal(a.catalog.key(filter),a.catalog.key(all));
});

test('Mixed filtered moves preserve every master item exactly once and latest visible order',()=>{
 const a=load(),c=a.core,base=ctx(),queries=[base,ctx('yr','units',{faction:'allied'}),ctx('yr','units',{category:'infantry'}),ctx('yr','units',{stage:'spy'}),ctx('yr','units',{hideNational:true})];
 let b=c.createBoard(base),seed=21;
 for(let n=0;n<400;n++) {
  seed=(seed*1664525+1013904223)>>>0;const q=queries[seed%queries.length],v=c.project(b,q),ids=c.ids(q),id=ids[seed%ids.length];
  const next=c.move(v,q,id,c.locations[seed%6],seed%15);b=c.mergeView(b,q,next);
  assert.ok(c.validate(b,base));assert.deepEqual(plain(c.project(b,q).tiers),plain(next.tiers));assert.deepEqual(plain(c.project(b,q).unranked),plain(next.unranked));
 }
});

test('Filtered reset only clears matching items; undo restores whole board across filters',()=>{
 const a=load(),c=a.core,q=ctx('ra2'),f=ctx('ra2','units',{faction:'allied'});let b=c.createBoard(q);
 for(const id of ['unit:ra2:E1','unit:ra2:E2'])b=c.move(b,q,id,'hang');
 const h=c.createHistory();h.push(a.catalog.key(q),b);
 b=c.mergeView(b,f,c.reset(c.project(b,f),f));assert.deepEqual(plain(b.tiers.hang),['unit:ra2:E2']);
 assert.deepEqual(plain(h.pop(a.catalog.key(f)).tiers.hang),['unit:ra2:E1','unit:ra2:E2']);
 const empty=ctx('ra2','units',{category:'naval',stage:'spy'});assert.deepEqual(plain(c.mergeView(b,empty,c.project(b,empty))),plain(b));
});

test('Signature versions inherit combined only on first initialization and remain independent after reset',()=>{
 const a=load(),c=a.core,s=c.initial(),combined=ctx('combined','signatures'),ra=ctx('ra2','signatures'),yr=ctx('yr','signatures');
 c.ensureBoard(s,combined);s.boards['combined|signatures']=c.move(s.boards['combined|signatures'],combined,'signature:america','hang');
 c.ensureBoard(s,ra);assert.deepEqual(plain(s.boards['ra2|signatures'].tiers.hang),['signature:america']);
 s.boards['combined|signatures']=c.move(s.boards['combined|signatures'],combined,'signature:france','top');c.ensureBoard(s,yr);
 assert.deepEqual(plain(s.boards['yr|signatures'].tiers.top),['signature:france']);assert.equal(s.boards['ra2|signatures'].tiers.top.length,0);
 s.boards['ra2|signatures']=c.reset(s.boards['ra2|signatures'],ra);c.ensureBoard(s,ra);assert.equal(s.boards['ra2|signatures'].tiers.hang.length,0);
 assert.notEqual(a.catalog.key(ra),a.catalog.key(yr));assert.equal(c.ids(combined).length,9);
});

test('Regular and specialty T4, versions, and all board kinds keep separate ranks',()=>{
 const a=load(),c=a.core,s=c.initial();for(const q of [ctx(),ctx('yr','t4'),ctx('ra2'),ctx('yr','others'),ctx('yr','structures')])c.ensureBoard(s,q);
 s.boards['yr|units']=c.move(s.boards['yr|units'],ctx(),'unit:yr:CIVAN','hang');assert.ok(s.boards['yr|t4'].unranked.includes('unit:yr:CIVAN'));
 assert.equal(s.boards['ra2|units'].tiers.hang.length,0);
 assert.throws(()=>c.move(s.boards['yr|others'],ctx('yr','others'),'unit:yr:CIVAN','hang'));
});

function v2(a){const b=a.core.createBoard('ra2');return {schemaVersion:2,catalogRevision:1,lastGameVersion:'ra2',activeBoardKey:'ra2|countries',lastRegularContexts:{},boards:{'ra2|countries':b}};}
test('V2 merge prefers the active subset, keeps other placements, same-row order and old shared signatures',()=>{
 const a=load(),c=a.core,s=v2(a),all=ctx('ra2'),filter=ctx('ra2','units',{faction:'allied',category:'infantry'});
 let b=c.createBoard(all);b=c.move(b,all,'unit:ra2:E2','hang');b=c.move(b,all,'unit:ra2:E1','la');
 let f=c.createBoard(filter);f=c.move(f,filter,'unit:ra2:E1','top');f=c.move(f,filter,'unit:ra2:ENGINEER','top',0);f.title='我的步兵';
 s.boards['ra2|units|all|all|stage:all']=b;s.boards['ra2|units|allied|infantry|stage:all']=f;s.activeBoardKey='ra2|units|allied|infantry|stage:all';
 const sig=c.createBoard({mode:'signatures'});sig.context={mode:'signatures',scope:'shared'};sig.tiers.hang=['signature:france'];sig.unranked=sig.unranked.filter(x=>x!=='signature:france');s.boards['shared|signatures']=sig;
 const n=c.normalize(plain(s));assert.equal(n.schemaVersion,3);assert.equal(n.activeBoardKey,'ra2|units');
 assert.deepEqual(plain(n.boards['ra2|units'].tiers.top),['unit:ra2:ENGINEER','unit:ra2:E1']);assert.deepEqual(plain(n.boards['ra2|units'].tiers.hang),['unit:ra2:E2']);
 assert.deepEqual(plain(n.boards['combined|signatures'].tiers.hang),['signature:france']);assert.equal(n.boards['ra2|units'].title,'我的步兵');
});

test('V1 and V2 migration keeps original bytes, persists V3 order and survives refresh',()=>{
 const a=load();for(const version of [1,2]) {
  let raw=version===2?v2(a):{schemaVersion:1,activeVersion:'yr',boards:{ra2:a.core.createBoard('ra2'),yr:a.core.createBoard('yr')}};
  const oldKey='ra2-tier-list:save:v'+version,bytes=JSON.stringify(raw),values=new Map([[oldKey,bytes]]);
  const storage=a.createStorage(()=>({getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)}));
  const got=storage.load();assert.equal(got.status,'migrated');assert.equal(storage.save(got.state),'saved');assert.equal(values.get(oldKey),bytes);assert.equal(storage.load().status,'restored');
 }
});

test('Broken newer saves block fallback and overwrite; failed migration writes retain legacy',()=>{
 const a=load(),old=JSON.stringify(v2(a));for(const newer of ['{bad',JSON.stringify({...a.core.initial(),schemaVersion:99})]) {
  const m=new Map([['ra2-tier-list:save:v2',old],['ra2-tier-list:save:v3',newer]]),store=a.createStorage(()=>({getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)}));
  assert.equal(store.load().status,'protected');assert.equal(store.save(a.core.initial()),'protected');assert.equal(m.get('ra2-tier-list:save:v3'),newer);
 }
 const store=a.createStorage(()=>({getItem:k=>k.endsWith('v2')?old:null,setItem:()=>{throw Error('quota');}}));assert.equal(store.load().status,'migrated');assert.equal(store.save(a.core.initial()),'failed');
});

test('Forged contexts and stored board keys are rejected',()=>{
 const a=load();assert.throws(()=>a.catalog.context({mode:'constructor',version:'ra2'}));assert.throws(()=>a.catalog.context(ctx('yr','units',{category:'__proto__'})));
 const s=a.core.initial();s.boards.fake=s.boards['ra2|countries'];assert.throws(()=>a.core.normalize(s));
});
