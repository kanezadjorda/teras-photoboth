import { describe, it, expect } from 'vitest';
import { calculateCoverFit, getSlotPhotoIndex, getUniquePhotoCount, renderComposite } from '../src/shared/composite.js';

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

describe('Slot Photo Index Logic (Double Strip / Shared Slots)', () => {
  it('correctly retrieves 1-based photo index with fallback to slot position', () => {
    expect(getSlotPhotoIndex({ x: 0, y: 0, w: 100, h: 100, photo_index: 2 }, 0)).toBe(2);
    expect(getSlotPhotoIndex({ x: 0, y: 0, w: 100, h: 100, photo_index: '3' }, 0)).toBe(3);
    // Fallback when missing or invalid
    expect(getSlotPhotoIndex({ x: 0, y: 0, w: 100, h: 100 }, 0)).toBe(1);
    expect(getSlotPhotoIndex({ x: 0, y: 0, w: 100, h: 100 }, 3)).toBe(4);
    expect(getSlotPhotoIndex({ x: 0, y: 0, w: 100, h: 100, photo_index: 0 }, 1)).toBe(2);
  });

  it('calculates unique photo count for double strip (6 slots, 3 photos)', () => {
    // 6-slot template where left strip is 1,2,3 and right strip is 1,2,3
    const doubleStripSlots = [
      { x: 50, y: 50, w: 500, h: 400, photo_index: 1 },
      { x: 50, y: 500, w: 500, h: 400, photo_index: 2 },
      { x: 50, y: 950, w: 500, h: 400, photo_index: 3 },
      { x: 650, y: 50, w: 500, h: 400, photo_index: 1 },
      { x: 650, y: 500, w: 500, h: 400, photo_index: 2 },
      { x: 650, y: 950, w: 500, h: 400, photo_index: 3 }
    ];

    expect(getUniquePhotoCount(doubleStripSlots)).toBe(3);
  });

  it('calculates unique photo count for standard 1:1 slots without explicit photo_index', () => {
    const standardSlots = [
      { x: 100, y: 100, w: 1000, h: 400 },
      { x: 100, y: 600, w: 1000, h: 400 },
      { x: 100, y: 1100, w: 1000, h: 400 },
      { x: 100, y: 1600, w: 1000, h: 400 }
    ];

    expect(getUniquePhotoCount(standardSlots)).toBe(4);
  });

  it('handles empty or undefined slot arrays with default photo count', () => {
    expect(getUniquePhotoCount([])).toBe(3);
    expect(getUniquePhotoCount(null)).toBe(3);
  });

  it('correctly maps shared photos to multiple slots in renderComposite', () => {
    const drawCalls = [];
    const mockContext = {
      fillStyle: '',
      fillRect: () => {},
      save: () => {},
      beginPath: () => {},
      rect: () => {},
      clip: () => {},
      drawImage: (img, sx, sy, sw, sh, dx, dy, dw, dh) => {
        drawCalls.push({ img, dx, dy });
      },
      restore: () => {}
    };

    const mockCanvas = {
      getContext: () => mockContext,
      width: 0,
      height: 0
    };

    const photoA = { width: 1000, height: 1000, id: 'photoA' };
    const photoB = { width: 1000, height: 1000, id: 'photoB' };

    const slots = [
      { x: 10, y: 10, w: 200, h: 200, photo_index: 1 },
      { x: 10, y: 250, w: 200, h: 200, photo_index: 2 },
      { x: 250, y: 10, w: 200, h: 200, photo_index: 1 } // Shared with slot 1
    ];

    renderComposite({
      targetCanvas: mockCanvas,
      slots,
      photos: [photoA, photoB]
    });

    expect(drawCalls.length).toBe(3);
    // Slot 1 uses photoA
    expect(drawCalls[0].img).toBe(photoA);
    expect(drawCalls[0].dx).toBe(10);
    expect(drawCalls[0].dy).toBe(10);

    // Slot 2 uses photoB
    expect(drawCalls[1].img).toBe(photoB);
    expect(drawCalls[1].dx).toBe(10);
    expect(drawCalls[1].dy).toBe(250);

    // Slot 3 ALSO uses photoA (shared photo_index: 1)
    expect(drawCalls[2].img).toBe(photoA);
    expect(drawCalls[2].dx).toBe(250);
    expect(drawCalls[2].dy).toBe(10);
  });
});



