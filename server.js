// Serveur local : sert public/ et les fonctions de api/ comme le fait Vercel.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import generate from './api/generate.js';
import ccam from './api/ccam.js';

const PORT = process.env.PORT || 3000;
const PUBLIC = join(import.meta.dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };
const ROUTES = { '/api/generate': generate, '/api/ccam': ccam };

createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (ROUTES[path]) {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    req.body = raw ? JSON.parse(raw) : {};
    return ROUTES[path](req, res);
  }
  const file = normalize(join(PUBLIC, path === '/' ? 'index.html' : path));
  if (!file.startsWith(PUBLIC)) return res.writeHead(403).end();
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }).end(data);
  } catch {
    res.writeHead(404).end('Introuvable');
  }
}).listen(PORT, () => console.log(`Dentistory sur http://localhost:${PORT}`));
