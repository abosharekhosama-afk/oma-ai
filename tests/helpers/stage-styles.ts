import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const stylesRoot = join(process.cwd(), 'apps/web/src/styles');

function readDirPartials(subdir: string): string {
  const folder = join(stylesRoot, subdir);
  return readdirSync(folder)
    .filter((name) => name.endsWith('.css'))
    .sort()
    .map((name) => readFileSync(join(folder, name), 'utf8'))
    .join('\n');
}

/** Full stage3 CSS text (index + partials) for invariant tests after modular split. */
export function readStage3Styles(): string {
  const index = readFileSync(join(stylesRoot, 'stage3.css'), 'utf8');
  return `${index}\n${readDirPartials('stage3')}`;
}

/** Full stage4 CSS text (index + partials) for invariant tests after modular split. */
export function readStage4Styles(): string {
  const index = readFileSync(join(stylesRoot, 'stage4.css'), 'utf8');
  return `${index}\n${readDirPartials('stage4')}`;
}
