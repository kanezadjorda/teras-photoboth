import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let isLoaded = false;

/**
 * Loads environment variables from the most appropriate .env location.
 * Priority:
 * 1. Packaged Electron resources directory (process.resourcesPath/.env)
 * 2. AppData DATA_DIR parent/folder (if configured)
 * 3. process.cwd() (current working directory)
 * 4. Project root relative to this server module (../../.env or ../.env)
 * 
 * PRD Reference: F-01, F-20, F-30 (Midtrans, Cloudflare R2, Web Gallery)
 */
export function loadEnv() {
  if (isLoaded) return;

  const candidates = [];

  // 1. Packaged Electron resources directory (e.g. <installed-app>/resources/.env)
  if (typeof process !== 'undefined' && process.resourcesPath) {
    candidates.push(resolve(process.resourcesPath, '.env'));
  }

  // 2. DATA_DIR path (userData/data/.env or userData/.env)
  if (process.env.DATA_DIR) {
    candidates.push(resolve(process.env.DATA_DIR, '.env'));
    candidates.push(resolve(process.env.DATA_DIR, '../.env'));
  }

  // 3. Process current working directory
  candidates.push(resolve(process.cwd(), '.env'));

  // 4. Relative to server directory
  candidates.push(resolve(__dirname, '../.env'));

  for (const envPath of candidates) {
    if (existsSync(envPath)) {
      dotenv.config({ path: envPath });
      console.log(`[Env] Berhasil memuat konfigurasi dari: ${envPath}`);
      isLoaded = true;
      return envPath;
    }
  }

  // Fallback to default dotenv lookup
  dotenv.config();
  isLoaded = true;
  return null;
}

// Auto-run on import to ensure early initialization
loadEnv();
