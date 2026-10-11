/**
 * Camera Service
 * Handles camera detection, live stream acquisition, and frame capturing.
 * PRD Reference: F-08, F-09
 */

/**
 * Detects available video input devices and returns the optimal device ID.
 * Prefers external webcam / HDMI capture card over built-in laptop cameras.
 * @returns {Promise<string|null>}
 */
export async function getOptimalCameraDeviceId() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    throw new Error('Web MediaDevices API tidak didukung pada browser ini.');
  }

  // Initial dummy stream request if permissions haven't been granted (to populate labels)
  let initialStream = null;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasLabels = devices.some((d) => d.kind === 'videoinput' && d.label);
    if (!hasLabels) {
      initialStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
  } catch (err) {
    console.warn('[Camera] Izin kamera belum diberikan atau gagal:', err);
  } finally {
    if (initialStream) {
      initialStream.getTracks().forEach((track) => track.stop());
    }
  }

  const allDevices = await navigator.mediaDevices.enumerateDevices();
  const videoDevices = allDevices.filter((d) => d.kind === 'videoinput');

  if (videoDevices.length === 0) {
    return null;
  }

  // If only one camera exists, return it
  if (videoDevices.length === 1) {
    return videoDevices[0].deviceId;
  }

  // Keywords that typically denote built-in/internal laptop webcams
  const internalKeywords = ['integrated', 'built-in', 'internal', 'facetime', 'bawaan'];

  // Look for external camera (does NOT match internal keywords)
  const externalDevice = videoDevices.find((device) => {
    const label = (device.label || '').toLowerCase();
    return !internalKeywords.some((keyword) => label.includes(keyword));
  });

  if (externalDevice) {
    return externalDevice.deviceId;
  }

  // Fallback to the second video device if no label matched internal keywords
  return videoDevices[1].deviceId;
}

/**
 * Starts and returns a video stream from the optimal camera.
 * @param {object} [options]
 * @param {string} [options.deviceId] - Optional explicit device ID
 * @returns {Promise<MediaStream>}
 */
export async function startCameraStream(options = {}) {
  const deviceId = options.deviceId || (await getOptimalCameraDeviceId());

  const constraints = {
    audio: false,
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      width: { ideal: 1920, min: 1280 },
      height: { ideal: 1080, min: 720 },
      frameRate: { ideal: 30 }
    }
  };

  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    console.warn('[Camera] Gagal mendapatkan resolusi tinggi, mencoba fallback:', err);
    // Fallback constraints without strict resolution
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: deviceId ? { deviceId: { exact: deviceId } } : true
    });
  }
}

/**
 * Stops all media tracks on a stream cleanly.
 * @param {MediaStream|null} stream
 */
export function stopCameraStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    track.stop();
  });
}

/**
 * Captures a single frame from an active <video> element.
 * @param {HTMLVideoElement} videoElement
 * @param {object} [options]
 * @param {boolean} [options.mirror=true] - Whether to flip horizontally matching mirror preview
 * @param {number} [options.quality=0.95] - JPEG compression quality
 * @returns {string} - Data URL in image/jpeg format
 */
export function captureFrame(videoElement, options = {}) {
  const { mirror = true, quality = 0.95 } = options;

  if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
    throw new Error('Video element belum siap atau resolusi 0');
  }

  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext('2d');

  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

