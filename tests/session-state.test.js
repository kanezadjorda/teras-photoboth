import { describe, it, expect } from 'vitest';
import { SESSION_STATES } from '../src/shared/constants.js';
import { isValidTransition, transitionSessionState } from '../src/shared/session-state.js';

describe('Session State Machine', () => {
  it('allows valid forward transitions', () => {
    expect(isValidTransition(SESSION_STATES.VIEWING_INSTRUCTIONS, SESSION_STATES.WAITING_PAYMENT)).toBe(true);
    expect(isValidTransition(SESSION_STATES.WAITING_PAYMENT, SESSION_STATES.CHOOSING_TEMPLATE)).toBe(true);
    expect(isValidTransition(SESSION_STATES.CHOOSING_TEMPLATE, SESSION_STATES.CAPTURING)).toBe(true);
    expect(isValidTransition(SESSION_STATES.CAPTURING, SESSION_STATES.CHOOSING_EFFECT)).toBe(true);
    expect(isValidTransition(SESSION_STATES.CHOOSING_EFFECT, SESSION_STATES.PRINTING)).toBe(true);
    expect(isValidTransition(SESSION_STATES.CAPTURING, SESSION_STATES.REVIEWING)).toBe(true);
    expect(isValidTransition(SESSION_STATES.REVIEWING, SESSION_STATES.PRINTING)).toBe(true);
    expect(isValidTransition(SESSION_STATES.PRINTING, SESSION_STATES.DONE)).toBe(true);
  });

  it('allows retake transition from choosing_effect or reviewing to capturing', () => {
    expect(isValidTransition(SESSION_STATES.CHOOSING_EFFECT, SESSION_STATES.CAPTURING)).toBe(true);
    expect(isValidTransition(SESSION_STATES.REVIEWING, SESSION_STATES.CAPTURING)).toBe(true);
  });

  it('allows cancellation from active states', () => {
    expect(isValidTransition(SESSION_STATES.VIEWING_INSTRUCTIONS, SESSION_STATES.CANCELLED)).toBe(true);
    expect(isValidTransition(SESSION_STATES.WAITING_PAYMENT, SESSION_STATES.CANCELLED)).toBe(true);
    expect(isValidTransition(SESSION_STATES.CHOOSING_TEMPLATE, SESSION_STATES.CANCELLED)).toBe(true);
    expect(isValidTransition(SESSION_STATES.CAPTURING, SESSION_STATES.CANCELLED)).toBe(true);
    expect(isValidTransition(SESSION_STATES.CHOOSING_EFFECT, SESSION_STATES.CANCELLED)).toBe(true);
    expect(isValidTransition(SESSION_STATES.REVIEWING, SESSION_STATES.CANCELLED)).toBe(true);
    expect(isValidTransition(SESSION_STATES.PRINTING, SESSION_STATES.CANCELLED)).toBe(true);
  });

  it('allows expiration from waiting_payment', () => {
    expect(isValidTransition(SESSION_STATES.WAITING_PAYMENT, SESSION_STATES.EXPIRED)).toBe(true);
  });

  it('allows idempotent self-transitions', () => {
    expect(isValidTransition(SESSION_STATES.CAPTURING, SESSION_STATES.CAPTURING)).toBe(true);
    expect(isValidTransition(SESSION_STATES.CHOOSING_TEMPLATE, SESSION_STATES.CHOOSING_TEMPLATE)).toBe(true);
    expect(transitionSessionState(SESSION_STATES.CAPTURING, SESSION_STATES.CAPTURING)).toBe(SESSION_STATES.CAPTURING);
  });

  it('rejects invalid state transitions', () => {
    expect(isValidTransition(SESSION_STATES.VIEWING_INSTRUCTIONS, SESSION_STATES.DONE)).toBe(false);
    expect(isValidTransition(SESSION_STATES.VIEWING_INSTRUCTIONS, SESSION_STATES.PRINTING)).toBe(false);
    expect(isValidTransition(SESSION_STATES.WAITING_PAYMENT, SESSION_STATES.DONE)).toBe(false);
    expect(isValidTransition(SESSION_STATES.DONE, SESSION_STATES.WAITING_PAYMENT)).toBe(false);
    expect(isValidTransition(SESSION_STATES.CHOOSING_TEMPLATE, SESSION_STATES.PRINTING)).toBe(false);
    expect(() => transitionSessionState(SESSION_STATES.WAITING_PAYMENT, SESSION_STATES.PRINTING)).toThrow();
    expect(() => transitionSessionState(SESSION_STATES.VIEWING_INSTRUCTIONS, SESSION_STATES.CAPTURING)).toThrow();
  });
});

