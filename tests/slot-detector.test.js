import { describe, it, expect } from 'vitest';
import { detectTransparentSlots } from '../src/shared/slot-detector.js';

/**
 * Helper to generate synthetic RGBA image data with transparent rectangular cutouts
 */
function createSyntheticImageData(width, height, cutouts = []) {
  // Start with opaque white (alpha = 255)
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(255);

  // Set cutouts to transparent (alpha = 0)
  for (const { x, y, w, h } of cutouts) {
    for (let py = y; py < y + h && py < height; py++) {
      for (let px = x; px < x + w && px < width; px++) {
        const idx = (py * width + px) * 4 + 3;
        data[idx] = 0; // Transparent
      }
    }
  }

  return { width, height, data };
}

describe('Slot Detector - detectTransparentSlots', () => {
  it('detects vertical strip slots and sorts top-to-bottom', () => {
    const width = 600;
    const height = 1800;

    const expectedCutouts = [
      { x: 50, y: 100, w: 500, h: 350 },
      { x: 50, y: 550, w: 500, h: 350 },
      { x: 50, y: 1000, w: 500, h: 350 },
      { x: 50, y: 1450, w: 500, h: 350 }
    ];

    const img = createSyntheticImageData(width, height, expectedCutouts);
    const slots = detectTransparentSlots(img, { scale: 2, minAreaFraction: 0.02 });

    expect(slots).toHaveLength(4);
    // Verify vertical order
    expect(slots[0].y).toBeLessThan(slots[1].y);
    expect(slots[1].y).toBeLessThan(slots[2].y);
    expect(slots[2].y).toBeLessThan(slots[3].y);

    // Verify bounding box bounds are close (within scale tolerance)
    for (let i = 0; i < slots.length; i++) {
      expect(Math.abs(slots[i].x - expectedCutouts[i].x)).toBeLessThanOrEqual(4);
      expect(Math.abs(slots[i].y - expectedCutouts[i].y)).toBeLessThanOrEqual(4);
      expect(Math.abs(slots[i].w - expectedCutouts[i].w)).toBeLessThanOrEqual(8);
      expect(Math.abs(slots[i].h - expectedCutouts[i].h)).toBeLessThanOrEqual(8);
    }
  });

  it('detects 2x2 grid slots and sorts top-left, top-right, bottom-left, bottom-right', () => {
    const width = 1200;
    const height = 1800;

    const expectedCutouts = [
      { x: 80, y: 100, w: 480, h: 600 },   // Top-left
      { x: 640, y: 100, w: 480, h: 600 },  // Top-right
      { x: 80, y: 900, w: 480, h: 600 },   // Bottom-left
      { x: 640, y: 900, w: 480, h: 600 }   // Bottom-right
    ];

    const img = createSyntheticImageData(width, height, expectedCutouts);
    const slots = detectTransparentSlots(img, { scale: 4, minAreaFraction: 0.02 });

    expect(slots).toHaveLength(4);
    // 1st: Top-left
    expect(slots[0].x).toBeLessThan(slots[1].x);
    expect(Math.abs(slots[0].y - slots[1].y)).toBeLessThan(50);

    // 2nd row: Bottom-left and Bottom-right
    expect(slots[2].x).toBeLessThan(slots[3].x);
    expect(slots[0].y).toBeLessThan(slots[2].y);
  });

  it('ignores tiny transparent areas below 2% canvas area', () => {
    const width = 1000;
    const height = 1000;
    // Total area = 1,000,000. 2% = 20,000.
    const cutouts = [
      { x: 100, y: 100, w: 400, h: 300 }, // Area = 120,000 (12% -> VALID)
      { x: 600, y: 600, w: 50, h: 50 }    // Area = 2,500 (0.25% -> NOISE)
    ];

    const img = createSyntheticImageData(width, height, cutouts);
    const slots = detectTransparentSlots(img, { scale: 2, minAreaFraction: 0.02 });

    expect(slots).toHaveLength(1);
    expect(slots[0].w).toBeGreaterThan(350);
  });

  it('returns empty array when image is fully opaque', () => {
    const img = createSyntheticImageData(500, 500, []);
    const slots = detectTransparentSlots(img);
    expect(slots).toHaveLength(0);
  });
});

