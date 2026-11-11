// Renders the SVG sources in branding/ into the committed PNGs.
//   node scripts/export-branding.mjs         write the PNGs
//   node scripts/export-branding.mjs --check fail if a committed PNG differs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const images = 'assets/images';
const fastlaneIcon = 'fastlane/metadata/android/en-US/images/icon.png';

const targets = [
  { svg: 'branding/icon.svg', out: `${images}/icon.png`, size: 1024 },
  { svg: 'branding/glyph.svg', out: `${images}/android-icon-foreground.png`, size: 1024 },
  {
    svg: 'branding/glyph-monochrome.svg',
    out: `${images}/android-icon-monochrome.png`,
    size: 1024,
  },
  { svg: 'branding/glyph.svg', out: `${images}/splash-icon.png`, size: 1024 },
  { svg: 'branding/icon.svg', out: `${images}/favicon.png`, size: 48 },
  { svg: 'branding/icon.svg', out: fastlaneIcon, size: 512 },
];

function render({ svg, size }) {
  const source = readFileSync(join(root, svg));
  const resvg = new Resvg(source, {
    fitTo: { mode: 'width', value: size },
    font: { loadSystemFonts: false },
  });
  return resvg.render().asPng();
}

function readExisting(path) {
  try {
    return readFileSync(path);
  } catch {
    return null;
  }
}

const check = process.argv.includes('--check');
const stale = [];

for (const target of targets) {
  const png = render(target);
  const path = join(root, target.out);
  if (check) {
    const current = readExisting(path);
    if (current === null || !current.equals(png)) stale.push(target.out);
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, png);
    console.log(`wrote ${relative(root, path)} (${target.size}px)`);
  }
}

if (check) {
  if (stale.length > 0) {
    console.error(`Out of date, run "pnpm brand:export":\n  ${stale.join('\n  ')}`);
    process.exit(1);
  }
  console.log('Branding PNGs are up to date.');
}
