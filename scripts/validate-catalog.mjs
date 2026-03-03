import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const catalogPath = path.join(root, 'src', 'catalog.json');

const fail = (message) => {
  console.error(`[catalog] ${message}`);
  process.exit(1);
};

if (!fs.existsSync(catalogPath)) {
  fail('catalog.json not found');
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
if (!Array.isArray(catalog.tools) || catalog.tools.length === 0) {
  fail('catalog.tools must be a non-empty array');
}

for (const tool of catalog.tools) {
  if (!tool.manifestPath) {
    fail(`tool ${tool.key ?? '(unknown)'} missing manifestPath`);
  }

  const manifestPath = path.join(root, 'src', tool.manifestPath.replace(/^\.\//, ''));
  if (!fs.existsSync(manifestPath)) {
    fail(`manifest not found: ${manifestPath}`);
  }
}

console.log('[catalog] ok');
