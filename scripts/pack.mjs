// Genera dist/last-time-<versión>.zip para subir a la Chrome Web Store, solo
// con lo que necesita la extensión (manifest, _locales, src, iconos PNG).
// Escritor ZIP mínimo (deflate de zlib) para no añadir dependencias.
//
// Ejecutar: npm run pack
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deflateRawSync, crc32 } from 'node:zlib';
import process from 'node:process';

const INCLUDE = ['manifest.json', '_locales', 'src', 'icons'];
const EXCLUDE = /\.svg$/; // la fuente del icono no viaja en el paquete

function walk(root, rel) {
  const abs = join(root, rel);
  if (!statSync(abs).isDirectory()) return [rel];
  return readdirSync(abs)
    .sort()
    .flatMap((name) => walk(root, rel + '/' + name));
}

// Rutas relativas con '/', ordenadas: el zip sale idéntico en cada ejecución.
export function collectFiles(root) {
  return INCLUDE.flatMap((p) => walk(root, p)).filter((f) => !EXCLUDE.test(f));
}

// Fecha fija (1/1/2026 00:00) en formato DOS: zips reproducibles.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

export function createZip(root, files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const name of files) {
    const data = readFileSync(join(root, name));
    const packed = deflateRawSync(data, { level: 9 });
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // versión necesaria
    local.writeUInt16LE(0x0800, 6); // nombres en UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, packed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // versión creadora
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + packed.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, eocd]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = process.cwd();
  const { version } = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  const files = collectFiles(root);
  mkdirSync(join(root, 'dist'), { recursive: true });
  const out = `dist/last-time-${version}.zip`;
  writeFileSync(join(root, out), createZip(root, files));
  console.log(`${out} (${files.length} archivos)`);
}
