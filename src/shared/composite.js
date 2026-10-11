/**
 * Composite Engine (Canvas 300 DPI 4R)
 * Composites user photos into template cutouts and overlays template PNG.
 * PRD Reference: F-06, F-11
 */

import { CANVAS_SPECS } from './constants.js';

/**
 * Calculates cover-fit source crop coordinates to prevent photo distortion.
 * @param {number} sourceWidth
 * @param {number} sourceHeight
 * @param {number} targetWidth
 * @param {number} targetHeight
 * @returns {{ sx: number, sy: number, sw: number, sh: number }}
 */
export function calculateCoverFit(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    throw new Error('Invalid dimensions provided for cover-fit calculation');
  }

  const sourceAspect = sourceWidth / sourceHeight;
  const targetAspect = targetWidth / targetHeight;

  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (sourceAspect > targetAspect) {
    // Source is wider than target: crop left and right
    sw = Math.round(sourceHeight * targetAspect);
    sx = Math.round((sourceWidth - sw) / 2);
  } else {
    // Source is taller than target: crop top and bottom
    sh = Math.round(sourceWidth / targetAspect);
    sy = Math.round((sourceHeight - sh) / 2);
  }

  return { sx, sy, sw, sh };
}

/**
 * Composites photos into template slots and overlays the transparent template PNG.
 * @param {object} options
 * @param {number} [options.canvasWidth=1200]
 * @param {number} [options.canvasHeight=1800]
 * @param {HTMLImageElement|ImageBitmap|HTMLCanvasElement} [options.templateImage]
 * @param {Array<{ x: number, y: number, w: number, h: number }>} [options.slots=[]]
 * @param {Array<HTMLImageElement|ImageBitmap|HTMLCanvasElement>} [options.photos=[]]
 * @param {HTMLCanvasElement} [options.targetCanvas] - Optional existing canvas to draw onto
 * @returns {HTMLCanvasElement}
 */
export function renderComposite(options = {}) {
  const {
    canvasWidth = CANVAS_SPECS.WIDTH,
    canvasHeight = CANVAS_SPECS.HEIGHT,
    templateImage = null,
    slots = [],
    photos = [],
    targetCanvas = null
  } = options;

  const canvas = targetCanvas || document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Gagal mendapatkan 2D context canvas');
  }

  // 1. Draw solid white background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 2. Draw each photo into its designated slot with cover-fit
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const photo = photos[i];

    if (!slot) continue;

    if (photo) {
      const pWidth = photo.width || photo.videoWidth || canvasWidth;
      const pHeight = photo.height || photo.videoHeight || canvasHeight;

      const { sx, sy, sw, sh } = calculateCoverFit(pWidth, pHeight, slot.w, slot.h);

      ctx.save();
      // Clip to slot boundary
      ctx.beginPath();
      ctx.rect(slot.x, slot.y, slot.w, slot.h);
      ctx.clip();

      ctx.drawImage(photo, sx, sy, sw, sh, slot.x, slot.y, slot.w, slot.h);
      ctx.restore();
    } else {
      // Empty slot placeholder
      ctx.fillStyle = '#F0F0F0';
      ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
    }
  }

  // 3. Draw template overlay PNG on top of all photos
  if (templateImage) {
    ctx.drawImage(templateImage, 0, 0, canvasWidth, canvasHeight);
  }

  return canvas;
}

/**
 * Loads an image from a URL or base64 dataURL as HTMLImageElement.
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error(`Gagal memuat gambar: ${src} (${err})`));
    img.src = src;
  });
}
