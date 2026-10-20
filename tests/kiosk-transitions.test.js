import { describe, it, expect, vi } from 'vitest';
import { createChooseTemplateScreen } from '../src/kiosk/screens/choose-template.js';
import { createCaptureScreen } from '../src/kiosk/screens/capture.js';
import { createPaymentScreen } from '../src/kiosk/screens/payment.js';
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

  it('verifies main.js exports and imports constants correctly', async () => {
    // Read and verify main.js contains required constant imports
    const fs = await import('node:fs');
    const path = await import('node:path');
    const mainJsContent = fs.readFileSync(path.resolve(process.cwd(), 'src/kiosk/main.js'), 'utf-8');

    expect(mainJsContent).toContain("import { SESSION_STATES, DEFAULTS, TIMEOUTS } from '../shared/constants.js';");
    expect(mainJsContent).toContain('TIMEOUTS.COUNTDOWN_SECONDS');
  });

  it('shows confirmation modal when cancel button is clicked on payment screen', () => {
    const classSet = new Set(['hidden']);
    const listeners = {};
    const mockElements = {
      '#modal-confirm-cancel': {
        classList: {
          add: vi.fn((cls) => classSet.add(cls)),
          remove: vi.fn((cls) => classSet.delete(cls)),
          contains: vi.fn((cls) => classSet.has(cls))
        }
      },
      '#btn-cancel-payment': {
        addEventListener: vi.fn((evt, cb) => {
          listeners['btn-cancel-payment'] = cb;
        })
      },
      '#btn-cancel-yes': {
        addEventListener: vi.fn((evt, cb) => {
          listeners['btn-cancel-yes'] = cb;
        })
      },
      '#btn-cancel-no': {
        addEventListener: vi.fn((evt, cb) => {
          listeners['btn-cancel-no'] = cb;
        })
      },
      '#btn-simulate-pay': {
        addEventListener: vi.fn()
      }
    };

    const mockContainer = {
      className: '',
      innerHTML: '',
      querySelector: vi.fn((sel) => mockElements[sel] || {
        addEventListener: vi.fn(),
        classList: { add: vi.fn(), remove: vi.fn() },
        style: {}
      }),
      querySelectorAll: vi.fn(() => []),
      parentNode: {
        removeChild: vi.fn()
      }
    };

    const mockDocument = {
      createElement: vi.fn(() => mockContainer)
    };

    vi.stubGlobal('document', mockDocument);
    vi.stubGlobal('window', {
      fetch: vi.fn(async () => ({
        ok: true,
        json: async () => ({ success: true, data: {} })
      }))
    });

    const onCancelMock = vi.fn();
    const payment = createPaymentScreen({
      sessionId: 'sess_test_123',
      onCancel: onCancelMock
    });

    const parent = { appendChild: vi.fn() };
    payment.mount(parent);

    // 1. Initial state: onCancel not called, modal is hidden
    expect(onCancelMock).not.toHaveBeenCalled();
    expect(classSet.has('hidden')).toBe(true);

    // 2. Click cancel button -> modal shows, onCancel still not called
    listeners['btn-cancel-payment']();
    expect(classSet.has('hidden')).toBe(false);
    expect(onCancelMock).not.toHaveBeenCalled();

    // 3. Click TIDAK button -> modal hides again, onCancel still not called
    listeners['btn-cancel-no']();
    expect(classSet.has('hidden')).toBe(true);
    expect(onCancelMock).not.toHaveBeenCalled();

    // 4. Click cancel button again, then click YA -> onCancel is called
    listeners['btn-cancel-payment']();
    expect(classSet.has('hidden')).toBe(false);
    listeners['btn-cancel-yes']();
    expect(onCancelMock).toHaveBeenCalledTimes(1);

    payment.unmount();
    vi.unstubAllGlobals();
  });
});

