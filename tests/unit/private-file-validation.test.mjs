import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPrivateFileMime,
  matchesPrivateFileSignature,
  sanitizePrivateFileName,
  isValidPrivateFileSize,
  MAX_PRIVATE_FILE_BYTES,
} from '../../src/lib/private-file-validation.ts';

test('allows only the four explicitly supported file types', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) assert.equal(isPrivateFileMime(type), true);
  for (const type of ['text/html', 'image/svg+xml', 'application/zip', '', 'application/x-msdownload']) assert.equal(isPrivateFileMime(type), false);
});

test('checks file signatures rather than trusting the declared MIME type', () => {
  assert.equal(matchesPrivateFileSignature(Uint8Array.from([0xff,0xd8,0xff,0x00]), 'image/jpeg'), true);
  assert.equal(matchesPrivateFileSignature(Uint8Array.from([137,80,78,71,13,10,26,10]), 'image/png'), true);
  assert.equal(matchesPrivateFileSignature(Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80]), 'image/webp'), true);
  assert.equal(matchesPrivateFileSignature(new TextEncoder().encode('%PDF-1.7'), 'application/pdf'), true);
  assert.equal(matchesPrivateFileSignature(new TextEncoder().encode('<html>'), 'application/pdf'), false);
  assert.equal(matchesPrivateFileSignature(new Uint8Array([0xff]), 'image/jpeg'), false);
  assert.equal(matchesPrivateFileSignature(new Uint8Array(), 'image/svg+xml'), false);
});

test('rejects empty, oversized and non-integer file sizes', () => {
  assert.equal(isValidPrivateFileSize(1), true);
  assert.equal(isValidPrivateFileSize(MAX_PRIVATE_FILE_BYTES), true);
  assert.equal(isValidPrivateFileSize(0), false);
  assert.equal(isValidPrivateFileSize(MAX_PRIVATE_FILE_BYTES + 1), false);
  assert.equal(isValidPrivateFileSize(1.5), false);
  assert.equal(isValidPrivateFileSize(Number.NaN), false);
});

test('sanitizes path separators and control characters in original names', () => {
  assert.equal(sanitizePrivateFileName('../private\\\\doc.pdf', 'upload.pdf'), '.._private__doc.pdf');
  assert.equal(sanitizePrivateFileName('bad\\nname.pdf', 'upload.pdf'), 'bad_name.pdf');
  assert.equal(sanitizePrivateFileName('   ', 'upload.pdf'), 'upload.pdf');
  assert.equal(sanitizePrivateFileName('a'.repeat(250), 'upload.pdf').length, 180);
});
