#!/usr/bin/env node
/**
 * Copia web/ a firmware/data/ para subirla al ESP32 con LittleFS.
 *
 *   npm run sync
 *   pio run -d firmware -t uploadfs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'web');
const target = path.join(root, 'firmware', 'data');

function copyRecursive(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyRecursive(src, dst);
    else if (entry.isFile()) fs.copyFileSync(src, dst);
  }
}

function countFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
    if (entry.isDirectory()) return total + countFiles(path.join(dir, entry.name));
    return total + 1;
  }, 0);
}

if (!fs.existsSync(source)) {
  console.error(`No existe ${source}`);
  process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
copyRecursive(source, target);

console.log(`Copiados ${countFiles(target)} archivos a firmware/data/`);
console.log('Ahora: pio run -d firmware -t uploadfs');
