import { describe, it, expect } from 'vitest';
import '../src/lib.js';

const { lib } = globalThis.NLM;

// jslog real de NotebookLM: "id;track:...;0:<base64 de [[notebook, artefacto, ...]]>"
function makeJslog(notebook, artifact) {
  return '267035;track:generic_click,impression;0:' + btoa(JSON.stringify([[notebook, artifact]]));
}

describe('parsePlaybackSeconds', () => {
  it('parsa "MM:SS / MM:SS"', () => {
    expect(lib.parsePlaybackSeconds('00:11 / 19:07')).toBe(11);
    expect(lib.parsePlaybackSeconds('17:55 / 27:56')).toBe(17 * 60 + 55);
  });
  it('parsa horas "H:MM:SS / ..." (resúmenes largos)', () => {
    expect(lib.parsePlaybackSeconds('1:02:03 / 1:10:00')).toBe(3723);
  });
  it('tolera espacios extra', () => {
    expect(lib.parsePlaybackSeconds('  00:05 / 19:07  ')).toBe(5);
  });
  it('devuelve null si no hay patrón de tiempo', () => {
    expect(lib.parsePlaybackSeconds('')).toBeNull();
    expect(lib.parsePlaybackSeconds('sin tiempo')).toBeNull();
    expect(lib.parsePlaybackSeconds(null)).toBeNull();
  });
  it('rechaza segundos decimales (no matchea el "5" de "00:0.5")', () => {
    expect(lib.parsePlaybackSeconds('00:0.5 / 19:07')).toBeNull();
  });
});

describe('artifactIdFromJslog', () => {
  it('extrae el UUID del artefacto del base64', () => {
    const jslog = makeJslog('0d7c3e1a-5b2f-4a8e-9c61-2f4b8d0e7a35', '7a1e9c42-3d6b-4f05-b8e2-91c0d5a4f6e8');
    expect(lib.artifactIdFromJslog(jslog)).toBe('7a1e9c42-3d6b-4f05-b8e2-91c0d5a4f6e8');
  });
  it('devuelve null sin jslog o sin base64 válido', () => {
    expect(lib.artifactIdFromJslog(null)).toBeNull();
    expect(lib.artifactIdFromJslog('267035;track:x')).toBeNull();
    expect(lib.artifactIdFromJslog('0:%%%%')).toBeNull();
  });
  it('jslog real de la inspección (con array largo y nulls)', () => {
    const inner = [
      ['0d7c3e1a-5b2f-4a8e-9c61-2f4b8d0e7a35', 'c3f2a8d1-6e4b-4c97-a05d-8b1e2f7c9d40',
       null, null, null, null, null, null, null, null, null, null, null, null, null, null,
       1, null, ['c3f2a8d1-6e4b-4c97-a05d-8b1e2f7c9d40', 1, null, null, null, null, 1]],
      null,
      '0d7c3e1a-5b2f-4a8e-9c61-2f4b8d0e7a35',
      'c3f2a8d1-6e4b-4c97-a05d-8b1e2f7c9d40',
    ];
    const jslog = '229237;track:generic_click,impression;0:' + btoa(JSON.stringify(inner));
    expect(lib.artifactIdFromJslog(jslog)).toBe('c3f2a8d1-6e4b-4c97-a05d-8b1e2f7c9d40');
  });
});
