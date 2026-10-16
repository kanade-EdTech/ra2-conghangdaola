import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { productionFiles } from './production-files.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = await productionFiles(new URL('../',import.meta.url));
await mkdir(path.join(root,'output'),{recursive:true});
for (const platform of ['toy', 'xhs']) {
  const target = path.join(root, 'dist', platform);
  if (!target.startsWith(path.join(root,'dist') + path.sep)) throw new Error('Unsafe build path');
  await rm(target,{recursive:true,force:true});
  await mkdir(target, { recursive: true });
  for (const relative of files) {
    await mkdir(path.dirname(path.join(target, relative)), { recursive: true });
    const source = relative === 'index.html' ? 'src/index.template.html' : relative === 'platform.js' ? 'src/platforms/' + platform + '.js' : relative.startsWith('assets/') ? relative : 'src/' + relative;
    await copyFile(path.join(root,source),path.join(target,relative));
  }
  await writeFile(path.join(root,'output','production-files.json'),JSON.stringify(files,null,2));
  console.log('Built dist/' + platform);
}
