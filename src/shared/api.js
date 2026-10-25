/**
 * API Client for interacting with Express local server
 */

import { DEFAULTS } from './constants.js';

const BASE_URL = `http://localhost:${DEFAULTS.SERVER_PORT}/api`;

export async function fetchApi(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP error ${response.status}`);
  }

  return response.json();
}

export const api = {
  getHealth: () => fetchApi('/health'),
  getSettings: () => fetchApi('/settings'),
  updateSettings: (data) => fetchApi('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  getTemplates: (all = false) => fetchApi(`/templates?all=${all}`),
  getTemplate: (id) => fetchApi(`/templates/${id}`),
  createTemplate: (data) => fetchApi('/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id, data) => fetchApi(`/templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTemplate: (id) => fetchApi(`/templates/${id}`, { method: 'DELETE' }),
  getCurrentSession: () => fetchApi('/sessions/current'),
  createSession: () => fetchApi('/sessions', { method: 'POST' }),
  updateSessionStatus: (id, status, template_id, effect_id) =>
    fetchApi(`/sessions/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, template_id, effect_id })
    }),
  getPayment: (sessionId) => fetchApi(`/payments/${sessionId}`),
  createPaymentCharge: (sessionId) =>
    fetchApi('/payments/charge', { method: 'POST', body: JSON.stringify({ sessionId }) }),
  cancelPayment: (sessionId) =>
    fetchApi(`/payments/${sessionId}/cancel`, { method: 'POST' }),
  confirmPaymentManual: (sessionId) =>
    fetchApi(`/payments/${sessionId}/confirm-manual`, { method: 'POST' }),
  simulatePayment: (orderId) =>
    fetchApi(`/payments/${orderId}/simulate-pay`, { method: 'POST' }),
  savePhotos: (sessionId, { composite, rawPhotos }) =>
    fetchApi(`/sessions/${sessionId}/save-photos`, {
      method: 'POST',
      body: JSON.stringify({ composite, rawPhotos })
    }),
  getSessionPhotos: (sessionId) => fetchApi(`/sessions/${sessionId}/photos`),
  verifyPin: (pin) =>
    fetchApi('/settings/verify-pin', {
      method: 'POST',
      body: JSON.stringify({ pin })
    }),
  getHistory: (eventId = '') =>
    fetchApi(eventId ? `/sessions/history?event_id=${encodeURIComponent(eventId)}` : '/sessions/history'),
  reprintSession: (sessionId) =>
    fetchApi(`/sessions/${sessionId}/reprint`, { method: 'POST' }),
  getDailyReport: (eventId = '') =>
    fetchApi(eventId ? `/reports/daily?event_id=${encodeURIComponent(eventId)}` : '/reports/daily'),
  getExportCsvUrl: (eventId = '') =>
    eventId
      ? `http://localhost:${DEFAULTS.SERVER_PORT}/api/reports/export-csv?event_id=${encodeURIComponent(eventId)}`
      : `http://localhost:${DEFAULTS.SERVER_PORT}/api/reports/export-csv`,
  getEvents: () => fetchApi('/events'),
  getActiveEvent: () => fetchApi('/events/active'),
  createEvent: (data) =>
    fetchApi('/events', { method: 'POST', body: JSON.stringify(data) }),
  activateEvent: (id) =>
    fetchApi(`/events/${id}/activate`, { method: 'PATCH' }),
  deactivateEvent: (id) =>
    fetchApi(`/events/${id}/deactivate`, { method: 'PATCH' }),
  deleteEvent: (id) =>
    fetchApi(`/events/${id}`, { method: 'DELETE' })
};

// Graceful fallback for window.photobooth when running in web browser mode
if (typeof window !== 'undefined' && !window.photobooth) {
  window.photobooth = {
    getAppVersion: async () => '0.9.1 (web)',
    printSilent: async () => {
      window.print();
      return { success: true };
    },
    getPrinters: async () => [],
    quitApp: async () => {
      console.warn('[Photobooth] quitApp called in web mode (no-op)');
    },
    selectFolder: async () => null
  };
}


