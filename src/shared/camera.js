/**
 * Camera Service
 * Handles camera detection, live stream acquisition, and frame capturing.
 * PRD Reference: F-08, F-09
 */

// Keywords that typically denote built-in/internal laptop webcams
const INTERNAL_KEYWORDS = ['integrated', 'built-in', 'internal', 'facetime', 'bawaan'];

/**
 * Lists all available video input devices with external/internal classification.
 * PRD Reference: F-08, F-14
 * @returns {Promise<Array<{deviceId: string, label: string, isExternal: boolean, isInternal: boolean}>>}
 */
export async function getCameraDevices() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    return [];
  }

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

  return videoDevices.map((device, index) => {
    const label = device.label || `Kamera ${index + 1}`;
    const isInternal = INTERNAL_KEYWORDS.some((keyword) => label.toLowerCase().includes(keyword));
    return {
      deviceId: device.deviceId,
      label,
      isExternal: !isInternal,
      isInternal
    };
  });
}

/**
 * Detects available video input devices and returns the optimal device ID.
 * Priority: Manual selection from localStorage > External camera (DSLR/UVC) > Laptop internal camera.
 * PRD Reference: F-08, F-14
 * @returns {Promise<string|null>}
 */
export async function getOptimalCameraDeviceId() {
  const devices = await getCameraDevices();
  if (!devices || devices.length === 0) {
    return null;
  }

  // 1. Check if user explicitly selected a camera in Admin Panel
  const savedId = typeof localStorage !== 'undefined' ? localStorage.getItem('selected_camera_id') : null;
  if (savedId) {
    const matched = devices.find((d) => d.deviceId === savedId);
    if (matched) {
      return matched.deviceId;
    }
  }

  // 2. Prefer external camera (e.g. DSLR via capture card / UVC webcam)
  const externalDevice = devices.find((d) => d.isExternal);
  if (externalDevice) {
    return externalDevice.deviceId;
  }

  // 3. Fallback to default / laptop internal camera
  return devices[0].deviceId;
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
  try {
    const tracks = typeof stream.getTracks === 'function' ? stream.getTracks() : [];
    tracks.forEach((track) => {
      if (typeof track.stop === 'function') {
        track.stop();
      }
    });
  } catch (err) {
    console.warn('[Camera] Error saat menghentikan track kamera:', err);
  }
}

/**
 * Camera Service (Singleton)
 * PRD Reference: F-24, F-25
 * Holds a single active MediaStream reused across Welcome and Capture screens.
 * Auto-selects external camera, listens for devicechange, and provides start/getStream/stop.
 */
class CameraService {
  constructor() {
    this.stream = null;
    this.currentDeviceId = null;
    this.listeners = new Set();
    this.deviceChangeListener = null;
    this.isStarting = false;
  }

  /**
   * Checks whether the current stream is active with live video tracks.
   * @returns {boolean}
   */
  isActive() {
    if (!this.stream) return false;
    try {
      const tracks = typeof this.stream.getVideoTracks === 'function' ? this.stream.getVideoTracks() : [];
      return tracks.length > 0 && tracks.some((t) => t.readyState === 'live');
    } catch {
      return false;
    }
  }

  /**
   * Returns the currently active MediaStream or null.
   * @returns {MediaStream|null}
   */
  getStream() {
    return this.isActive() ? this.stream : null;
  }

  /**
   * Starts or reuses the camera stream from the optimal camera.
   * If already active and not forced, reuses the existing stream (PRD F-25).
   * @param {object} [options]
   * @param {string} [options.deviceId] - Specific device ID override
   * @param {boolean} [options.forceRestart=false] - Force re-acquire new stream
   * @returns {Promise<MediaStream>}
   */
  async start(options = {}) {
    // If stream is already healthy and active, reuse it (F-25)
    if (this.isActive() && !options.forceRestart) {
      this._setupDeviceChangeListener();
      return this.stream;
    }

    if (this.isStarting) {
      while (this.isStarting) {
        await new Promise((r) => setTimeout(r, 50));
      }
      if (this.isActive() && !options.forceRestart) {
        return this.stream;
      }
    }

    this.isStarting = true;
    try {
      const optimalDeviceId = options.deviceId || (await getOptimalCameraDeviceId());

      // Stop old tracks if any
      if (this.stream) {
        stopCameraStream(this.stream);
        this.stream = null;
      }

      this.stream = await startCameraStream({ deviceId: optimalDeviceId });
      this.currentDeviceId = optimalDeviceId;
      this._setupDeviceChangeListener();
      this._notifyListeners(this.stream);
      return this.stream;
    } catch (err) {
      this.stream = null;
      this.currentDeviceId = null;
      this._notifyListeners(null);
      throw err;
    } finally {
      this.isStarting = false;
    }
  }

  /**
   * Stops all active tracks and cleans up listeners.
   */
  stop() {
    if (this.stream) {
      stopCameraStream(this.stream);
      this.stream = null;
    }
    this.currentDeviceId = null;
    this._removeDeviceChangeListener();
    this._notifyListeners(null);
  }

  /**
   * Subscribes to stream change events.
   * @param {(stream: MediaStream|null) => void} callback
   * @returns {() => void} Unsubscribe function
   */
  onStreamChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _notifyListeners(stream) {
    for (const listener of this.listeners) {
      try {
        listener(stream);
      } catch (err) {
        console.error('[CameraService] Kesalahan pada callback listener:', err);
      }
    }
  }

  _setupDeviceChangeListener() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || this.deviceChangeListener) {
      return;
    }

    this.deviceChangeListener = async () => {
      console.log('[CameraService] Perubahan perangkat kamera terdeteksi (devicechange)');
      try {
        const newOptimalId = await getOptimalCameraDeviceId();
        // If optimal device changed or current stream is lost, switch to new optimal camera
        if (newOptimalId !== this.currentDeviceId || !this.isActive()) {
          console.log(`[CameraService] Berganti kamera ke perangkat optimal: ${newOptimalId}`);
          await this.start({ deviceId: newOptimalId, forceRestart: true });
        }
      } catch (err) {
        console.warn('[CameraService] Gagal memperbarui stream saat devicechange:', err.message);
      }
    };

    if (typeof navigator.mediaDevices.addEventListener === 'function') {
      navigator.mediaDevices.addEventListener('devicechange', this.deviceChangeListener);
    } else {
      navigator.mediaDevices.ondevicechange = this.deviceChangeListener;
    }
  }

  _removeDeviceChangeListener() {
    if (!this.deviceChangeListener) return;
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      if (typeof navigator.mediaDevices.removeEventListener === 'function') {
        navigator.mediaDevices.removeEventListener('devicechange', this.deviceChangeListener);
      } else if (navigator.mediaDevices.ondevicechange === this.deviceChangeListener) {
        navigator.mediaDevices.ondevicechange = null;
      }
    }
    this.deviceChangeListener = null;
  }
}

export const cameraService = new CameraService();

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

