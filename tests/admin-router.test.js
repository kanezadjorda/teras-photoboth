import { describe, it, expect } from 'vitest';
import { parseAdminRoute, toAdminHash } from '../src/admin/router.js';

describe('Admin Hash Router Helpers (PRD F-14)', () => {
  it('parses valid route with leading slash', () => {
    expect(parseAdminRoute('#/laporan')).toBe('laporan');
  });

  it('parses valid route without leading slash', () => {
    expect(parseAdminRoute('#laporan')).toBe('laporan');
  });

  it('handles uppercase route names case-insensitively', () => {
    expect(parseAdminRoute('#/LAPORAN')).toBe('laporan');
  });

  it('falls back to beranda on empty, undefined, or unknown hash', () => {
    expect(parseAdminRoute('')).toBe('beranda');
    expect(parseAdminRoute(undefined)).toBe('beranda');
    expect(parseAdminRoute('#/tidak-ada')).toBe('beranda');
  });

  it('formats route into admin hash string', () => {
    expect(toAdminHash('event')).toBe('#/event');
  });
});
