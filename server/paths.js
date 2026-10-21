import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Writable data root. Electron sets DATA_DIR before the server is imported
 * (userData/data when packaged); dev/tests fall back to ./data.
 * Never write inside the app folder: it is a read-only app.asar when packaged.
 */
export const DATA_DIR = resolve(process.env.DATA_DIR || resolve(PROJECT_ROOT, 'data'));

/** Default output folder value stored in settings (relative to DATA_DIR's parent). */
export const DEFAULT_PHOTOS_FOLDER = process.env.OUTPUT_FOLDER || './data/photos';

/** Admin-uploaded template PNGs (writable). */
export const UPLOADED_TEMPLATES_DIR = resolve(DATA_DIR, 'templates');

/** Built-in template PNGs (read-only; extraResources when packaged). */
export const BUNDLED_TEMPLATES_DIR = process.env.BUNDLED_TEMPLATES_DIR || resolve(PROJECT_ROOT, 'templates');

/**
 * Resolves a stored folder/file path. Relative values (e.g. './data/photos/x')
 * are anchored to DATA_DIR's parent so existing DB values keep working in dev
 * and land in userData when packaged, independent of process.cwd().
 * @param {string} storedPath
 * @returns {string}
 */
export function resolveStoredPath(storedPath) {
  return isAbsolute(storedPath) ? storedPath : resolve(dirname(DATA_DIR), storedPath);
}

/**
 * Resolves a stored path and ensures the directory exists.
 * @param {string} storedPath
 * @returns {string}
 */
export function ensureStoredDir(storedPath) {
  const fullPath = resolveStoredPath(storedPath);
  mkdirSync(fullPath, { recursive: true });
  return fullPath;
}

