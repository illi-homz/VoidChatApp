/**
 * Fix relative imports after restructuring:
 * Files moved from src/screens/X.tsx → src/screens/X/index.tsx
 * Files moved from src/components/X.tsx → src/components/X/index.tsx
 *
 * Rules:
 * - `./X` → `../X` (sibling components)
 * - `../X` → `../../X` (shared modules: theme, types, stores, services, utils, hooks)
 */

import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(import.meta.dirname, '../src');

function fixImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // Find all import statements with relative paths
  content = content.replace(
    /from\s+'\.\/([^']+)'/g,
    (match, p1) => `from '../${p1}'`
  );

  content = content.replace(
    /from\s+'\.\.\/([^']+)'/g,
    (match, p1) => `from '../../${p1}'`
  );

  // Also handle require() calls if any
  content = content.replace(
    /require\('\.\/([^']+)'\)/g,
    (match, p1) => `require('../${p1}')`
  );

  content = content.replace(
    /require\('\.\.\/([^']+)'\)/g,
    (match, p1) => `require('../../${p1}')`
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  }
  return false;
}

function findIndexFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const indexPath = path.join(dir, entry.name, 'index.tsx');
      if (fs.existsSync(indexPath)) {
        files.push(indexPath);
      }
    }
  }
  return files;
}

const screenFiles = findIndexFiles(path.join(SRC, 'screens'));
const componentFiles = findIndexFiles(path.join(SRC, 'components'));

console.log('Fixing screen imports...');
let fixed = 0;
for (const f of screenFiles) {
  if (fixImports(f)) {
    console.log(`  📄 ${path.relative(SRC, f)}`);
    fixed++;
  }
}

console.log('Fixing component imports...');
for (const f of componentFiles) {
  if (fixImports(f)) {
    console.log(`  📄 ${path.relative(SRC, f)}`);
    fixed++;
  }
}

console.log(`\n✅ Fixed ${fixed} files.`);
