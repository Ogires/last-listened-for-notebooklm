import { describe, it, expect } from 'vitest';
import '../src/lib.js';

const { lib } = globalThis.NLM;

describe('getNotebookIdFromUrl', () => {
  it('extrae el id del cuaderno de la URL', () => {
    expect(
      lib.getNotebookIdFromUrl('https://notebooklm.google.com/notebook/abc-123?tab=studio')
    ).toBe('abc-123');
  });
  it('devuelve null si no hay cuaderno en la URL', () => {
    expect(lib.getNotebookIdFromUrl('https://notebooklm.google.com/')).toBeNull();
  });
  it('devuelve null con URL vacía', () => {
    expect(lib.getNotebookIdFromUrl(null)).toBeNull();
  });
});

describe('storageKey', () => {
  it('combina cuaderno y resumen con separador', () => {
    expect(lib.storageKey('nb1', 'mi resumen')).toBe('nb1|mi resumen');
  });
});

describe('overviewKeyFromCardData', () => {
  it('normaliza el título (trim, minúsculas, espacios)', () => {
    expect(lib.overviewKeyFromCardData('  Mi   Resumen ', 0)).toBe('mi resumen');
  });
  it('usa el índice si no hay título', () => {
    expect(lib.overviewKeyFromCardData('', 2)).toBe('#2');
    expect(lib.overviewKeyFromCardData(null, 0)).toBe('#0');
  });
});
