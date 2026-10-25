import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createIdleTimer } from '../src/shared/ui.js';
import { createInstructionsScreen } from '../src/kiosk/screens/instructions.js';
import { INSTRUCTIONS_COPY } from '../src/shared/copy.js';

describe('createIdleTimer Helper (PRD F-29)', () => {
  let listeners = {};
  let mockWindow;

  beforeEach(() => {
    vi.useFakeTimers();
    listeners = {};
    mockWindow = {
      addEventListener: vi.fn((evt, cb) => {
        listeners[evt] = cb;
      }),
      removeEventListener: vi.fn((evt) => {
        delete listeners[evt];
      }),
      dispatchEvent: vi.fn((evt) => {
        if (listeners[evt.type]) listeners[evt.type](evt);
      })
    };
    vi.stubGlobal('window', mockWindow);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('triggers onTimeout callback after specified timeout seconds', () => {
    const onTimeout = vi.fn();
    const timer = createIdleTimer({ timeoutSeconds: 60, onTimeout });

    timer.start();
    expect(onTimeout).not.toHaveBeenCalled();

    // Fast-forward 59 seconds
    vi.advanceTimersByTime(59000);
    expect(onTimeout).not.toHaveBeenCalled();

    // Fast-forward to 60 seconds
    vi.advanceTimersByTime(1000);
    expect(onTimeout).toHaveBeenCalledTimes(1);

    timer.stop();
  });

  it('resets timeout when user interaction happens', () => {
    const onTimeout = vi.fn();
    const timer = createIdleTimer({ timeoutSeconds: 60, onTimeout });

    timer.start();

    // Advance 40 seconds
    vi.advanceTimersByTime(40000);

    // Simulate user activity event
    if (listeners['pointerdown']) {
      listeners['pointerdown']({ type: 'pointerdown' });
    }

    // Advance another 40 seconds (total 80s, but reset at 40s -> only 40s elapsed since reset)
    vi.advanceTimersByTime(40000);
    expect(onTimeout).not.toHaveBeenCalled();

    // Advance remaining 20 seconds to reach 60s since reset
    vi.advanceTimersByTime(20000);
    expect(onTimeout).toHaveBeenCalledTimes(1);

    timer.stop();
  });

  it('stops timer cleanly and does not fire after stop()', () => {
    const onTimeout = vi.fn();
    const timer = createIdleTimer({ timeoutSeconds: 60, onTimeout });

    timer.start();
    vi.advanceTimersByTime(30000);

    timer.stop();
    vi.advanceTimersByTime(60000);

    expect(onTimeout).not.toHaveBeenCalled();
  });
});

describe('Layar Tata Cara / Instructions Screen (PRD F-26, F-29)', () => {
  let listeners = {};
  let backBtn, nextBtn;

  beforeEach(() => {
    vi.useFakeTimers();
    listeners = {};
    const mockWindow = {
      addEventListener: vi.fn((evt, cb) => {
        listeners[evt] = cb;
      }),
      removeEventListener: vi.fn((evt) => {
        delete listeners[evt];
      })
    };

    const createMockElement = (tag, id = '') => {
      const elListeners = {};
      const el = {
        tagName: tag.toUpperCase(),
        id,
        className: '',
        innerHTML: '',
        dataset: {},
        classList: { add: vi.fn(), remove: vi.fn() },
        appendChild: vi.fn((child) => child),
        removeChild: vi.fn(),
        parentNode: { removeChild: vi.fn() },
        querySelector: vi.fn((sel) => {
          if (sel === '#btn-instructions-back') return backBtn;
          if (sel === '#btn-instructions-next') return nextBtn;
          return null;
        }),
        addEventListener: vi.fn((evt, cb) => {
          elListeners[evt] = cb;
        }),
        removeEventListener: vi.fn((evt) => {
          delete elListeners[evt];
        }),
        click: vi.fn((e) => {
          if (elListeners['click']) {
            elListeners['click'](e || { preventDefault: vi.fn(), stopPropagation: vi.fn() });
          }
        })
      };
      return el;
    };

    backBtn = createMockElement('button', 'btn-instructions-back');
    nextBtn = createMockElement('button', 'btn-instructions-next');

    const mockDocument = {
      createElement: vi.fn((tag) => createMockElement(tag))
    };

    vi.stubGlobal('window', mockWindow);
    vi.stubGlobal('document', mockDocument);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders all 4 steps and copy correctly', () => {
    const onNext = vi.fn();
    const onBack = vi.fn();
    const onTimeout = vi.fn();

    const parent = {
      appendChild: vi.fn()
    };

    const screen = createInstructionsScreen({ onNext, onBack, onTimeout });
    screen.mount(parent);

    expect(parent.appendChild).toHaveBeenCalled();
    const container = parent.appendChild.mock.calls[0][0];
    expect(container.innerHTML).toContain(INSTRUCTIONS_COPY.title);
    expect(container.innerHTML).toContain(INSTRUCTIONS_COPY.subtitle);
    expect(container.innerHTML).toContain(INSTRUCTIONS_COPY.btnBack);
    expect(container.innerHTML).toContain(INSTRUCTIONS_COPY.btnNext);

    for (const step of INSTRUCTIONS_COPY.steps) {
      expect(container.innerHTML).toContain(step.title);
      expect(container.innerHTML).toContain(step.desc);
    }

    backBtn.click();
    expect(onBack).toHaveBeenCalledTimes(1);

    nextBtn.click();
    expect(onNext).toHaveBeenCalledTimes(1);

    screen.unmount();
  });

  it('triggers onTimeout when 60s idle timeout expires', () => {
    const onTimeout = vi.fn();
    const parent = { appendChild: vi.fn() };

    const screen = createInstructionsScreen({
      onNext: vi.fn(),
      onBack: vi.fn(),
      onTimeout
    });

    screen.mount(parent);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(60000);
    expect(onTimeout).toHaveBeenCalledTimes(1);

    screen.unmount();
  });
});
