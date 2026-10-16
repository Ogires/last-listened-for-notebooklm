import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectFiles, createZip } from '../scripts/pack.mjs';

// Rutas desde la raíz del proyecto (cwd de vitest).
const root = process.cwd();
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));

describe('empaquetado para la Chrome Web Store', () => {
  const files = collectFiles(root);

  it('incluye todo lo que referencia el manifest', () => {
    const cs = manifest.content_scripts.flatMap((c) => [...c.js, ...c.css]);
    const needed = ['manifest.json', ...cs, ...Object.values(manifest.icons)];
    for (const f of needed) expect(files, f).toContain(f);
  });

  it('incluye un messages.json por idioma', () => {
    expect(files).toContain(`_locales/${manifest.default_locale}/messages.json`);
    expect(files.filter((f) => f.startsWith('_locales/')).length).toBeGreaterThan(1);
  });

  it('no incluye desarrollo: node_modules, tests, docs, scripts, fuente SVG', () => {
    for (const f of files) {
      expect(f).not.toMatch(/^(node_modules|tests|docs|scripts|dist)\//);
      expect(f).not.toMatch(/\.svg$/);
    }
  });

  it('genera un zip válido con una entrada por archivo', () => {
    const zip = createZip(root, files);
    // EOCD: firma 0x06054b50 en los últimos 22 bytes (sin comentario)
    const eocd = zip.length - 22;
    expect(zip.readUInt32LE(eocd)).toBe(0x06054b50);
    expect(zip.readUInt16LE(eocd + 10)).toBe(files.length);
  });
});
