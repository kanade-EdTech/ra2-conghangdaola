import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

export const scripts = ['data.js','data/units.js','data/others.js','data/buildings.js','data/signatures.js','core/catalog.js',
  'core/ranking.js','core/storage.js','ui/dialog.js','ui/interaction/session.js',
  'ui/interaction/hit-test.js','ui/interaction/input.js','ui/drag.js','export/poster.js','platform.js','app.js'];
export async function productionFiles(root) {
  const context = vm.createContext({window:{}});
  for (const file of scripts.slice(0,6)) vm.runInContext(await readFile(new URL('src/' + file,root),'utf8'),context);
  const app = context.window.RA2;
  const assets = app.countries.concat(app.units,app.signatures).map(i=>app.itemIcon(i).slice(2))
    .concat(Object.keys(app.factionIcons).map(f=>app.factionIcons[f].slice(2)));
  return [...new Set(['index.html','styles/app.css',...scripts,...assets])].sort();
}
