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
    expect(lib.storageKey('nb1', 'art-uuid-1')).toBe('nb1|art-uuid-1');
  });
});
