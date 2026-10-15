import { describe, it, expect } from 'vitest';

describe('scaffold', () => {
  it('vitest y jsdom funcionan', () => {
    expect(1 + 1).toBe(2);
    expect(window.document).toBeDefined();
  });
});
