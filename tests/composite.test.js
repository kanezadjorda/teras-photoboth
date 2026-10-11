import { describe, it, expect } from 'vitest';
import { calculateCoverFit } from '../src/shared/composite.js';

describe('Composite Engine - calculateCoverFit', () => {
  it('handles identical aspect ratios with no crop', () => {
    const result = calculateCoverFit(1920, 1080, 1920, 1080);
    expect(result).toEqual({ sx: 0, sy: 0, sw: 1920, sh: 1080 });
  });

  it('crops left and right when source is wider than target slot', () => {
    // 16:9 source (1920x1080) into 1:1 slot (500x500)
    const result = calculateCoverFit(1920, 1080, 500, 500);
    expect(result.sh).toBe(1080);
    expect(result.sw).toBe(1080);
    expect(result.sx).toBe(420); // (1920 - 1080) / 2
    expect(result.sy).toBe(0);
  });

  it('crops top and bottom when source is taller than target slot', () => {
    // 9:16 source (1080x1920) into 1:1 slot (500x500)
    const result = calculateCoverFit(1080, 1920, 500, 500);
    expect(result.sw).toBe(1080);
    expect(result.sh).toBe(1080);
    expect(result.sx).toBe(0);
    expect(result.sy).toBe(420); // (1920 - 1080) / 2
  });

  it('handles typical 4R slot dimensions accurately', () => {
    // 1920x1080 camera into standard slot 500x380 (aspect ~ 1.315)
    // 1920/1080 = 1.777 > 1.315 -> wider, crop sides
    const result = calculateCoverFit(1920, 1080, 500, 380);
    expect(result.sh).toBe(1080);
    expect(result.sw).toBe(Math.round(1080 * (500 / 380)));
    expect(result.sx).toBe(Math.round((1920 - result.sw) / 2));
    expect(result.sy).toBe(0);
  });

  it('throws error for non-positive dimensions', () => {
    expect(() => calculateCoverFit(0, 1080, 500, 500)).toThrow();
    expect(() => calculateCoverFit(1920, -10, 500, 500)).toThrow();
    expect(() => calculateCoverFit(1920, 1080, 0, 500)).toThrow();
  });
});

