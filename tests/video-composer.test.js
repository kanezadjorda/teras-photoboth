import { describe, it, expect, vi } from 'vitest';
import { getOptimalVideoMimeType, blobToDataUrl, loadVideoElement } from '../src/shared/video-composer.js';

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

  it('converts blob to dataUrl using blobToDataUrl', async () => {
    const blob = new Blob(['hello-world'], { type: 'text/plain' });
    const dataUrl = await blobToDataUrl(blob);
    expect(dataUrl).toContain('data:text/plain;base64,');
  });

  it('loadVideoElement configures video attributes and does not set crossOrigin for blob/data URLs', async () => {
    const mockVideo = {
      muted: false,
      playsInline: false,
      loop: false,
      crossOrigin: null,
      src: '',
      load: vi.fn(),
      onloadedmetadata: null,
      onloadeddata: null
    };

    const originalCreateElement = globalThis.document?.createElement;
    const originalCreateObjectURL = globalThis.URL?.createObjectURL;

    try {
      if (!globalThis.document) globalThis.document = {};
      globalThis.document.createElement = vi.fn(() => mockVideo);
      if (!globalThis.URL) globalThis.URL = {};
      globalThis.URL.createObjectURL = vi.fn((b) => 'blob:http://localhost/dummy');

      const blob = new Blob(['dummy'], { type: 'video/mp4' });
      const promise = loadVideoElement(blob);

      // Verify attributes
      expect(mockVideo.muted).toBe(true);
      expect(mockVideo.playsInline).toBe(true);
      expect(mockVideo.loop).toBe(true);
      expect(mockVideo.crossOrigin).toBeNull(); // Should NOT be set on blob URL
      expect(mockVideo.load).toHaveBeenCalled();

      // Trigger onloadeddata
      mockVideo.videoWidth = 640;
      mockVideo.onloadeddata();

      const result = await promise;
      expect(result).toBe(mockVideo);
    } finally {
      if (originalCreateElement) {
        globalThis.document.createElement = originalCreateElement;
      }
      if (originalCreateObjectURL) {
        globalThis.URL.createObjectURL = originalCreateObjectURL;
      }
    }
  });
});
