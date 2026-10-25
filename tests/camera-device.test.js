import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCameraDevices, getOptimalCameraDeviceId, cameraService } from '../src/shared/camera.js';

describe('Camera Device Detection & Selection Logic (PRD F-08, F-14)', () => {
  let mockDevices = [];
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
    const mockLocalStorage = {
      getItem: vi.fn((key) => mockStorage[key] || null),
      setItem: vi.fn((key, val) => {
        mockStorage[key] = String(val);
      }),
      removeItem: vi.fn((key) => {
        delete mockStorage[key];
      })
    };

    mockDevices = [];
    const mockNavigator = {
      mediaDevices: {
        enumerateDevices: vi.fn(async () => mockDevices),
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }]
        }))
      }
    };

    vi.stubGlobal('localStorage', mockLocalStorage);
    vi.stubGlobal('navigator', mockNavigator);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns empty array when no media devices are connected', async () => {
    mockDevices = [];
    const result = await getCameraDevices();
    expect(result).toEqual([]);

    const optimal = await getOptimalCameraDeviceId();
    expect(optimal).toBeNull();
  });

  it('classifies internal laptop camera and external camera correctly', async () => {
    mockDevices = [
      { kind: 'videoinput', deviceId: 'cam-laptop', label: 'Integrated Webcam (Built-in)' },
      { kind: 'videoinput', deviceId: 'cam-dslr', label: 'Canon EOS Webcam Utility' },
      { kind: 'audioinput', deviceId: 'mic-1', label: 'Microphone' }
    ];

    const devices = await getCameraDevices();
    expect(devices).toHaveLength(2);

    expect(devices[0].deviceId).toBe('cam-laptop');
    expect(devices[0].isInternal).toBe(true);
    expect(devices[0].isExternal).toBe(false);

    expect(devices[1].deviceId).toBe('cam-dslr');
    expect(devices[1].isInternal).toBe(false);
    expect(devices[1].isExternal).toBe(true);
  });

  it('prioritizes external camera over laptop camera by default', async () => {
    mockDevices = [
      { kind: 'videoinput', deviceId: 'cam-laptop', label: 'Integrated Webcam (Built-in)' },
      { kind: 'videoinput', deviceId: 'cam-dslr', label: 'Canon EOS Webcam Utility' }
    ];

    const optimalId = await getOptimalCameraDeviceId();
    expect(optimalId).toBe('cam-dslr');
  });

  it('falls back to laptop camera when no external camera is connected', async () => {
    mockDevices = [
      { kind: 'videoinput', deviceId: 'cam-laptop', label: 'Integrated Webcam (Built-in)' }
    ];

    const optimalId = await getOptimalCameraDeviceId();
    expect(optimalId).toBe('cam-laptop');
  });

  it('honors manual user selection from localStorage if device is connected', async () => {
    mockDevices = [
      { kind: 'videoinput', deviceId: 'cam-laptop', label: 'Integrated Webcam (Built-in)' },
      { kind: 'videoinput', deviceId: 'cam-dslr', label: 'Canon EOS Webcam Utility' }
    ];

    mockStorage['selected_camera_id'] = 'cam-laptop';

    const optimalId = await getOptimalCameraDeviceId();
    expect(optimalId).toBe('cam-laptop');
  });

  it('falls back to external camera if saved camera is disconnected', async () => {
    mockDevices = [
      { kind: 'videoinput', deviceId: 'cam-dslr', label: 'Canon EOS Webcam Utility' }
    ];

    mockStorage['selected_camera_id'] = 'cam-unplugged';

    const optimalId = await getOptimalCameraDeviceId();
    expect(optimalId).toBe('cam-dslr');
  });
});

describe('cameraService Singleton & Stream Reuse (PRD F-24, F-25)', () => {
  let mockDevices = [];
  let getUserMediaSpy;
  let deviceChangeCallback = null;
  let mockTrack;

  beforeEach(() => {
    mockTrack = {
      stop: vi.fn(),
      readyState: 'live'
    };

    const createMockStream = () => ({
      getTracks: () => [mockTrack],
      getVideoTracks: () => [mockTrack]
    });

    getUserMediaSpy = vi.fn(async () => createMockStream());

    mockDevices = [
      { kind: 'videoinput', deviceId: 'cam-laptop', label: 'Integrated Webcam (Built-in)' },
      { kind: 'videoinput', deviceId: 'cam-dslr', label: 'Canon EOS Webcam Utility' }
    ];

    deviceChangeCallback = null;
    const mockNavigator = {
      mediaDevices: {
        enumerateDevices: vi.fn(async () => mockDevices),
        getUserMedia: getUserMediaSpy,
        addEventListener: vi.fn((event, cb) => {
          if (event === 'devicechange') deviceChangeCallback = cb;
        }),
        removeEventListener: vi.fn((event, cb) => {
          if (event === 'devicechange' && deviceChangeCallback === cb) {
            deviceChangeCallback = null;
          }
        })
      }
    };

    vi.stubGlobal('navigator', mockNavigator);
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn()
    });

    cameraService.stop();
  });

  afterEach(() => {
    cameraService.stop();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('starts and selects external camera automatically', async () => {
    const stream = await cameraService.start();
    expect(stream).toBeDefined();
    expect(cameraService.isActive()).toBe(true);
    expect(cameraService.getStream()).toBe(stream);
    expect(getUserMediaSpy).toHaveBeenCalledTimes(1);

    // Verify constraints used optimal external camera
    const callArgs = getUserMediaSpy.mock.calls[0][0];
    expect(callArgs.video.deviceId.exact).toBe('cam-dslr');
  });

  it('reuses active stream without requesting getUserMedia again (F-25)', async () => {
    const stream1 = await cameraService.start();
    expect(getUserMediaSpy).toHaveBeenCalledTimes(1);

    // Second call (e.g. Capture screen after Welcome screen)
    const stream2 = await cameraService.start();
    expect(getUserMediaSpy).toHaveBeenCalledTimes(1); // Not called again!
    expect(stream2).toBe(stream1);
  });

  it('stops stream cleanly and resets state', async () => {
    await cameraService.start();
    expect(cameraService.isActive()).toBe(true);

    cameraService.stop();
    expect(mockTrack.stop).toHaveBeenCalled();
    expect(cameraService.isActive()).toBe(false);
    expect(cameraService.getStream()).toBeNull();
  });

  it('handles devicechange event and updates stream when camera changes (F-25)', async () => {
    await cameraService.start();
    expect(cameraService.currentDeviceId).toBe('cam-dslr');

    // Simulate external camera unplugged -> now only laptop webcam remains
    mockDevices = [
      { kind: 'videoinput', deviceId: 'cam-laptop', label: 'Integrated Webcam (Built-in)' }
    ];

    expect(deviceChangeCallback).toBeTypeOf('function');
    await deviceChangeCallback();

    // Switched to cam-laptop
    expect(cameraService.currentDeviceId).toBe('cam-laptop');
  });

  it('notifies subscribers on stream change', async () => {
    const listener = vi.fn();
    const unsubscribe = cameraService.onStreamChange(listener);

    await cameraService.start();
    expect(listener).toHaveBeenCalledWith(expect.anything());

    cameraService.stop();
    expect(listener).toHaveBeenCalledWith(null);

    unsubscribe();
    cameraService.start();
    // After unsubscribe, listener is not called again for the new start
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

