/**
 * Capture Shot Sub-State Machine
 * PRD Reference: F-10, F-08, F-09
 *
 * Manages per-shot sub-states within the CAPTURING session state:
 *   live -> countdown -> reviewing_shot
 *
 * Retake: discards pending frame, returns to live for same index without persisting.
 * Continue / Selesai: persists via idempotent API per index, advances or completes.
 */

export const CAPTURE_SUB_STATES = Object.freeze({
  LIVE: 'live',
  COUNTDOWN: 'countdown',
  REVIEWING_SHOT: 'reviewing_shot'
});

/**
 * Creates a deterministic state machine instance for shot capture lifecycle.
 * @param {object} options
 * @param {number} [options.totalPhotos=3] - Total unique photos required
 * @param {Array<string>} [options.initialPhotos=[]] - Previously saved photos (resuming session)
 * @param {Function} [options.onComplete] - Callback when last photo is accepted
 */
export function createCaptureStateMachine({
  totalPhotos = 3,
  initialPhotos = [],
  onComplete
} = {}) {
  const safeTotal = Math.max(1, totalPhotos);
  const acceptedPhotos = Array.isArray(initialPhotos) ? [...initialPhotos] : [];

  // Resume from next unsaved shot index
  let currentShotIndex = 0;
  while (currentShotIndex < safeTotal && acceptedPhotos[currentShotIndex]) {
    currentShotIndex++;
  }

  let subState = CAPTURE_SUB_STATES.LIVE;
  let pendingShot = null;

  return {
    getCurrentShotIndex: () => currentShotIndex,
    getSubState: () => subState,
    getAcceptedPhotos: () => [...acceptedPhotos],
    getPendingShot: () => pendingShot,
    getTotalPhotos: () => safeTotal,
    isLastShot: () => currentShotIndex === safeTotal - 1,
    isAllCompleted: () => currentShotIndex >= safeTotal,

    startCountdown: () => {
      if (subState !== CAPTURE_SUB_STATES.LIVE) {
        throw new Error(`Cannot start countdown from sub-state: ${subState}`);
      }
      subState = CAPTURE_SUB_STATES.COUNTDOWN;
      return subState;
    },

    captureFrame: (frameData) => {
      if (!frameData) {
        throw new Error('Frame data is required to review shot');
      }
      pendingShot = frameData;
      subState = CAPTURE_SUB_STATES.REVIEWING_SHOT;
      return subState;
    },

    retake: () => {
      if (subState !== CAPTURE_SUB_STATES.REVIEWING_SHOT) {
        throw new Error(`Cannot retake from sub-state: ${subState}`);
      }
      pendingShot = null;
      subState = CAPTURE_SUB_STATES.LIVE;
      return { currentShotIndex, subState };
    },

    confirmShot: async (saveFn) => {
      if (subState !== CAPTURE_SUB_STATES.REVIEWING_SHOT) {
        throw new Error(`Cannot confirm shot from sub-state: ${subState}`);
      }
      if (!pendingShot) {
        throw new Error('No pending shot to confirm');
      }

      const savedData = pendingShot;
      const indexToSave = currentShotIndex;

      // Idempotent save execution
      if (typeof saveFn === 'function') {
        await saveFn({ index: indexToSave, photo: savedData });
      }

      acceptedPhotos[indexToSave] = savedData;
      pendingShot = null;

      const wasLast = indexToSave >= safeTotal - 1;
      if (wasLast) {
        currentShotIndex = safeTotal;
        if (typeof onComplete === 'function') {
          onComplete([...acceptedPhotos]);
        }
        return { isComplete: true, acceptedPhotos: [...acceptedPhotos] };
      }

      currentShotIndex = indexToSave + 1;
      subState = CAPTURE_SUB_STATES.LIVE;
      return {
        isComplete: false,
        currentShotIndex,
        subState,
        acceptedPhotos: [...acceptedPhotos]
      };
    }
  };
}
