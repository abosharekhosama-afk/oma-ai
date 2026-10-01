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
  for (const key of ['planableScreenshot', 'omaBeforeScreenshot', 'omaAfterScreenshot', 'diff']) {
    const p = row[key];
    if (typeof p === 'string' && p && !fs.existsSync(path.join(ROOT, p)) && !fs.existsSync(p)) {
      // Allow relative under artifacts
      const alt = path.join(ROOT, 'artifacts/oma-planable-pixel-parity', p);
      if (!fs.existsSync(alt) && !String(p).startsWith('PENDING')) {
        console.error('file missing', row.id, key, p);
        errors++;
      }
    }
  }
}

if (errors) fail(`${errors} coverage errors`);
console.log('PIXEL_PARITY_COVERAGE_OK', rows.length, 'rows');
