import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.argv[2] || process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    let requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (requested === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (requested === '/') requested = '/dist/toy/index.html';
    if (requested.endsWith('/')) requested += 'index.html';
    const filename = path.resolve(root, '.' + requested);
    if (!filename.startsWith(path.join(root, 'dist') + path.sep)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    const body = await readFile(filename);
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:' + port + '/dist/toy/index.html'));
server.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
