/**
 * Script to convert all screens and components from single files to folders
 * with index.tsx + styles.ts
 *
 * Usage: node scripts/convert-to-folders.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(import.meta.dirname, '../src');
const dirs = ['screens', 'components'];

const stylesPattern = /^(export )?const styles(: StyleSheet\.NamedStyles<[^>]+>)? = StyleSheet\.create\(\{/m;

function getStylesEnd(content, startIdx) {
  // Find the matching closing of StyleSheet.create({ ... });
  // We need to track brace depth
  let depth = 0;
  let inString = false;
  let stringChar = null;

  for (let i = startIdx; i < content.length; i++) {
    const ch = content[i];
    const prev = i > 0 ? content[i - 1] : '';

    // Handle string literals (skip content inside strings)
    if ((ch === '"' || ch === "'" || ch === '`') && !inString) {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (inString && ch === stringChar && prev !== '\\') {
      inString = false;
      stringChar = null;
      continue;
    }

    if (!inString) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (depth === 0 && ch === ';') {
        return i + 1; // include the semicolon
      }
    }
  }

  return content.length;
}

function processFile(filePath) {
  const ext = path.extname(filePath);
  if (ext !== '.tsx' && ext !== '.ts') return false;

  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, ext);
  const targetDir = path.join(dir, baseName);

  // Skip if already a folder
  if (fs.existsSync(targetDir) && fs.statSync(targetDir).isDirectory()) {
    console.log(`⏭️  SKIP (already a folder): ${baseName}`);
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(stylesPattern);

  if (!match) {
    // No StyleSheet.create — just move to folder/index.tsx
    console.log(`📁 (no styles) ${baseName}`);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, `index${ext}`), content, 'utf-8');
    fs.unlinkSync(filePath);
    return true;
  }

  // Has StyleSheet.create — split into index.tsx + styles.ts
  console.log(`📂 ${baseName}`);

  const stylesStartIdx = match.index;
  const stylesEndIdx = getStylesEnd(content, stylesStartIdx);

  const componentCode = content.slice(0, stylesStartIdx).trimEnd();
  const stylesCode = content.slice(stylesStartIdx, stylesEndIdx).trim();

  // Check if StyleSheet is already imported
  const hasStyleSheetImport = componentCode.includes("'react-native'") &&
    /StyleSheet/.test(componentCode);

  fs.mkdirSync(targetDir, { recursive: true });

  // Write index.tsx — component code
  const indexContent = componentCode + '\n\n';
  fs.writeFileSync(path.join(targetDir, `index${ext}`), indexContent, 'utf-8');

  // Determine what to import in styles.ts
  const reactNativeImports = content.match(/import\s+\{([^}]+)\}\s+from\s+['"]react-native['"]/);
  const rnTypes = reactNativeImports
    ? reactNativeImports[1].split(',').map(s => s.trim())
    : [];
  // Only keep what's needed for styles: StyleSheet, Platform, Dimensions
  const styleTypes = rnTypes.filter(t =>
    t === 'StyleSheet' || t === 'Platform' || t === 'Dimensions'
  );

  // Check for other imports needed in styles.ts
  const localImports = [];
  const importRegex = /^import\s+.+\s+from\s+['"].+['"];?$/gm;
  let impMatch;
  while ((impMatch = importRegex.exec(componentCode)) !== null) {
    const imp = impMatch[0];
    if (imp.includes('../theme') || imp.includes('../theme/')) {
      localImports.push(imp);
    }
  }

  // Build styles.ts
  const stylesLines = [];
  if (styleTypes.length > 0) {
    stylesLines.push(`import { ${styleTypes.join(', ')} } from 'react-native';`);
  }
  for (const li of [...new Set(localImports)]) {
    stylesLines.push(li);
  }
  stylesLines.push('');
  stylesLines.push(stylesCode);
  stylesLines.push('');

  fs.writeFileSync(path.join(targetDir, 'styles.ts'), stylesLines.join('\n'), 'utf-8');

  // Add import { styles } from './styles' to index.tsx if not already present
  // We write it right after the last import statement or at the top
  const lastImportMatch = componentCode.match(/^import.*?;$/gm);
  if (lastImportMatch) {
    const lastImport = lastImportMatch[lastImportMatch.length - 1];
    const lastImportIdx = componentCode.lastIndexOf(lastImport);
    const before = componentCode.slice(0, lastImportIdx + lastImport.length);
    const after = componentCode.slice(lastImportIdx + lastImport.length);
    const updatedIndex = before + '\n' + `import { styles } from './styles';` + after + '\n';
    fs.writeFileSync(path.join(targetDir, `index${ext}`), updatedIndex, 'utf-8');
  } else {
    // No imports — prepend
    const updatedIndex = `import { styles } from './styles';\n` + componentCode + '\n';
    fs.writeFileSync(path.join(targetDir, `index${ext}`), updatedIndex, 'utf-8');
  }

  // Delete original file
  fs.unlinkSync(filePath);
  return true;
}

let total = 0;
for (const dirName of dirs) {
  const dirPath = path.join(SRC, dirName);
  if (!fs.existsSync(dirPath)) continue;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = entries.filter(e => e.isFile() && (e.name.endsWith('.tsx') || e.name.endsWith('.ts')));

  for (const file of files) {
    const filePath = path.join(dirPath, file.name);
    if (processFile(filePath)) total++;
  }
}

console.log(`\n✅ Done! Converted ${total} files.`);
