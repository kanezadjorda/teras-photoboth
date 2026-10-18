import { ADMIN_ROUTES } from '../shared/constants.js';

const VALID_ROUTES = Object.values(ADMIN_ROUTES);

/**
 * Converts a location hash (e.g. "#/laporan") into a known admin route.
 * Unknown or empty hashes fall back to the home route.
 */
export function parseAdminRoute(hash) {
  const route = String(hash || '').replace(/^#\/?/, '').trim().toLowerCase();
  return VALID_ROUTES.includes(route) ? route : ADMIN_ROUTES.HOME;
}

export function toAdminHash(route) {
  return `#/${route}`;
}

