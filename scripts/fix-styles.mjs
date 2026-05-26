/**
 * Fixup script for the folder restructuring:
 * 1. Add `export` to `const styles` in styles.ts
 * 2. Move constants (used in styles) from index.tsx to styles.ts
 * 3. Remove unused StyleSheet import from index.tsx
 * 4. Remove unused Dimensions/Platform/Colors from styles.ts
 */

import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(import.meta.dirname, '../src');

// Files that have constants used in StyleSheet.create
const filesWithStyleConstants = {
  'components/BackButton': {
    constants: ['CHEVRON_HEIGHT', 'CHEVRON_WIDTH', 'LINE_LENGTH', 'LINE_THICKNESS', 'CHEVRON_ANGLE'],
  },
  'components/QrScannerModal': {
    constants: ['SCAN_BOX_SIZE', 'SCAN_BORDER_RADIUS'],
  },
  'components/VideoPiP': {
    constants: ['W', 'H', 'RADIUS'],
  },
};

function processFile(relPath) {
  const dirPath = path.join(SRC, relPath);
  const indexPath = path.join(dirPath, 'index.tsx');
  const stylesPath = path.join(dirPath, 'styles.ts');

  if (!fs.existsSync(indexPath)) return;
  const hasStyles = fs.existsSync(stylesPath);

  // 1. Fix styles.ts — add export keyword
  if (hasStyles) {
    let stylesContent = fs.readFileSync(stylesPath, 'utf-8');
    const fixed = stylesContent.replace(/^const styles = StyleSheet\.create\(/m, 'export const styles = StyleSheet.create(');
    if (fixed !== stylesContent) {
      fs.writeFileSync(stylesPath, fixed, 'utf-8');
      console.log(`  ✅ export added: ${relPath}/styles.ts`);
    }

    // Clean up unused imports in styles.ts
    // Remove Dimensions if not referenced in styles
    stylesContent = fs.readFileSync(stylesPath, 'utf-8');
    const styleBody = stylesContent.match(/StyleSheet\.create\(\{[\s\S]*\}\);/);
    const refs = styleBody ? styleBody[0] : '';

    // Remove unused Dimensions
    if (!refs.includes('Dimensions')) {
      stylesContent = stylesContent.replace(/,\s*Dimensions|Dimensions,\s*/g, '');
      // Fix double commas or empty braces
      stylesContent = stylesContent.replace(/\{\s+}/g, '{}');
    }
    // Remove unused Platform
    if (!refs.includes('Platform')) {
      stylesContent = stylesContent.replace(/,\s*Platform|Platform,\s*/g, '');
      stylesContent = stylesContent.replace(/\{\s+}/g, '{}');
    }
    // Remove unused Colors
    if (!refs.includes('Colors.')) {
      stylesContent = stylesContent.replace(/import.*Colors.*from.*;\n?/, '');
    }
    fs.writeFileSync(stylesPath, stylesContent, 'utf-8');
  }

  // 2. Move constants from index.tsx to styles.ts
  const config = filesWithStyleConstants[relPath];
  if (config) {
    let indexContent = fs.readFileSync(indexPath, 'utf-8');
    const extractedConstants = [];

    for (const constName of config.constants) {
      const regex = new RegExp(`(export\\s+)?const\\s+${constName}\\s*=\\s*[^;]+;\\s*`, 'm');
      const match = indexContent.match(regex);
      if (match) {
        extractedConstants.push(match[0].trim());
        indexContent = indexContent.replace(regex, '');
      }
    }

    fs.writeFileSync(indexPath, indexContent, 'utf-8');

    if (hasStyles && extractedConstants.length > 0) {
      let stylesContent = fs.readFileSync(stylesPath, 'utf-8');
      const firstImportMatch = stylesContent.match(/^(import .+;\n?)/m);
      const insertPoint = firstImportMatch ? firstImportMatch.index + firstImportMatch[0].length : 0;
      stylesContent = stylesContent.slice(0, insertPoint) +
        extractedConstants.join('\n') + '\n\n' +
        stylesContent.slice(insertPoint);
      fs.writeFileSync(stylesPath, stylesContent, 'utf-8');
      console.log(`  ✅ constants moved: ${relPath} (${extractedConstants.join(', ')})`);
    }
  }

  // 3. Remove unused `StyleSheet` from react-native import in index.tsx
  let indexContent = fs.readFileSync(indexPath, 'utf-8');
  const rnImportMatch = indexContent.match(/import\s+\{([^}]+)\}\s+from\s+['"]react-native['"]/);
  if (rnImportMatch) {
    const types = rnImportMatch[1].split(',').map(s => s.trim());
    const filteredTypes = types.filter(t => t !== 'StyleSheet');
    // Only keep if StyleSheet was removed AND the rest still uses other things from RN
    if (filteredTypes.length !== types.length && filteredTypes.length > 0) {
      const newImport = `import { ${filteredTypes.join(', ')} } from 'react-native'`;
      indexContent = indexContent.replace(rnImportMatch[0], newImport);
      fs.writeFileSync(indexPath, indexContent, 'utf-8');
      console.log(`  ✅ StyleSheet import removed: ${relPath}/index.tsx`);
    }
  }

  // 4. Remove unused Colors import from index.tsx (if Colors not used in component code)
  // Check if Colors. is still used after removing styles reference
  if (!indexContent.includes('Colors.')) {
    const colorsImportMatch = indexContent.match(/^import.*Colors.*from.*;\n?/m);
    if (colorsImportMatch) {
      indexContent = indexContent.replace(colorsImportMatch[0], '');
      fs.writeFileSync(indexPath, indexContent, 'utf-8');
      console.log(`  ✅ Colors import removed: ${relPath}/index.tsx`);
    }
  }
}

// Process all directories
function findFolders(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const folders = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const fullPath = path.join(dir, entry.name);
      if (fs.existsSync(path.join(fullPath, 'index.tsx'))) {
        const relPath = path.relative(SRC, fullPath);
        folders.push(relPath);
      }
    }
  }
  return folders;
}

const screenFolders = findFolders(path.join(SRC, 'screens'));
const componentFolders = findFolders(path.join(SRC, 'components'));

console.log('Processing screens...');
for (const folder of screenFolders) {
  processFile(`screens/${folder}`);
}

console.log('\nProcessing components...');
for (const folder of componentFolders) {
  processFile(`components/${folder}`);
}

console.log('\n✅ Fixup complete!');
