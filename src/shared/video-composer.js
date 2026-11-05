/**
 * Live Video Template Composer Module
 * Composites individual slot video clips into the full template with template PNG overlay.
 * Produces a 2-3s looping MP4/WebM video where all photo slots animate simultaneously.
 */

import { calculateCoverFit, getSlotPhotoIndex } from './composite.js';
import { CANVAS_SPECS } from './constants.js';

/**
 * Detects the best supported video MIME type for MediaRecorder.
 * Prefers MP4 for maximum mobile compatibility, with WebM as fallback.
 * @returns {string} e.g. 'video/mp4;codecs=avc1', 'video/mp4', or 'video/webm'
 */
export function getOptimalVideoMimeType() {
  if (typeof MediaRecorder === 'undefined') {
    return 'video/webm';
  }

  const preferredTypes = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm'
  ];

  for (const type of preferredTypes) {
    if (typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return 'video/webm';
}

/**
 * Creates and loads an HTMLVideoElement from a Blob or URL.
 * @param {Blob|string} source
 * @returns {Promise<HTMLVideoElement>}
 */
export function loadVideoElement(source) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    video.crossOrigin = 'anonymous';

    const objectUrl = source instanceof Blob ? URL.createObjectURL(source) : source;

    video.onloadedmetadata = () => {
      video.currentTime = 0;
      resolve(video);
    };

    video.onerror = (err) => {
      reject(new Error(`Gagal memuat video slot: ${err?.message || 'Unknown error'}`));
    };

    video.src = objectUrl;
    video.load();
  });
}

/**
 * Converts a Blob to a base64 Data URL.
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Composites multiple slot video clips into an animated template video.
 * @param {object} options
 * @param {object} options.template - Template configuration containing slots
 * @param {HTMLImageElement|ImageBitmap|HTMLCanvasElement} [options.templateImage] - Preloaded template PNG overlay
 * @param {Array<Blob|string>} options.slotVideos - Array of video clips per slot index
 * @param {string} [options.filter='none'] - CSS filter string (e.g. from effects.js)
 * @param {number} [options.durationMs=3000] - Duration of output video in milliseconds
 * @param {number} [options.fps=30] - Recording frame rate
 * @param {number} [options.width=800] - Render width (scaled for smooth mobile streaming & fast encoding)
 * @param {number} [options.height=1200] - Render height
 * @returns {Promise<{ blob: Blob, dataUrl: string, mimeType: string, extension: string }>}
 */
export async function composeTemplateLiveVideo({
  template,
  templateImage = null,
  slotVideos = [],
  filter = 'none',
  durationMs = 3000,
  fps = 30,
  width = 800,
  height = 1200
} = {}) {
  if (typeof document === 'undefined' || typeof MediaRecorder === 'undefined') {
    throw new Error('composeTemplateLiveVideo membutuhkan lingkungan browser/Electron');
  }

  if (!Array.isArray(slotVideos) || slotVideos.length === 0) {
    throw new Error('Klip video slot minimal 1 untuk membuat live video template');
  }

  const slots = template?.slots || [];
  const baseWidth = template?.canvas?.width || CANVAS_SPECS.WIDTH;
  const baseHeight = template?.canvas?.height || CANVAS_SPECS.HEIGHT;
  const scaleX = width / baseWidth;
  const scaleY = height / baseHeight;

  // 1. Siapkan elemen video untuk setiap video slot yang ada
  const videoElements = await Promise.all(
    slotVideos.map(async (v) => (v ? loadVideoElement(v) : null))
  );

  // 2. Siapkan canvas offscreen untuk render komposit video
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Gagal mendapatkan 2D context canvas untuk live video');
  }

  // 3. Putar semua video secara serentak
  await Promise.all(
    videoElements.map((v) => {
      if (v) {
        v.currentTime = 0;
        return v.play().catch(() => {});
      }
      return Promise.resolve();
    })
  );

  // 4. Siapkan MediaRecorder dari Canvas stream
  const stream = canvas.captureStream(fps);
  const mimeType = getOptimalVideoMimeType();
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 2500000 // 2.5 Mbps crisp quality
  });

  const recordedChunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  let animationFrameId = null;
  let isRecording = true;

  // 5. Render loop: gambar setiap frame video slot ke dalam koordinat template
  function renderFrame() {
    if (!isRecording) return;

    // Bersihkan canvas dengan latar putih
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Render setiap slot
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      if (!slot) continue;

      const photoIdx = getSlotPhotoIndex(slot, i) - 1;
      const video = videoElements[photoIdx] || videoElements[0];

      const sxPos = slot.x * scaleX;
      const syPos = slot.y * scaleY;
      const sWidth = slot.w * scaleX;
      const sHeight = slot.h * scaleY;

      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        const { sx, sy, sw, sh } = calculateCoverFit(
          video.videoWidth,
          video.videoHeight,
          sWidth,
          sHeight
        );

        ctx.save();
        if (filter && filter !== 'none') {
          ctx.filter = filter;
        }

        ctx.beginPath();
        ctx.rect(sxPos, syPos, sWidth, sHeight);
        ctx.clip();

        ctx.drawImage(video, sx, sy, sw, sh, sxPos, syPos, sWidth, sHeight);
        ctx.restore();
      } else {
        ctx.fillStyle = '#E5E5E5';
        ctx.fillRect(sxPos, syPos, sWidth, sHeight);
      }
    }

    // Gambar overlay template PNG transparan di atas semua slot video
    if (templateImage) {
      ctx.drawImage(templateImage, 0, 0, width, height);
    }

    animationFrameId = requestAnimationFrame(renderFrame);
  }

  return new Promise((resolve, reject) => {
    recorder.onstop = async () => {
      isRecording = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      // Hentikan video playback dan lepaskan resource
      videoElements.forEach((v) => {
        if (v) {
          v.pause();
          if (v.src && v.src.startsWith('blob:')) {
            URL.revokeObjectURL(v.src);
          }
          v.src = '';
        }
      });

      try {
        const finalBlob = new Blob(recordedChunks, { type: mimeType });
        const dataUrl = await blobToDataUrl(finalBlob);
        const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
        resolve({ blob: finalBlob, dataUrl, mimeType, extension });
      } catch (err) {
        reject(err);
      }
    };

    recorder.onerror = (err) => {
      isRecording = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      reject(err);
    };

    recorder.start(100);
    renderFrame();

    // Berhenti setelah durasi tercapai
    setTimeout(() => {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    }, durationMs);
  });
}
