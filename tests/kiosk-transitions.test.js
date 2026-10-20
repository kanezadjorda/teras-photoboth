import { describe, it, expect, vi } from 'vitest';
import { createChooseTemplateScreen } from '../src/kiosk/screens/choose-template.js';
import { createCaptureScreen } from '../src/kiosk/screens/capture.js';
import { isValidTransition, transitionSessionState } from '../src/shared/session-state.js';
import { SESSION_STATES } from '../src/shared/constants.js';

describe('Kiosk Choose Template -> Capture Transitions (PRD F-06, F-08)', () => {
  it('allows idempotent self-transitions without throwing error', () => {
    expect(isValidTransition(SESSION_STATES.CAPTURING, SESSION_STATES.CAPTURING)).toBe(true);
    expect(isValidTransition(SESSION_STATES.CHOOSING_TEMPLATE, SESSION_STATES.CHOOSING_TEMPLATE)).toBe(true);
    expect(transitionSessionState(SESSION_STATES.CAPTURING, SESSION_STATES.CAPTURING)).toBe(SESSION_STATES.CAPTURING);
  });

  it('mounts capture screen and cleanly unmounts without ReferenceError', () => {
    const children = [];
    const listeners = {};
    const mockElement = (tag, id = '') => ({
      tagName: tag.toUpperCase(),
      id,
      className: '',
      innerHTML: '',
      style: {},
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(() => false)
      },
      appendChild: vi.fn((child) => {
        children.push(child);
        return child;
      }),
      removeChild: vi.fn((child) => {
        const idx = children.indexOf(child);
        if (idx >= 0) children.splice(idx, 1);
      }),
      parentNode: {
        removeChild: vi.fn()
      },
      querySelector: vi.fn((sel) => {
        if (sel === '#templates-grid') return mockElement('div', 'templates-grid');
        if (sel === '#camera-video') return mockElement('video', 'camera-video');
        if (sel === '#countdown-overlay') return mockElement('div', 'countdown-overlay');
        if (sel === '#countdown-number') return mockElement('span', 'countdown-number');
        if (sel === '#flash-overlay') return mockElement('div', 'flash-overlay');
        if (sel === '#preview-overlay') return mockElement('div', 'preview-overlay');
        if (sel === '#preview-image') return mockElement('img', 'preview-image');
        if (sel === '#preview-text') return mockElement('p', 'preview-text');
        if (sel === '#btn-trigger-photo') return mockElement('button', 'btn-trigger-photo');
        if (sel === '#thumbnail-tray') return mockElement('div', 'thumbnail-tray');
        if (sel === '#slot-indicator') return mockElement('h1', 'slot-indicator');
        if (sel === '#camera-error-banner') return mockElement('div', 'camera-error-banner');
        if (sel === '.btn-select') return mockElement('button');
        return mockElement('div');
      }),
      querySelectorAll: vi.fn(() => []),
      addEventListener: vi.fn((evt, cb) => {
        listeners[evt] = cb;
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn((evt) => {
        if (listeners[evt.type]) listeners[evt.type](evt);
      })
    });

    const mockDocument = {
      createElement: vi.fn((tag) => mockElement(tag)),
      getElementById: vi.fn((id) => mockElement('div', id))
    };

    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('window', { photobooth: {} });
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: vi.fn(async () => []),
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }]
        }))
      }
    });

    const parent = mockElement('div', 'app');
    const capture = createCaptureScreen({
      template: {
        id: 'tpl_1',
        nama: 'Test Template',
        jumlah_slot: 2,
        slots: [{ x: 0, y: 0, w: 100, h: 100 }]
      },
      countdownSeconds: 3
    });

    capture.mount(parent);

    // Verify unmount does not throw cancelBtn ReferenceError
    expect(() => capture.unmount()).not.toThrow();

    vi.unstubAllGlobals();
  });

  it('imports main.js without ReferenceError for TIMEOUTS or other constants', async () => {
    const mockApp = { innerHTML: '', appendChild: vi.fn(), removeChild: vi.fn() };
    const mockDocument = {
      getElementById: vi.fn((id) => (id === 'app' ? mockApp : null)),
      createElement: vi.fn(() => ({
        style: {},
        classList: { add: vi.fn(), remove: vi.fn() },
        appendChild: vi.fn(),
        querySelector: vi.fn()
      })),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn()
      }
    };

    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('window', {
      photobooth: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      fetch: vi.fn(async () => ({
        ok: true,
        json: async () => ({ success: true, data: null })
      }))
    });
    vi.stubGlobal('navigator', {
      onLine: true,
      mediaDevices: {
        enumerateDevices: vi.fn(async () => []),
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }]
        }))
      }
    });

    let importError = null;
    try {
      await import('../src/kiosk/main.js');
    } catch (e) {
      importError = e;
    }

    expect(importError).toBeNull();
    vi.unstubAllGlobals();
  });
});

