import { SESSION_STATES } from './constants.js';

const ALLOWED_TRANSITIONS = Object.freeze({
  [SESSION_STATES.WAITING_PAYMENT]: [
    SESSION_STATES.CHOOSING_TEMPLATE,
    SESSION_STATES.CANCELLED,
    SESSION_STATES.EXPIRED
  ],
  [SESSION_STATES.CHOOSING_TEMPLATE]: [
    SESSION_STATES.CAPTURING,
    SESSION_STATES.CANCELLED
  ],
  [SESSION_STATES.CAPTURING]: [
    SESSION_STATES.REVIEWING,
    SESSION_STATES.CANCELLED
  ],
  [SESSION_STATES.REVIEWING]: [
    SESSION_STATES.CAPTURING, // retake transition back to capture
    SESSION_STATES.PRINTING,
    SESSION_STATES.CANCELLED
  ],
  [SESSION_STATES.PRINTING]: [
    SESSION_STATES.DONE,
    SESSION_STATES.CANCELLED
  ],
  [SESSION_STATES.DONE]: [],
  [SESSION_STATES.CANCELLED]: [],
  [SESSION_STATES.EXPIRED]: []
});

/**
 * Validates if a state transition is permitted.
 * @param {string} currentState
 * @param {string} targetState
 * @returns {boolean}
 */
export function isValidTransition(currentState, targetState) {
  const allowed = ALLOWED_TRANSITIONS[currentState];
  if (!allowed) {
    return false;
  }
  return allowed.includes(targetState);
}

/**
 * Transitions session state, throwing error on invalid transition.
 * @param {string} currentState
 * @param {string} targetState
 * @returns {string} next state
 */
export function transitionSessionState(currentState, targetState) {
  if (!isValidTransition(currentState, targetState)) {
    throw new Error(`Invalid session state transition from '${currentState}' to '${targetState}'`);
  }
  return targetState;
}

