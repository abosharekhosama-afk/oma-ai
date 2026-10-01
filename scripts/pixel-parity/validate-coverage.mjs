/**
 * pnpm ui:pixel-parity-coverage — fails when required pixel evidence rows are incomplete.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const MANIFEST = path.join(ROOT, '.reference/009-planable-pixel-parity/manifest.json');

function fail(msg) {
  console.error('PIXEL_PARITY_COVERAGE_FAIL', msg);
  process.exit(1);
}

if (!fs.existsSync(MANIFEST)) {
  fail(`missing manifest ${MANIFEST}`);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const rows = manifest.rows ?? [];
if (!rows.length) fail('manifest.rows empty');

const requiredKeys = [
  'id',
  'planableScreenshot',
  'omaBeforeScreenshot',
  'omaAfterScreenshot',
  'diff',
  'measurements',
  'verdict',
  'evidenceLevel',
];

let errors = 0;
for (const row of rows) {
  for (const k of requiredKeys) {
    if (row[k] == null || row[k] === '') {
      console.error('missing', k, 'on', row.id ?? '(no id)');
      errors++;
    }
  }
  if (row.verdict === 'PASS' && manifest.ownerVisualReview === 'REJECTED') {
    console.error('PASS forbidden while ownerVisualReview=REJECTED', row.id);
    errors++;
  }
  // Raw PNGs are gitignored under artifacts/. CI validates metadata contract only.
  // File presence is required locally when verdict claims READY_FOR_OWNER_REVIEW.
  if (row.verdict === 'READY_FOR_OWNER_REVIEW') {
    for (const key of ['planableScreenshot', 'omaBeforeScreenshot', 'omaAfterScreenshot', 'diff']) {
      const p = row[key];
      if (typeof p !== 'string' || !p || p.startsWith('PENDING')) {
        console.error('READY row missing path', row.id, key);
        errors++;
        continue;
      }
      const abs = path.isAbsolute(p) ? p : path.join(ROOT, p);
      if (!fs.existsSync(abs)) {
        console.error('READY row file missing', row.id, key, p);
        errors++;
      }
    }
  }
}

if (errors) fail(`${errors} coverage errors`);
console.log('PIXEL_PARITY_COVERAGE_OK', rows.length, 'rows');
