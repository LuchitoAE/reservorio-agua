#!/usr/bin/env node
/**
 * Servidor de desarrollo local.
 *
 * - Sirve la carpeta web/ en http://localhost:5173
 * - Hace proxy de /api/* al ESP32 (ESP32_URL=http://192.168.1.50)
 * - Si el ESP32 no responde, devuelve 502 y el dashboard entra en modo demo.
 *
 * Uso:
 *   npm run dev
 *   ESP32_URL=http://192.168.1.50 npm run dev
 *   PORT=8080 npm run dev
 */

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'web');
const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || '0.0.0.0';
const ESP32_URL = (process.env.ESP32_URL || '').replace(/\/$/, '');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...headers,
  });
  res.end(body);
}

function serveStatic(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'ruta invalida');
  }

  if (pathname.endsWith('/')) pathname += 'index.html';
  if (pathname === '/') pathname = '/index.html';

  const filePath = path.join(ROOT, pathname);
  if (!filePath.startsWith(ROOT)) return send(res, 400, 'ruta invalida');

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      return send(res, 404, `404: ${pathname}`, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    const ext = path.extname(filePath).toLowerCase();
    const stream = fs.createReadStream(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
    });
    stream.pipe(res);
  });
}

async function proxy(req, res) {
  if (!ESP32_URL) {
    return send(res, 502, JSON.stringify({ error: 'ESP32_URL no configurada' }), {
      'Content-Type': 'application/json',
    });
  }

  const target = `${ESP32_URL}${req.url}`;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: { 'Content-Type': req.headers['content-type'] || 'application/json' },
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
      signal: AbortSignal.timeout(4000),
    });

    const body = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') || 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch (error) {
    send(
      res,
      502,
      JSON.stringify({ error: 'ESP32 no responde', detail: error.message, target }),
      { 'Content-Type': 'application/json' },
    );
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    return send(res, 204, '');
  }
  if (req.url?.startsWith('/api/')) {
    return proxy(req, res);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'metodo no permitido');
  }
  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  const nets = Object.values(os.networkInterfaces())
    .flat()
    .filter((net) => net && net.family === 'IPv4' && !net.internal)
    .map((net) => net.address);

  console.log('');
  console.log('  Reservorio de Agua · dashboard local');
  console.log(`  Local:   http://localhost:${PORT}`);
  nets.forEach((ip) => console.log(`  Red:     http://${ip}:${PORT}`));
  console.log(`  ESP32:   ${ESP32_URL || '(sin configurar: usa ESP32_URL=...)'}`);
  console.log('');
});
