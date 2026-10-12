import { describe, it, expect } from 'vitest';
import {
  formatSessionNumber,
  formatTimestampWib,
  generatePhotoFilename,
  parsePhotoFilename
} from '../src/shared/filename.js';

describe('Filename Generator (PRD F-17)', () => {
  it('formats session numbers with 4-digit zero-padding', () => {
    expect(formatSessionNumber(1)).toBe('0001');
    expect(formatSessionNumber(42)).toBe('0042');
    expect(formatSessionNumber('99')).toBe('0099');
    expect(formatSessionNumber(1234)).toBe('1234');
    expect(formatSessionNumber(null)).toBe('0001');
    expect(formatSessionNumber(-5)).toBe('0001');
  });

  it('formats date timestamps correctly into YYYYMMDD-HHMMSS', () => {
    const fixedDate = new Date(2026, 9, 12, 14, 30, 22); // Note: month 9 is October in 0-indexed JS Date
    const ts = formatTimestampWib(fixedDate);
    expect(ts).toBe('20261012-143022');
  });

  it('generates standard composite filename pattern YYYYMMDD-HHMMSS-<session-no>.jpg', () => {
    const fixedDate = new Date(2026, 9, 12, 14, 30, 22);
    const filename = generatePhotoFilename({
      date: fixedDate,
      sessionNo: 42,
      type: 'composite'
    });

    expect(filename).toBe('20261012-143022-0042.jpg');
  });

  it('generates raw photo filename pattern with rawIndex', () => {
    const fixedDate = new Date(2026, 9, 12, 14, 30, 22);
    const filename = generatePhotoFilename({
      date: fixedDate,
      sessionNo: 42,
      type: 'raw',
      rawIndex: 3
    });

    expect(filename).toBe('20261012-143022-0042-raw-3.jpg');
  });

  it('correctly parses valid photobooth filenames back into metadata', () => {
    const compositeParsed = parsePhotoFilename('20261012-143022-0042.jpg');
    expect(compositeParsed).not.toBeNull();
    expect(compositeParsed.datePart).toBe('20261012');
    expect(compositeParsed.timePart).toBe('143022');
    expect(compositeParsed.sessionNo).toBe('0042');
    expect(compositeParsed.type).toBe('composite');
    expect(compositeParsed.rawIndex).toBeNull();

    const rawParsed = parsePhotoFilename('20261012-143022-0042-raw-2.jpg');
    expect(rawParsed).not.toBeNull();
    expect(rawParsed.type).toBe('raw');
    expect(rawParsed.rawIndex).toBe(2);

    expect(parsePhotoFilename('invalid-file.png')).toBeNull();
  });
});
