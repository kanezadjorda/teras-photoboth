import { describe, it, expect } from 'vitest';
import {
  createGifFromRgbaFrames,
  bytesToDataUrl
} from '../src/shared/gif.js';

describe('GIF Generator (Pure Logic)', () => {
  it('throws error when no frames are provided or dimensions are invalid', () => {
    expect(() => createGifFromRgbaFrames([], { width: 10, height: 10 })).toThrow();
    expect(() => createGifFromRgbaFrames([new Uint8Array(400)], { width: 0, height: 10 })).toThrow();
  });

  it('encodes multiple RGBA frames into valid GIF89a format', () => {
    const width = 16;
    const height = 16;
    const frameSize = width * height * 4;

    // Frame 1: Red
    const frame1 = new Uint8ClampedArray(frameSize);
    for (let i = 0; i < frameSize; i += 4) {
      frame1[i] = 255;     // R
      frame1[i + 1] = 0;   // G
      frame1[i + 2] = 0;   // B
      frame1[i + 3] = 255; // A
    }

    // Frame 2: Blue
    const frame2 = new Uint8ClampedArray(frameSize);
    for (let i = 0; i < frameSize; i += 4) {
      frame2[i] = 0;
      frame2[i + 1] = 0;
      frame2[i + 2] = 255;
      frame2[i + 3] = 255;
    }

    const gifBytes = createGifFromRgbaFrames([frame1, frame2], {
      width,
      height,
      delay: 500,
      repeat: 0
    });

    expect(gifBytes).toBeInstanceOf(Uint8Array);
    expect(gifBytes.length).toBeGreaterThan(50);

    // Verify GIF89a header
    const header = String.fromCharCode(...gifBytes.slice(0, 6));
    expect(header).toBe('GIF89a');

    // Verify data URL conversion
    const dataUrl = bytesToDataUrl(gifBytes);
    expect(dataUrl.startsWith('data:image/gif;base64,')).toBe(true);
  });
});
