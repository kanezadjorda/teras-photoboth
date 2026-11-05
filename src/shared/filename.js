/**
 * Utility modul penamaan file foto photobooth (PRD F-17)
 * Pola nama: YYYYMMDD-HHMMSS-<session-no>.jpg
 * Waktu menggunakan zona lokal WIB (UTC+7)
 */

/**
 * Format nomor sesi menjadi string 4 digit (misal: 1 -> '0001', 42 -> '0042')
 * @param {number|string} sessionNo
 * @returns {string}
 */
export function formatSessionNumber(sessionNo) {
  const num = parseInt(sessionNo, 10);
  if (isNaN(num) || num < 0) {
    return '0001';
  }
  return String(num).padStart(4, '0');
}

/**
 * Format objek Date menjadi timestamp lokal WIB format YYYYMMDD-HHMMSS
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function formatTimestampWib(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);

  // Ambil komponen tanggal & waktu lokal
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * Menghasilkan nama file foto/video/GIF sesuai standar PRD F-17 & varian baru
 * @param {Object} options
 * @param {Date} [options.date=new Date()]
 * @param {number|string} [options.sessionNo=1]
 * @param {'composite'|'composite_original'|'raw'|'raw_filtered'|'animation'|'live'} [options.type='composite']
 * @param {number} [options.rawIndex=1]
 * @param {string} [options.extension]
 * @returns {string} Contoh:
 *   - '20261012-143022-0042.jpg'
 *   - '20261012-143022-0042-original.jpg'
 *   - '20261012-143022-0042-raw-1.jpg'
 *   - '20261012-143022-0042-raw-1-filtered.jpg'
 *   - '20261012-143022-0042-animation.gif'
 *   - '20261012-143022-0042-live.mp4'
 */
export function generatePhotoFilename({
  date = new Date(),
  sessionNo = 1,
  type = 'composite',
  rawIndex = 1,
  extension
} = {}) {
  const timestamp = formatTimestampWib(date);
  const formattedSessionNo = formatSessionNumber(sessionNo);

  if (type === 'composite_original') {
    return `${timestamp}-${formattedSessionNo}-original.jpg`;
  }

  if (type === 'raw') {
    return `${timestamp}-${formattedSessionNo}-raw-${rawIndex}.jpg`;
  }

  if (type === 'raw_filtered') {
    return `${timestamp}-${formattedSessionNo}-raw-${rawIndex}-filtered.jpg`;
  }

  if (type === 'animation' || type === 'gif') {
    return `${timestamp}-${formattedSessionNo}-animation.gif`;
  }

  if (type === 'live') {
    const ext = extension || 'mp4';
    return `${timestamp}-${formattedSessionNo}-live.${ext}`;
  }

  return `${timestamp}-${formattedSessionNo}.jpg`;
}

/**
 * Mem-parse nama file foto/media kembali ke komponen datanya
 * @param {string} filename
 * @returns {Object|null}
 */
export function parsePhotoFilename(filename) {
  if (!filename || typeof filename !== 'string') return null;

  // Pattern: YYYYMMDD-HHMMSS-SSSS(-variant)?.(jpg|jpeg|gif|mp4|webm)
  const regex = /^(\d{8})-(\d{6})-(\d{4})(?:-(original|animation|live|raw-(\d+)(?:-(filtered))?))?\.(jpg|jpeg|gif|mp4|webm)$/i;
  const match = filename.trim().match(regex);
  if (!match) return null;

  const [, datePart, timePart, sessionNo, modifier, rawIdx, isFiltered, ext] = match;

  let type = 'composite';
  let rawIndex = null;

  if (modifier === 'original') {
    type = 'composite_original';
  } else if (modifier === 'animation') {
    type = 'animation';
  } else if (modifier === 'live') {
    type = 'live';
  } else if (rawIdx) {
    rawIndex = parseInt(rawIdx, 10);
    type = isFiltered ? 'raw_filtered' : 'raw';
  }

  return {
    filename,
    datePart,
    timePart,
    sessionNo,
    type,
    rawIndex,
    extension: ext.toLowerCase()
  };
}
