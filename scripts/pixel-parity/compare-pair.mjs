/**
 * Deterministic PNG pixel comparison (pixelmatch + pngjs).
 * Usage: node scripts/pixel-parity/compare-pair.mjs <ref.png> <oma.png> <outDir> [label]
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const [refPath, omaPath, outDir, label = 'pair'] = process.argv.slice(2);
if (!refPath || !omaPath || !outDir) {
  console.error('Usage: compare-pair.mjs <ref.png> <oma.png> <outDir> [label]');
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

function readPng(p) {
  return PNG.sync.read(fs.readFileSync(p));
}

const ref = readPng(refPath);
const oma = readPng(omaPath);
const width = Math.min(ref.width, oma.width);
const height = Math.min(ref.height, oma.height);

function crop(src, w, h) {
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = (src.width * y + x) << 2;
      const di = (w * y + x) << 2;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
}

const a = crop(ref, width, height);
const b = crop(oma, width, height);
const diff = new PNG({ width, height });
const mismatch = pixelmatch(a.data, b.data, diff.data, width, height, {
  threshold: 0.1,
  includeAA: false,
});
const total = width * height;
const pct = total ? (mismatch / total) * 100 : 100;

const diffFile = path.join(outDir, `${label}-diff.png`);
const heatFile = path.join(outDir, `${label}-heatmap.png`);
fs.writeFileSync(diffFile, PNG.sync.write(diff));
fs.writeFileSync(heatFile, PNG.sync.write(diff));

const report = {
  label,
  ref: path.basename(refPath),
  oma: path.basename(omaPath),
  width,
  height,
  mismatchPixels: mismatch,
  mismatchPercent: Number(pct.toFixed(4)),
  sizeDelta: { ref: { w: ref.width, h: ref.height }, oma: { w: oma.width, h: oma.height } },
  thresholdNote:
    '≤3% chrome mismatch after content-only normalization is a target, not an override for visible defects',
  diff: path.basename(diffFile),
  heatmap: path.basename(heatFile),
};
fs.writeFileSync(path.join(outDir, `${label}-report.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
