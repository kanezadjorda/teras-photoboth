/**
 * Automatic Transparent Slot Detector
 * Analyzes the alpha channel of a template PNG to detect photo cutout slots.
 * PRD Reference: F-07
 */

/**
 * Detects transparent photo slots from image pixel data.
 * @param {{ width: number, height: number, data: Uint8ClampedArray|Uint8Array|Array<number> }} imageData
 * @param {object} [options]
 * @param {number} [options.scale=4] - Downsample factor for fast connected component analysis
 * @param {number} [options.alphaThreshold=128] - Alpha value below which a pixel is considered transparent
 * @param {number} [options.minAreaFraction=0.02] - Minimum area fraction relative to total canvas (default 2%)
 * @param {number} [options.verticalRowTolerance=40] - Tolerance in px to cluster slots into rows (top-to-bottom, left-to-right)
 * @returns {Array<{ x: number, y: number, w: number, h: number }>}
 */
export function detectTransparentSlots(imageData, options = {}) {
  const {
    scale = 4,
    alphaThreshold = 128,
    minAreaFraction = 0.02,
    verticalRowTolerance = 40
  } = options;

  const { width, height, data } = imageData;
  if (!width || !height || !data) {
    throw new Error('Invalid image data provided for slot detection');
  }

  const gridW = Math.floor(width / scale);
  const gridH = Math.floor(height / scale);
  const totalGridPixels = gridW * gridH;

  // 1. Build downsampled binary mask: 1 = transparent, 0 = opaque
  const mask = new Uint8Array(totalGridPixels);

  for (let gy = 0; gy < gridH; gy++) {
    const origY = gy * scale;
    for (let gx = 0; gx < gridW; gx++) {
      const origX = gx * scale;
      const alphaIndex = (origY * width + origX) * 4 + 3;
      const alpha = data[alphaIndex];

      if (alpha < alphaThreshold) {
        mask[gy * gridW + gx] = 1;
      }
    }
  }

  // 2. Connected Component Labeling using BFS
  const visited = new Uint8Array(totalGridPixels);
  const rawComponents = [];
  const minPixels = Math.floor((width * height * minAreaFraction) / (scale * scale));

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const index = y * gridW + x;
      if (mask[index] === 0 || visited[index] === 1) {
        continue;
      }

      // Start new component flood fill
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let pixelCount = 0;

      const queue = [x, y];
      visited[index] = 1;

      let head = 0;
      while (head < queue.length) {
        const curX = queue[head++];
        const curY = queue[head++];
        pixelCount++;

        if (curX < minX) minX = curX;
        if (curX > maxX) maxX = curX;
        if (curY < minY) minY = curY;
        if (curY > maxY) maxY = curY;

        // 4-neighborhood
        const neighbors = [
          [curX + 1, curY],
          [curX - 1, curY],
          [curX, curY + 1],
          [curX, curY - 1]
        ];

        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH) {
            const nIndex = ny * gridW + nx;
            if (mask[nIndex] === 1 && visited[nIndex] === 0) {
              visited[nIndex] = 1;
              queue.push(nx, ny);
            }
          }
        }
      }

      // Discard small noise areas (< minAreaFraction)
      if (pixelCount >= minPixels) {
        const origX = Math.round(minX * scale);
        const origY = Math.round(minY * scale);
        const origW = Math.round((maxX - minX + 1) * scale);
        const origH = Math.round((maxY - minY + 1) * scale);

        rawComponents.push({
          x: Math.max(0, origX),
          y: Math.max(0, origY),
          w: Math.min(width - origX, origW),
          h: Math.min(height - origY, origH)
        });
      }
    }
  }

  // 3. Sort slots: Top -> Bottom, Left -> Right
  rawComponents.sort((a, b) => {
    // If on roughly the same horizontal row within tolerance
    if (Math.abs(a.y - b.y) <= verticalRowTolerance) {
      return a.x - b.x;
    }
    return a.y - b.y;
  });

  return rawComponents;
}

