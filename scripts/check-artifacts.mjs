import { readdir, readFile, stat, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
const { scripts: expectedScripts, productionFiles } = await import('./production-files.mjs');
const expectedFiles = await productionFiles(new URL('../',import.meta.url));
async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(filename));
    else files.push(filename);
  }
  return files;
}
const forbidden = [
  [/\b(?:fetch|eval)\s*\(/, 'network or dynamic execution'],
  [/\b(?:XMLHttpRequest|WebSocket|EventSource|RTCPeerConnection|WebAssembly|SharedWorker|Worker)\b/, 'forbidden runtime API'],
  [/\bnew\s+Function\b/, 'dynamic execution'],
  [/\b(?:import|export)\s+(?:\{|\*|default|const|let|var|function|class)|\bimport\s*\(/, 'module syntax'],
  [/\b(?:navigator|global|window)\s*\.\s*(?:clipboard|serviceWorker|geolocation|open|prompt)\b/, 'forbidden browser capability'],
  [/\.\s*(?:download|createObjectURL|writeText|requestFullscreen|execCommand)\b/, 'download / clipboard / fullscreen'],
  [/https?:\/\//, 'external URL']
];
for (const platform of ['toy', 'xhs']) {
  const directory = path.join(root, 'dist', platform);
  const files = await walk(directory);
  let bytes = 0;
  const actualFiles = files.map(file => path.relative(directory, file).split(path.sep).join('/')).sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) throw new Error('Unexpected production file list: ' + platform);
  const html = await readFile(path.join(directory, 'index.html'), 'utf8');
  if (/<(?:iframe|object|base)\b|\son\w+\s*=|javascript:|type\s*=\s*["']module/i.test(html)) throw new Error('Unsupported HTML');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
  if (scripts.length !== expectedScripts.length || scripts.some((match, index) => !match[1].includes('src="./' + expectedScripts[index] + '"') || match[2].trim())) throw new Error('Scripts must be external and dependency-ordered');
  for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) {
    if (!match[1].startsWith('./')) throw new Error('Nonrelative HTML resource: ' + match[1]);
    await access(path.resolve(directory, match[1]));
  }
  for (const file of files) {
    bytes += (await stat(file)).size;
    if (!['.html', '.js', '.css', '.png'].includes(path.extname(file))) throw new Error('Unexpected file: ' + file);
    if (path.extname(file) === '.js') {
      const code = await readFile(file, 'utf8');
      new vm.Script(code, { filename: file });
      if (platform === 'xhs') {
        for (const [pattern, name] of forbidden) if (pattern.test(code)) throw new Error(name + ': ' + file);
        if (/\?\.|\?\?|\.\.\./.test(code)) throw new Error('Post-ES2017 syntax: ' + file);
      }
    }
  }
  if (bytes > 2 * 1024 * 1024) throw new Error('Project size budget exceeded');
  console.log(platform + ': ' + files.length + ' files, ' + bytes + ' bytes; paths, syntax and static capability checks passed');
}
console.log('Static checks do not establish Chrome 61 or native container compatibility.');
