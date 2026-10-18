import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import '../src/lib.js';

// Rutas desde la raíz del proyecto (cwd de vitest); import.meta.url no es
// file:// bajo el entorno jsdom.
const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const locales = readdirSync(resolve(process.cwd(), '_locales'));
const msgKeys = [...JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)].map((m) => m[1]);

describe('localización del manifest (_locales)', () => {
  it('declara default_locale y existe su carpeta', () => {
    expect(manifest.default_locale).toBe(globalThis.NLM.lib.FALLBACK_LANG);
    expect(locales).toContain(manifest.default_locale);
  });

  it('usa al menos un __MSG_*__', () => expect(msgKeys.length).toBeGreaterThan(0));

  it.each(locales)('%s define todas las claves usadas en el manifest', (loc) => {
    const messages = JSON.parse(read(`_locales/${loc}/messages.json`));
    for (const k of msgKeys) expect(messages[k] && messages[k].message, `${loc}.${k}`).toBeTruthy();
  });

  it('el nombre está localizado y cabe en el límite de Chrome (45 caracteres)', () => {
    expect(manifest.name).toBe('__MSG_extName__');
    for (const loc of locales) {
      const { extName } = JSON.parse(read(`_locales/${loc}/messages.json`));
      expect(extName.message.length, loc).toBeLessThanOrEqual(45);
      expect(extName.message, loc).toMatch(/NotebookLM$/); // "… for NotebookLM": no oficial
    }
  });

  // Textos del service worker y de la página de opciones: clave literal en
  // getMessage/msg, data-i18n en el HTML, y health_<código> por problema.
  it('todas las claves que usa el código existen en todos los idiomas, con sus marcadores', async () => {
    await import('../src/health.js');
    const code = ['src/background.js', 'src/options.js'].map(read).join('\n');
    const used = new Set([
      // clave literal completa ('x') o ('x', subs); 'health_' + c va aparte
      ...[...code.matchAll(/(?:getMessage|msg)\('(\w+)'[,)]/g)].map((m) => m[1]),
      ...[...read('src/options.html').matchAll(/data-i18n="(\w+)"/g)].map((m) => m[1]),
      ...globalThis.NLM.health.CODES.map((c) => 'health_' + c),
    ]);
    expect(used.size).toBeGreaterThan(5);
    const en = JSON.parse(read('_locales/en/messages.json'));
    for (const loc of locales) {
      const messages = JSON.parse(read(`_locales/${loc}/messages.json`));
      for (const k of used) {
        expect(messages[k] && messages[k].message, `${loc}.${k}`).toBeTruthy();
        const marks = (s) => (s.match(/\$\w+\$/g) || []).sort();
        expect(marks(messages[k].message), `${loc}.${k}`).toEqual(marks(en[k].message));
      }
    }
  });

  it('los archivos que declara el manifest existen', () => {
    const files = [
      manifest.background.service_worker,
      manifest.options_ui.page,
      ...Object.values(manifest.action.default_icon),
    ];
    for (const f of files) expect(() => read(f), f).not.toThrow();
  });

  it('no pide permisos nuevos (solo storage): sin aviso extra al actualizar', () => {
    expect(manifest.permissions).toEqual(['storage']);
    expect(manifest.host_permissions).toBeUndefined();
  });

  it('extDescription cabe en el límite de Chrome (132 caracteres)', () => {
    for (const loc of locales) {
      const { extDescription } = JSON.parse(read(`_locales/${loc}/messages.json`));
      expect(extDescription.message.length, loc).toBeLessThanOrEqual(132);
    }
  });
});

describe('estilos', () => {
  it('posiciona la etiqueta con propiedades lógicas (RTL), no left/right', () => {
    const css = read('src/styles.css');
    expect(css).toMatch(/inset-inline-start:/);
    expect(css).not.toMatch(/^\s*(left|right):/m);
  });
});
