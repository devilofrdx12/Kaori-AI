#!/usr/bin/env node
/**
 * patch-braces.js
 * ───────────────
 * Mitigates GHSA-vfj7-8cjw-p6xm by injecting a MAX_DEPTH guard into the
 * braces parse() function.  The upstream `braces` package (<=3.0.3) lacks
 * depth guards in its recursive AST walkers, allowing a deeply nested
 * brace pattern to exhaust the call stack and crash the process.
 *
 * This patch adds a configurable MAX_DEPTH constant (default: 100) and
 * throws a RangeError if the nesting depth exceeds it during parsing.
 * It is idempotent — running it multiple times is safe.
 *
 * Run automatically via the "postinstall" npm lifecycle script.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PATCH_MARKER = '/* GHSA-vfj7-8cjw-p6xm depth guard applied */';
const MAX_DEPTH = 100;

function findBracesParseFiles(root) {
  const results = [];
  const nmDir = path.join(root, 'node_modules');

  function scan(dir) {
    const target = path.join(dir, 'node_modules', 'braces', 'lib', 'parse.js');
    if (fs.existsSync(target)) {
      results.push(target);
    }
    // Also check nested node_modules
    const nestedNm = path.join(dir, 'node_modules');
    if (fs.existsSync(nestedNm)) {
      try {
        for (const entry of fs.readdirSync(nestedNm)) {
          if (entry === '.package-lock.json' || entry === '.cache') continue;
          const entryPath = path.join(nestedNm, entry);
          if (entry.startsWith('@')) {
            // Scoped packages
            try {
              for (const scoped of fs.readdirSync(entryPath)) {
                scan(path.join(entryPath, scoped));
              }
            } catch {}
          } else {
            scan(entryPath);
          }
        }
      } catch {}
    }
  }

  // Direct braces in root node_modules
  const directTarget = path.join(nmDir, 'braces', 'lib', 'parse.js');
  if (fs.existsSync(directTarget)) {
    results.push(directTarget);
  }

  // Scan nested installations
  try {
    for (const entry of fs.readdirSync(nmDir)) {
      if (entry === 'braces' || entry === '.package-lock.json' || entry === '.cache') continue;
      const entryPath = path.join(nmDir, entry);
      if (entry.startsWith('@')) {
        try {
          for (const scoped of fs.readdirSync(entryPath)) {
            scan(path.join(entryPath, scoped));
          }
        } catch {}
      } else {
        scan(entryPath);
      }
    }
  } catch {}

  return [...new Set(results)];
}

function patchFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.warn(`  ⚠ Could not read ${filePath}: ${err.message}`);
    return false;
  }

  if (content.includes(PATCH_MARKER)) {
    console.log(`  ✓ Already patched: ${filePath}`);
    return true;
  }

  // Find the line where depth is incremented: "depth++;"
  // and add a guard right after it
  const depthIncrementPattern = /(\s*depth\+\+;)/;
  const match = content.match(depthIncrementPattern);
  if (!match) {
    console.warn(`  ⚠ Could not find depth++ in ${filePath} — skipping`);
    return false;
  }

  const guard = `\n      ${PATCH_MARKER}\n      if (depth > ${MAX_DEPTH}) {\n        throw new RangeError('Brace nesting depth (' + depth + ') exceeds maximum allowed (' + ${MAX_DEPTH} + '). This may be a malicious pattern.');\n      }`;

  const patched = content.replace(depthIncrementPattern, `$1${guard}`);

  try {
    fs.writeFileSync(filePath, patched, 'utf8');
    console.log(`  ✓ Patched: ${filePath}`);
    return true;
  } catch (err) {
    console.warn(`  ⚠ Could not write ${filePath}: ${err.message}`);
    return false;
  }
}

// ── Main ──
const root = path.resolve(__dirname, '..');
console.log('🛡️  Patching braces for GHSA-vfj7-8cjw-p6xm...');

const files = findBracesParseFiles(root);
if (files.length === 0) {
  console.log('  ℹ No braces installations found — nothing to patch.');
  process.exit(0);
}

let patched = 0;
for (const file of files) {
  if (patchFile(file)) patched++;
}

console.log(`  Done: ${patched}/${files.length} braces installations secured.\n`);
