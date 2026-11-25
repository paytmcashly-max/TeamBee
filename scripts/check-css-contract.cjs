'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STYLES_DIR = path.join(ROOT, 'client', 'src', 'styles');
const SRC_DIR = path.join(ROOT, 'client', 'src');

// Third-party classes provided by bundled packages or dynamic animation helpers
const ALLOWLIST = new Set([]);

function walkFiles(dir, extSet) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, extSet));
    } else if (extSet.has(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

function extractCssClasses(cssText) {
  const cleaned = cssText
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '');

  const classes = new Set();
  const stack = [];
  let token = '';

  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    if (ch === '{') {
      const header = token.trim();
      const parentMode = stack[stack.length - 1] || 'root';
      const isAtContainer = /^@(media|supports|layer|container)\b/i.test(header);
      const isKeyframes = /^@(?:-webkit-)?keyframes\b/i.test(header);
      const isRule = !header.startsWith('@') && (parentMode === 'root' || parentMode === 'at');

      if (isRule) {
        for (const match of header.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g)) {
          classes.add(match[1]);
        }
      }

      if (isAtContainer) stack.push('at');
      else if (isKeyframes) stack.push('keyframes');
      else stack.push('decl');
      token = '';
    } else if (ch === '}') {
      stack.pop();
      token = '';
    } else if (ch === ';' && (stack.length === 0 || stack[stack.length - 1] === 'decl' || stack[stack.length - 1] === 'at')) {
      token = '';
    } else {
      token += ch;
    }
  }
  return classes;
}

function extractJsxClassNames(jsxText) {
  const usages = [];
  const staticRe = /className\s*=\s*"([^"]+)"/g;
  for (const m of jsxText.matchAll(staticRe)) {
    for (const cls of m[1].trim().split(/\s+/)) {
      if (cls) usages.push(cls);
    }
  }

  const tmplRe = /className\s*=\s*\{\s*`([^`]+)`\s*\}/g;
  for (const m of jsxText.matchAll(tmplRe)) {
    const stripped = m[1].replace(/\$\{[^}]*\}/g, ' ');
    for (const cls of stripped.trim().split(/\s+/)) {
      if (cls) usages.push(cls);
    }
  }

  // Check string literals inside ternary branches in className={...}
  const exprRe = /className\s*=\s*\{([^}]+)\}/g;
  for (const m of jsxText.matchAll(exprRe)) {
    const cleanedExpr = m[1].replace(/[!=]==?\s*'[^']*'/g, '');
    for (const str of cleanedExpr.matchAll(/'([^']+)'/g)) {
      for (const cls of str[1].trim().split(/\s+/)) {
        if (cls && /^[A-Za-z_-][A-Za-z0-9_-]*$/.test(cls)) usages.push(cls);
      }
    }
  }
  return usages;
}

function main() {
  const cssFiles = walkFiles(STYLES_DIR, new Set(['.css']));
  const definedClasses = new Set();
  for (const file of cssFiles) {
    for (const cls of extractCssClasses(fs.readFileSync(file, 'utf8'))) {
      definedClasses.add(cls);
    }
  }

  const jsxFiles = walkFiles(SRC_DIR, new Set(['.jsx', '.js']));
  const missing = [];
  for (const file of jsxFiles) {
    const text = fs.readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    for (const cls of extractJsxClassNames(text)) {
      if (!definedClasses.has(cls) && !ALLOWLIST.has(cls)) {
        missing.push({ file: rel, cls });
      }
    }
  }

  if (missing.length > 0) {
    console.error(`CSS Contract Violation: ${missing.length} undefined className token(s) found:`);
    const grouped = new Map();
    for (const item of missing) {
      if (!grouped.has(item.file)) grouped.set(item.file, new Set());
      grouped.get(item.file).add(item.cls);
    }
    for (const [file, classes] of grouped.entries()) {
      console.error(`  ${file}: ${Array.from(classes).join(', ')}`);
    }
    process.exit(1);
  }

  console.log(`CSS contract OK: checked ${jsxFiles.length} source files against ${definedClasses.size} CSS classes.`);
}

main();
