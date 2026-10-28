import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const transcriptLimits = { fileBytes: 256 * 1024 * 1024, lineBytes: 8 * 1024 * 1024 };
type Line = { text: string; number: number; terminated: boolean };

// Stream instead of splitting the transcript in memory. The callback may stop a
// prefix probe; only a full scan's digest describes the entire observed file.
export function scanTranscript(file: string, visit: (line: Line) => boolean | void,
  limits = transcriptLimits): { bytes: number; sha256: string } {
  const fd = openSync(file, 'r'), hash = createHash('sha256');
  let bytes = 0, length = 0, number = 0;
  let parts: Buffer[] = [];
  const line = (terminated: boolean) => {
    let text = Buffer.concat(parts, length).toString('utf8');
    if (number === 0) text = text.replace(/^\uFEFF/, '');
    parts = []; length = 0;
    return visit({ text, number: ++number, terminated });
  };
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) throw new Error('Transcript must be a regular file.');
    if (stat.size > limits.fileBytes) throw new Error(`Transcript exceeds ${limits.fileBytes} byte file limit.`);
    const chunk = Buffer.alloc(64 * 1024);
    for (;;) {
      const count = readSync(fd, chunk, 0, chunk.length, null);
      if (!count) break;
      bytes += count;
      if (bytes > limits.fileBytes) throw new Error(`Transcript exceeds ${limits.fileBytes} byte file limit.`);
      hash.update(chunk.subarray(0, count));
      let start = 0;
      for (let i = 0; i < count; i++) if (chunk[i] === 10) {
        length += i - start;
        if (length > limits.lineBytes) throw new Error(`Transcript line exceeds ${limits.lineBytes} byte limit.`);
        parts.push(Buffer.from(chunk.subarray(start, i)));
        if (line(true) === false) return { bytes, sha256: hash.digest('hex') };
        start = i + 1;
      }
      length += count - start;
      if (length > limits.lineBytes) throw new Error(`Transcript line exceeds ${limits.lineBytes} byte limit.`);
      if (start < count) parts.push(Buffer.from(chunk.subarray(start, count)));
    }
    if (length) line(false);
    return { bytes, sha256: hash.digest('hex') };
  } finally { closeSync(fd); }
}

export function sniffTranscriptVendor(file: string): string {
  let vendor = 'unknown';
  scanTranscript(file, ({ text, number }) => {
    let record;
    try { record = JSON.parse(text); } catch { return number < 50; }
    if (record && typeof record === 'object') {
      if ('payload' in record || record.type === 'session_meta') { vendor = 'codex'; return false; }
      if (record.message && typeof record.message === 'object') {
        vendor = 'claude';
        if ('usage' in record.message) return false;
      }
    }
    return number < 50;
  }, { ...transcriptLimits, fileBytes: Infinity });
  return vendor;
}
