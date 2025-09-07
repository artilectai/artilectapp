// scripts/migrate-i18n.js
const fs = require('fs');
const path = require('path');

const src = path.resolve('src/lib/translations.ts');

if (!fs.existsSync(src)) {
  console.error('translations.ts not found at', src);
  process.exit(1);
}

let code = fs.readFileSync(src, 'utf8');

// Strip TS bits
code = code
  .replace(/export const translations\s*=\s*/, '')
  .replace(/as const;?/, '')
  .replace(/;\s*$/, '');

// Eval safely in a VM-like Function
const translations = new Function(`return (${code});`)();

const outDir = path.resolve('public/locales');
fs.mkdirSync(path.join(outDir, 'en'), { recursive: true });
fs.mkdirSync(path.join(outDir, 'ru'), { recursive: true });
fs.mkdirSync(path.join(outDir, 'uz'), { recursive: true });

fs.writeFileSync(
  path.join(outDir, 'en', 'app.json'),
  JSON.stringify(translations.en, null, 2)
);
fs.writeFileSync(
  path.join(outDir, 'ru', 'app.json'),
  JSON.stringify(translations.ru, null, 2)
);
// Start uz from English
fs.writeFileSync(
  path.join(outDir, 'uz', 'app.json'),
  JSON.stringify(translations.en, null, 2)
);

console.log('✓ Wrote public/locales/{en,ru,uz}/app.json');
