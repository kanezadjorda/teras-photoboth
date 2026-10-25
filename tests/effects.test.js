import { describe, it, expect, vi } from 'vitest';
import { EFFECT_PRESETS, EFFECT_LIST, getEffect } from '../src/shared/effects.js';
import { composeSession } from '../src/shared/composite.js';

describe('Photo Effects (PRD F-27, F-28)', () => {
  describe('Presets Configuration', () => {
    it('defines exactly 7 photo effect presets', () => {
      expect(EFFECT_LIST.length).toBe(7);
      expect(Object.keys(EFFECT_PRESETS)).toEqual([
        'normal',
        'bw',
        'sepia',
        'vintage',
        'cerah',
        'hangat',
        'dingin'
      ]);
    });

    it('contains correct filter strings and labels for each preset', () => {
      expect(EFFECT_PRESETS.normal).toEqual({
        id: 'normal',
        label: 'Normal',
        filter: 'none'
      });

      expect(EFFECT_PRESETS.bw).toEqual({
        id: 'bw',
        label: 'Hitam Putih',
        filter: 'grayscale(1) contrast(1.1)'
      });

      expect(EFFECT_PRESETS.sepia).toEqual({
        id: 'sepia',
        label: 'Sepia',
        filter: 'sepia(0.8) contrast(1.05)'
      });

      expect(EFFECT_PRESETS.vintage).toEqual({
        id: 'vintage',
        label: 'Vintage',
        filter: 'sepia(0.35) contrast(1.1) saturate(0.85) brightness(1.05)'
      });

      expect(EFFECT_PRESETS.cerah).toEqual({
        id: 'cerah',
        label: 'Cerah',
        filter: 'brightness(1.1) contrast(1.05) saturate(1.2)'
      });

      expect(EFFECT_PRESETS.hangat).toEqual({
        id: 'hangat',
        label: 'Hangat',
        filter: 'sepia(0.2) saturate(1.2) hue-rotate(-10deg)'
      });

      expect(EFFECT_PRESETS.dingin).toEqual({
        id: 'dingin',
        label: 'Dingin',
        filter: 'saturate(1.1) hue-rotate(15deg) brightness(1.02)'
      });
    });
  });

  describe('getEffect selector and fallback', () => {
    it('returns the requested preset for valid ID', () => {
      expect(getEffect('bw')).toBe(EFFECT_PRESETS.bw);
      expect(getEffect('sepia')).toBe(EFFECT_PRESETS.sepia);
      expect(getEffect('vintage')).toBe(EFFECT_PRESETS.vintage);
      expect(getEffect('cerah')).toBe(EFFECT_PRESETS.cerah);
      expect(getEffect('hangat')).toBe(EFFECT_PRESETS.hangat);
      expect(getEffect('dingin')).toBe(EFFECT_PRESETS.dingin);
      expect(getEffect('normal')).toBe(EFFECT_PRESETS.normal);
    });

    it('handles case-insensitive lookup and whitespace', () => {
      expect(getEffect('BW')).toBe(EFFECT_PRESETS.bw);
      expect(getEffect('  SePia  ')).toBe(EFFECT_PRESETS.sepia);
    });

    it('falls back to normal for unknown effect IDs', () => {
      expect(getEffect('cyberpunk')).toBe(EFFECT_PRESETS.normal);
      expect(getEffect('unknown')).toBe(EFFECT_PRESETS.normal);
      expect(getEffect('glitch')).toBe(EFFECT_PRESETS.normal);
    });

    it('falls back to normal for empty, null, undefined or non-string inputs', () => {
      expect(getEffect('')).toBe(EFFECT_PRESETS.normal);
      expect(getEffect(null)).toBe(EFFECT_PRESETS.normal);
      expect(getEffect(undefined)).toBe(EFFECT_PRESETS.normal);
      expect(getEffect(123)).toBe(EFFECT_PRESETS.normal);
      expect(getEffect({})).toBe(EFFECT_PRESETS.normal);
    });
  });

  describe('composeSession integration', () => {
    it('applies effect filter only to photo drawing and leaves overlay unfiltered', () => {
      const mockCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        filter: 'none',
        fillStyle: '#000000'
      };

      const mockCanvas = {
        width: 1200,
        height: 1800,
        getContext: vi.fn(() => mockCtx)
      };

      const template = {
        slots: [{ x: 50, y: 50, w: 500, h: 400, photo_index: 1 }]
      };
      const photo = { width: 800, height: 600 };
      const overlayImg = { width: 1200, height: 1800 };

      composeSession({
        template,
        photos: [photo],
        effectId: 'bw',
        templateImage: overlayImg,
        targetCanvas: mockCanvas
      });

      // Filter should have been set to bw filter during photo draw
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.filter).toBe('grayscale(1) contrast(1.1)');
      expect(mockCtx.restore).toHaveBeenCalled();

      // Draw calls: 1st is photo, 2nd is template overlay
      expect(mockCtx.drawImage).toHaveBeenCalledTimes(2);
      expect(mockCtx.drawImage).toHaveBeenNthCalledWith(
        1,
        photo,
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        50,
        50,
        500,
        400
      );
      expect(mockCtx.drawImage).toHaveBeenNthCalledWith(
        2,
        overlayImg,
        0,
        0,
        1200,
        1800
      );
    });
  });
});
