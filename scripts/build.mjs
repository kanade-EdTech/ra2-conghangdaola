import { mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { productionFiles, sourceText, releaseVersions } from './production-files.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const taskRoot=new URL('../',import.meta.url);
const requested=process.argv[2];
if(requested && !['toy','xhs'].includes(requested))throw new Error('Use build.mjs [toy|xhs]');
await mkdir(path.join(root,'output'),{recursive:true});
for (const platform of requested?[requested]:['toy', 'xhs']) {
  const files=await productionFiles(taskRoot,platform);
  const target = path.join(root, 'dist', platform);
  if (!target.startsWith(path.join(root,'dist') + path.sep)) throw new Error('Unsafe build path');
  await rm(target,{recursive:true,force:true});
  await mkdir(target, { recursive: true });
  for (const relative of files) {
    await mkdir(path.dirname(path.join(target, relative)), { recursive: true });
    const source = relative === 'index.html' ? 'src/index.template.html' : relative === 'platform.js' ? 'src/platforms/' + platform + '.js' : relative.startsWith('assets/') ? relative : 'src/' + relative;
    if(relative.startsWith('assets/'))await copyFile(path.join(root,source),path.join(target,relative));
    else await writeFile(path.join(target,relative),await sourceText(taskRoot,relative,platform));
  }
  await writeFile(path.join(root,'output','build-manifest-'+platform+'.json'),JSON.stringify({platform,version:releaseVersions[platform],files},null,2));
  if(platform==='toy')await writeFile(path.join(root,'output','production-files.json'),JSON.stringify(files,null,2));
  console.log('Built dist/' + platform);
}
