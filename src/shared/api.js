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
  getCurrentSession: () => fetchApi('/sessions/current'),
  createSession: () => fetchApi('/sessions', { method: 'POST' }),
  updateSessionStatus: (id, status, template_id) =>
    fetchApi(`/sessions/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, template_id })
    }),
  getPayment: (sessionId) => fetchApi(`/payments/${sessionId}`),
  confirmPaymentManual: (sessionId) =>
    fetchApi(`/payments/${sessionId}/confirm-manual`, { method: 'POST' })
};
