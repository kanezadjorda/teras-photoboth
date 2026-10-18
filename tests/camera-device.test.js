import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCameraDevices, getOptimalCameraDeviceId } from '../src/shared/camera.js';

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
