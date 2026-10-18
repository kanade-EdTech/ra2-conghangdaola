import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

export const scripts = ['data.js','data/units.js','data/others.js','data/buildings.js','data/signatures.js','core/catalog.js',
  'core/ranking.js','core/storage.js','ui/dialog.js','ui/interaction/session.js',
  'ui/interaction/hit-test.js','ui/interaction/input.js','ui/drag.js','export/poster.js','platform.js','app.js'];
export const releaseVersions = { toy:'0.4.3', xhs:'0.4.3' };
export function scriptsFor(platform) { return platform==='xhs'?scripts.filter(f=>f!=='data/others.js'):scripts; }
async function rawSourceText(root,relative,platform) {
  if(platform==='xhs'&&relative==='data/buildings.js') {
    const buildings=JSON.parse(await readFile(new URL('data/building-catalog.json',root),'utf8')).filter(i=>i.rankingPool==='regular');
    return '(function(global){global.RA2.units=global.RA2.units.concat('+JSON.stringify(buildings)+');})(window);\n';
  }
  if(relative==='index.html') {
    let html=await readFile(new URL('src/index.template.html',root),'utf8');
    if(platform==='xhs') html=html.replace(/^.*data-specialty="(?:others|structures)".*\r?\n/gm,'').replace(/^.*src="\.\/data\/others.js".*\r?\n/gm,'');
    return html;
  }
  const source=relative==='platform.js'?'src/platforms/'+platform+'.js':'src/'+relative;
  let code=await readFile(new URL(source,root),'utf8');
  if(platform==='xhs'&&relative==='data.js') code+='\nwindow.RA2.buildProfile='+JSON.stringify({version:releaseVersions.xhs,disabledModes:['others','structures'],storageKey:'ra2-tier-list:xhs:save:v3'})+';\n';
  return code;
}
const profileCache=new Map();
export async function xhsAssetProfile(root) {
  if(!profileCache.has(root.href))profileCache.set(root.href,(async()=>{
    const context=vm.createContext({window:{}});
    for(const file of scriptsFor('xhs')) {
      vm.runInContext(await rawSourceText(root,file,'xhs'),context);
      if(file==='core/catalog.js')break;
    }
    const app=context.window.RA2;
    const paths=[...new Set(app.countries.concat(app.units,app.signatures).map(i=>app.itemIcon(i).slice(2))
      .concat(Object.values(app.factionIcons).map(p=>p.slice(2))))].sort();
    const hashes=new Map(),aliases={},files=[];let bytesSaved=0;
    for(const path of paths) {
      const bytes=await readFile(new URL(path,root)),hash=createHash('sha256').update(bytes).digest('hex');
      const canonical=hashes.get(hash);
      if(canonical)bytesSaved+=bytes.length;
      else{hashes.set(hash,path);files.push(path);}
      aliases[path]=canonical || path;
    }
    const icon=p=>p?'./'+aliases[p.slice(2)]:p;
    app.countries.concat(app.units,app.signatures).forEach(i=>{i.iconPath=icon(i.iconPath);});
    Object.keys(app.factionIcons).forEach(f=>{app.factionIcons[f]=icon(app.factionIcons[f]);});
    return {app,aliases,files,originalCount:paths.length,uniqueCount:files.length,bytesSaved};
  })());
  return profileCache.get(root.href);
}
export async function sourceText(root,relative,platform) {
  if(platform!=='xhs')return rawSourceText(root,relative,platform);
  if(['data.js','data/units.js','data/buildings.js','data/signatures.js'].includes(relative)) {
    const {app}=await xhsAssetProfile(root);
    if(relative==='data.js') {
      const paths=Object.fromEntries(app.countries.map(i=>[i.id,i.iconPath]));
      return (await rawSourceText(root,relative,platform))+'\n(function(a){var icons='+JSON.stringify(paths)+';a.countries.forEach(function(i){i.iconPath=icons[i.id];});a.factionIcons='+JSON.stringify(app.factionIcons)+';})(window.RA2);\n';
    }
    const data=relative==='data/signatures.js'?app.signatures:app.units.filter(i=>relative==='data/units.js'?i.kind==='unit':i.kind==='building');
    const assignment=relative==='data/signatures.js'?'global.RA2.signatures=':relative==='data/units.js'?'global.RA2.units=':'global.RA2.units=global.RA2.units.concat(';
    return '(function(global){'+assignment+JSON.stringify(data)+(relative==='data/buildings.js'?')':'')+';})(window);\n';
  }
  return rawSourceText(root,relative,platform);
}
export async function productionFiles(root,platform='toy') {
  if(platform==='xhs') {
    const profile=await xhsAssetProfile(root);
    return [...new Set(['index.html','styles/app.css',...scriptsFor(platform),...profile.files])].sort();
  }
  const context = vm.createContext({window:{}});
  for (const file of scriptsFor(platform)) {
    vm.runInContext(await sourceText(root,file,platform),context);
    if(file==='core/catalog.js')break;
  }
  const app = context.window.RA2;
  const assets = app.countries.concat(app.units,app.signatures).map(i=>app.itemIcon(i).slice(2))
    .concat(Object.keys(app.factionIcons).map(f=>app.factionIcons[f].slice(2)));
  return [...new Set(['index.html','styles/app.css',...scriptsFor(platform),...assets])].sort();
}
