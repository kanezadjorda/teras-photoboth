/**
 * Composite Engine (Canvas 300 DPI 4R)
 * Composites user photos into template cutouts and overlays template PNG.
 * PRD Reference: F-06, F-11
 */

import { CANVAS_SPECS } from './constants.js';
import { getEffect } from './effects.js';

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
 * Gets the 1-based photo index assigned to a slot, falling back to its array position (1-based).
 * @param {object} slot
 * @param {number} fallbackIndex - 0-based array index of the slot
 * @returns {number} 1-based photo index
 */
export function getSlotPhotoIndex(slot, fallbackIndex = 0) {
  const idx = slot?.photo_index ?? slot?.photoIndex;
  const num = parseInt(idx, 10);
  return Number.isFinite(num) && num > 0 ? num : fallbackIndex + 1;
}

/**
 * Calculates the total number of unique photo takes required by template slots.
 * @param {Array<object>} slots
 * @returns {number}
 */
export function getUniquePhotoCount(slots = []) {
  if (!Array.isArray(slots) || slots.length === 0) return 3;
  const uniqueIndices = new Set();
  slots.forEach((s, idx) => {
    uniqueIndices.add(getSlotPhotoIndex(s, idx));
  });
  return uniqueIndices.size;
}

/**
 * Composites photos into template slots and overlays the transparent template PNG.
 * @param {object} options
 * @param {number} [options.canvasWidth=1200]
 * @param {number} [options.canvasHeight=1800]
 * @param {HTMLImageElement|ImageBitmap|HTMLCanvasElement} [options.templateImage]
 * @param {Array<{ x: number, y: number, w: number, h: number, photo_index?: number }>} [options.slots=[]]
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
    filter = 'none',
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
    if (!slot) continue;

    const photoIdx = getSlotPhotoIndex(slot, i) - 1;
    const photo = photos[photoIdx];

    if (photo) {
      const pWidth = photo.width || photo.videoWidth || canvasWidth;
      const pHeight = photo.height || photo.videoHeight || canvasHeight;

      const { sx, sy, sw, sh } = calculateCoverFit(pWidth, pHeight, slot.w, slot.h);

      ctx.save();
      // Apply effect filter strictly to photos, NOT overlay (PRD F-28)
      if (filter && filter !== 'none') {
        ctx.filter = filter;
      }
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

  // 3. Draw template overlay PNG on top of all photos (unfiltered)
  if (templateImage) {
    ctx.drawImage(templateImage, 0, 0, canvasWidth, canvasHeight);
  }

  return canvas;
}

/**
 * High-level session composite generator applying chosen photo effect.
 * PRD Reference: F-27, F-28
 * @param {object} options
 * @param {object} options.template - Template object with slots
 * @param {Array<HTMLImageElement|ImageBitmap|HTMLCanvasElement>} options.photos - Array of captured photo images
 * @param {string} [options.effectId='normal'] - ID of the effect preset
 * @param {HTMLImageElement|ImageBitmap|HTMLCanvasElement} [options.templateImage] - Preloaded template overlay image
 * @param {HTMLCanvasElement} [options.targetCanvas] - Optional existing canvas to draw onto
 * @returns {HTMLCanvasElement}
 */
export function composeSession({
  template,
  photos = [],
  effectId = 'normal',
  templateImage = null,
  canvasWidth = CANVAS_SPECS.WIDTH,
  canvasHeight = CANVAS_SPECS.HEIGHT,
  targetCanvas = null
} = {}) {
  const effect = getEffect(effectId);
  const slots = template?.slots || [];

  return renderComposite({
    canvasWidth,
    canvasHeight,
    templateImage,
    slots,
    photos,
    filter: effect.filter,
    targetCanvas
  });
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

