/**
 * Photo Effect Presets Configuration
 * PRD Reference: F-27, F-28
 *
 * Defines 7 photo filter presets applied strictly to photos (not template overlay).
 * Filter strings match standard CSS filter syntax and Canvas ctx.filter.
 */

export const EFFECT_PRESETS = Object.freeze({
  normal: Object.freeze({
    id: 'normal',
    label: 'Normal',
    filter: 'none'
  }),
  bw: Object.freeze({
    id: 'bw',
    label: 'Hitam Putih',
    filter: 'grayscale(1) contrast(1.1)'
  }),
  sepia: Object.freeze({
    id: 'sepia',
    label: 'Sepia',
    filter: 'sepia(0.8) contrast(1.05)'
  }),
  vintage: Object.freeze({
    id: 'vintage',
    label: 'Vintage',
    filter: 'sepia(0.35) contrast(1.1) saturate(0.85) brightness(1.05)'
  }),
  cerah: Object.freeze({
    id: 'cerah',
    label: 'Cerah',
    filter: 'brightness(1.1) contrast(1.05) saturate(1.2)'
  }),
  hangat: Object.freeze({
    id: 'hangat',
    label: 'Hangat',
    filter: 'sepia(0.2) saturate(1.2) hue-rotate(-10deg)'
  }),
  dingin: Object.freeze({
    id: 'dingin',
    label: 'Dingin',
    filter: 'saturate(1.1) hue-rotate(15deg) brightness(1.02)'
  })
});

export const EFFECT_LIST = Object.freeze(Object.values(EFFECT_PRESETS));

/**
 * Retrieves an effect preset by its ID, with automatic fallback to 'normal'
 * for unknown, null, or invalid IDs.
 * @param {string} id
 * @returns {{ id: string, label: string, filter: string }}
 */
export function getEffect(id) {
  if (!id || typeof id !== 'string') {
    return EFFECT_PRESETS.normal;
  }
  const normalized = id.toLowerCase().trim();
  return EFFECT_PRESETS[normalized] || EFFECT_PRESETS.normal;
}
