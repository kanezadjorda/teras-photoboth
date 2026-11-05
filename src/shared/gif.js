/**
 * GIF Animation Generator Module
 * Creates looping stop-motion GIF animations from single raw photo shots.
 * Uses lightweight pure JavaScript gifenc (zero native dependencies).
 */

import * as gifencPkg from 'gifenc';
import { calculateCoverFit } from './composite.js';

function resolveGifenc() {
  const candidates = [
    gifencPkg,
    gifencPkg?.default,
    gifencPkg?.default?.default,
    gifencPkg?.['module.exports']
  ];
  for (const c of candidates) {
    if (c && typeof c.GIFEncoder === 'function') {
      return c;
    }
  }
  throw new Error('GIFEncoder tidak ditemukan di paket gifenc');
}

const gifenc = resolveGifenc();
const { GIFEncoder, quantize, applyPalette } = gifenc;

/**
 * Converts a Uint8Array or ArrayBuffer into a base64 Data URL.
 * Supports both Node.js (via Buffer) and Browser (via btoa).
 * @param {Uint8Array} bytes
 * @param {string} [mimeType='image/gif']
 * @returns {string}
 */
export function bytesToDataUrl(bytes, mimeType = 'image/gif') {
  if (typeof Buffer !== 'undefined') {
    return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;
  }
  let binary = '';
  const len = bytes.length;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

/**
 * Encodes an array of raw RGBA frame buffers into an animated GIF.
 * Pure logic function, testable in Node.js without DOM.
 * @param {Array<Uint8ClampedArray|Uint8Array>} rgbaFrames
 * @param {object} options
 * @param {number} options.width
 * @param {number} options.height
 * @param {number} [options.delay=600] Delay per frame in ms
 * @param {number} [options.repeat=0] 0 for infinite loop
 * @returns {Uint8Array}
 */
export function createGifFromRgbaFrames(rgbaFrames = [], {
  width,
  height,
  delay = 600,
  repeat = 0
} = {}) {
  if (!Array.isArray(rgbaFrames) || rgbaFrames.length === 0) {
    throw new Error('Frame RGBA minimal 1 untuk membuat GIF');
  }
  if (!width || !height || width <= 0 || height <= 0) {
    throw new Error('Dimensi frame width & height tidak valid');
  }

  const gif = GIFEncoder();

  rgbaFrames.forEach((rgba) => {
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    gif.writeFrame(index, width, height, { palette, delay, repeat });
  });

  gif.finish();
  return gif.bytes();
}

/**
 * Creates an animated GIF from an array of HTMLImageElement or HTMLCanvasElement objects.
 * Designed for browser / Electron kiosk environment.
 * @param {object} options
 * @param {Array<HTMLImageElement|HTMLCanvasElement>} options.images
 * @param {number} [options.width=480] Target width (proportional, optimal for mobile)
 * @param {number} [options.height=640] Target height
 * @param {number} [options.delay=600] Frame delay in milliseconds
 * @param {string} [options.filter='none'] CSS filter string (e.g. from effects.js)
 * @returns {{ bytes: Uint8Array, dataUrl: string }}
 */
export function createGifFromImages({
  images = [],
  width = 480,
  height = 640,
  delay = 600,
  filter = 'none'
} = {}) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error('Daftar gambar tidak boleh kosong untuk membuat GIF');
  }

  if (typeof document === 'undefined') {
    throw new Error('createGifFromImages membutuhkan lingkungan DOM/Browser Canvas');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Gagal menginisialisasi 2D context canvas');
  }

  const rgbaFrames = [];

  for (const img of images) {
    if (!img) continue;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    if (filter && filter !== 'none') {
      ctx.filter = filter;
    }

    const sWidth = img.width || img.videoWidth || width;
    const sHeight = img.height || img.videoHeight || height;
    const { sx, sy, sw, sh } = calculateCoverFit(sWidth, sHeight, width, height);

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
    ctx.restore();

    const frameData = ctx.getImageData(0, 0, width, height);
    rgbaFrames.push(frameData.data);
  }

  const bytes = createGifFromRgbaFrames(rgbaFrames, { width, height, delay, repeat: 0 });
  const dataUrl = bytesToDataUrl(bytes, 'image/gif');

  return { bytes, dataUrl };
}
