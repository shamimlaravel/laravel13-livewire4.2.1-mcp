import { readFileSync } from 'fs';

// Bug patterns to check (simplified from the fix_bugs tool)
const bugPatterns = [
  {
    // CRITICAL: XSS - unescaped user input in blade or component
    severity: 'CRITICAL',
    type: 'XSS',
    pattern: /\{!!\s*[^}]*?\$\s*(?:request\(\)|input\(\)|\$_GET|\$_POST|\$_REQUEST|\$_COOKIE|\$_SERVER)[^}]*?\}\}/gi,
    message: 'Unescaped user input with {!! !!}',
    fix: 'Replace {!! !!} with {{ }} and ensure proper escaping'
  },
  {
    // CRITICAL: SQL injection - DB::raw with variable interpolation
    severity: 'CRITICAL',
    type: 'SQL Injection',
    pattern: /DB::raw\s*\(\s*['"`][^'"`]*\$\s*[^'"`]*['"`]\s*\)/gi,
    message: 'DB::raw() with variable interpolation',
    fix: 'Use parameter binding or Eloquent query builder instead'
  },
  {
    // HIGH: Missing validation before create/update
    severity: 'HIGH',
    type: 'Missing Validation',
    pattern: /(public\s+function\s+save\(\)|public\s+function\s+update\(\))[^}]*?->(?:create|update|save)\(/gi,
    message: 'Database create/update without validation',
    fix: 'Add $this->validate() or #[Validate] attributes before database operations'
  },
  {
    // HIGH: Missing authorization
    severity: 'HIGH',
    type: 'Missing Authorization',
    pattern: /->(?:delete|update)\([^}]*?(?!authorize)/gi,
    message: 'Delete or update operation without authorization check',
    fix: 'Add $this->authorize(\'action\', $model) before operation'
  },
  {
    // MEDIUM: Missing wire:key in loops
    severity: 'MEDIUM',
    type: 'Missing wire:key',
    pattern: /@foreach\s*\([^}]*?\)(?!.*?wire:key)/gi,
    message: 'Loop without wire:key attribute',
    fix: 'Add wire:key=\"{{ $item->id }}\" or similar to loop elements'
  },
  {
    // MEDIUM: Unlocked sensitive properties
    severity: 'MEDIUM',
    type: 'Unlocked Property',
    pattern: /public\s+\$(?:userId|user_id|role|isAdmin|token|password)\s*=/gi,
    message: 'Sensitive property not locked with #[Locked]',
    fix: 'Add #[Locked] attribute to prevent frontend manipulation'
  },
  {
    // LOW: Untyped public properties
    severity: 'LOW',
    type: 'Untyped Property',
    pattern: /public\s+\$\w+\s*=\s*[^;]*;/gi,
    message: 'Untyped public property',
    fix: 'Add type declaration (e.g., public string $name = \'\';)'
  },
  {
    // LOW: Garbage code - TODO comments
    severity: 'LOW',
    type: 'Garbage Code',
    pattern: /\/\/\s*TODO[:\s].*/gi,
    message: 'TODO comment found',
    fix: 'Implement the feature or remove the TODO comment'
  },
  {
    // LOW: Garbage code - lorem ipsum
    severity: 'LOW',
    type: 'Garbage Code',
    pattern: /lorem\s*ipsum/gi,
    message: 'Lorem ipsum placeholder text found',
    fix: 'Replace with real content or remove'
  }
];

// Function to check syntax of a JavaScript file by trying to import it as an ES module
async function checkSyntax(filePath) {
  try {
    // We use dynamic import to check syntax
    // Note: This will execute the module, which might have side effects.
    // For the purpose of a syntax check, it's acceptable because we are in a controlled environment.
    // However, to avoid side effects, we could use a VM module, but for simplicity we do this.
    // We are going to import the module and then immediately discard it.
    // We are in an ES module context, so we can use import().
    // We wrap in a try/catch.
    const module = await import(/* @vite-ignore */ filePath);
    // If we get here, the syntax is valid.
    // We don't actually use the module to avoid side effects, but the import will have executed the module's top-level code.
    // This is a trade-off for a quick syntax check.
    return null; // No syntax error
  } catch (error) {
    return { message: error.message, type: 'syntax_error' };
  }
}

// Function to scan a file for bugs
function scanFileForBugs(filePath, content) {
  const bugs = [];
  for (const pattern of bugPatterns) {
    const matches = content.matchAll(pattern.pattern);
    for (const match of matches) {
      bugs.push({
        file: filePath,
        type: pattern.type,
        severity: pattern.severity,
        message: pattern.message,
        fix: pattern.fix,
        match: match[0]
      });
    }
  }
  return bugs;
}

// Main function
async function main() {
  const basePath = new URL('.', import.meta.url).pathname;
  const filesToScan = [
    'src/index.js',
    'src/lib/memory.js',
    'src/lib/github.js'
  ];

  console.log('=== QUICK BUG AND LSP SCAN ===\n');

  let totalBugs = 0;
  let totalLSPIssues = 0;

  for (const filePath of filesToScan) {
    const fullPath = new URL(filePath, basePath).pathname;
    console.log(`Scanning: ${filePath}`);

    // Check syntax (LSP-like)
    const syntaxError = await checkSyntax(fullPath);
    if (syntaxError) {
      console.log(`  LSP Issue: [Syntax Error] ${syntaxError.message}`);
      totalLSPIssues++;
    } else {
      console.log(`  LSP Issue: None`);
    }

    // Read file content
    let content;
    try {
      content = readFileSync(fullPath, 'utf8');
    } catch (error) {
      console.log(`  Error reading file: ${error.message}`);
      continue;
    }

    // Scan for bugs
    const bugs = scanFileForBugs(fullPath, content);
    if (bugs.length > 0) {
      console.log(`  Bugs Found: ${bugs.length}`);
      // Group by severity
      const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      const severityMap = {};
      severityOrder.forEach(s => { severityMap[s] = []; });
      bugs.forEach(bug => {
        if (severityMap[bug.severity]) {
          severityMap[bug.severity].push(bug);
        }
      });

      severityOrder.forEach(severity => {
        const count = severityMap[severity].length;
        if (count > 0) {
          console.log(`    ${severity}: ${count}`);
          severityMap[severity].forEach((bug, index) => {
            console.log(`      ${index + 1}. [${bug.type}] ${bug.message}`);
            console.log(`         Match: ...${bug.match.substring(0, 50)}${bug.match.length > 50 ? '...' : ''}`);
            console.log(`         Fix: ${bug.fix}`);
          });
        }
      });
      totalBugs += bugs.length;
    } else {
      console.log(`  Bugs Found: None`);
    }
    console.log('');
  }

  console.log('=== SUMMARY ===');
  console.log(`Total Files Scanned: ${filesToScan.length}`);
  console.log(`Total Bugs Found: ${totalBugs}`);
  console.log(`Total LSP Issues: ${totalLSPIssues}`);
}

main().catch(console.error);