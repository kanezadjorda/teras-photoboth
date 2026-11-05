import { describe, it, expect } from 'vitest';
import {
  formatSessionNumber,
  formatTimestampWib,
  generatePhotoFilename,
  parsePhotoFilename
} from '../src/shared/filename.js';

describe('Filename Generator (PRD F-17 & Multi-Variant)', () => {
  it('formats session numbers with 4-digit zero-padding', () => {
    expect(formatSessionNumber(1)).toBe('0001');
    expect(formatSessionNumber(42)).toBe('0042');
    expect(formatSessionNumber('99')).toBe('0099');
    expect(formatSessionNumber(1234)).toBe('1234');
    expect(formatSessionNumber(null)).toBe('0001');
    expect(formatSessionNumber(-5)).toBe('0001');
  });

  it('formats date timestamps correctly into YYYYMMDD-HHMMSS', () => {
    const fixedDate = new Date(2026, 9, 12, 14, 30, 22); // Month 9 = October
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

  it('generates original (unfiltered) composite filename pattern', () => {
    const fixedDate = new Date(2026, 9, 12, 14, 30, 22);
    const filename = generatePhotoFilename({
      date: fixedDate,
      sessionNo: 42,
      type: 'composite_original'
    });
    expect(filename).toBe('20261012-143022-0042-original.jpg');
  });

  it('generates raw and raw_filtered photo filename patterns', () => {
    const fixedDate = new Date(2026, 9, 12, 14, 30, 22);
    const rawFile = generatePhotoFilename({
      date: fixedDate,
      sessionNo: 42,
      type: 'raw',
      rawIndex: 3
    });
    expect(rawFile).toBe('20261012-143022-0042-raw-3.jpg');

    const filteredRawFile = generatePhotoFilename({
      date: fixedDate,
      sessionNo: 42,
      type: 'raw_filtered',
      rawIndex: 3
    });
    expect(filteredRawFile).toBe('20261012-143022-0042-raw-3-filtered.jpg');
  });

  it('generates animation GIF and live video filename patterns', () => {
    const fixedDate = new Date(2026, 9, 12, 14, 30, 22);
    const gifFile = generatePhotoFilename({
      date: fixedDate,
      sessionNo: 42,
      type: 'animation'
    });
    expect(gifFile).toBe('20261012-143022-0042-animation.gif');

    const liveMp4 = generatePhotoFilename({
      date: fixedDate,
      sessionNo: 42,
      type: 'live',
      extension: 'mp4'
    });
    expect(liveMp4).toBe('20261012-143022-0042-live.mp4');

    const liveWebm = generatePhotoFilename({
      date: fixedDate,
      sessionNo: 42,
      type: 'live',
      extension: 'webm'
    });
    expect(liveWebm).toBe('20261012-143022-0042-live.webm');
  });

  it('correctly parses valid photobooth filenames back into metadata for all types', () => {
    const compositeParsed = parsePhotoFilename('20261012-143022-0042.jpg');
    expect(compositeParsed.type).toBe('composite');
    expect(compositeParsed.sessionNo).toBe('0042');
    expect(compositeParsed.rawIndex).toBeNull();

    const originalParsed = parsePhotoFilename('20261012-143022-0042-original.jpg');
    expect(originalParsed.type).toBe('composite_original');

    const rawParsed = parsePhotoFilename('20261012-143022-0042-raw-2.jpg');
    expect(rawParsed.type).toBe('raw');
    expect(rawParsed.rawIndex).toBe(2);

    const filteredRawParsed = parsePhotoFilename('20261012-143022-0042-raw-2-filtered.jpg');
    expect(filteredRawParsed.type).toBe('raw_filtered');
    expect(filteredRawParsed.rawIndex).toBe(2);

    const gifParsed = parsePhotoFilename('20261012-143022-0042-animation.gif');
    expect(gifParsed.type).toBe('animation');

    const liveParsed = parsePhotoFilename('20261012-143022-0042-live.mp4');
    expect(liveParsed.type).toBe('live');
    expect(liveParsed.extension).toBe('mp4');

    expect(parsePhotoFilename('invalid-file.png')).toBeNull();
  });
});
