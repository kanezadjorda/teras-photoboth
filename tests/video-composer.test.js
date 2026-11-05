import { describe, it, expect, vi } from 'vitest';
import { getOptimalVideoMimeType } from '../src/shared/video-composer.js';

describe('Video Composer Helpers (PRD Multi-Variant)', () => {
  it('returns webm fallback when MediaRecorder is undefined', () => {
    const originalMediaRecorder = globalThis.MediaRecorder;
    try {
      delete globalThis.MediaRecorder;
      expect(getOptimalVideoMimeType()).toBe('video/webm');
    } finally {
      globalThis.MediaRecorder = originalMediaRecorder;
    }
  });

  it('selects preferred mp4 or webm based on isTypeSupported', () => {
    const originalMediaRecorder = globalThis.MediaRecorder;
    try {
      globalThis.MediaRecorder = {
        isTypeSupported: vi.fn((type) => type.includes('mp4;codecs=avc1'))
      };
      expect(getOptimalVideoMimeType()).toBe('video/mp4;codecs=avc1');

      globalThis.MediaRecorder = {
        isTypeSupported: vi.fn((type) => type.includes('video/webm;codecs=vp9'))
      };
      expect(getOptimalVideoMimeType()).toBe('video/webm;codecs=vp9');
    } finally {
      globalThis.MediaRecorder = originalMediaRecorder;
    }
  });
});
