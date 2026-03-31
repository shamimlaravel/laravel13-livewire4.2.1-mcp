#!/usr/bin/env node

// Simple test file for deep_scan_bugs functionality

function deepScanBugs(code, fileType = "php", scanMode = "all") {
  const issues = [];
  const patterns = [
    // Tables
    { regex: /@foreach\([^)]+\)/g, check: /wire:key/, msg: "@foreach loop without wire:key", severity: "HIGH", category: "tables" },
    // Validation
    { regex: /->create\(/g, check: /validate/, msg: "create() without validation", severity: "CRITICAL", category: "validation" },
    { regex: /public function save\(/g, check: /validate/, msg: "save() without validation", severity: "HIGH", category: "validation" },
    // Auth
    { regex: /->delete\(\)/g, check: /authorize/, msg: "delete() without authorization", severity: "CRITICAL", category: "auth" },
    // Security
    { regex: /\{!!/g, check: null, msg: "XSS: unescaped output", severity: "CRITICAL", category: "security" },
    { regex: /DB::raw\(/g, check: null, msg: "SQL injection: DB::raw with variable", severity: "CRITICAL", category: "security" },
    { regex: /exec\(/g, check: null, msg: "Command injection: exec()", severity: "CRITICAL", category: "security" },
    // Files
    { regex: /wire:model.*file/g, check: /WithFileUploads/, msg: "File upload without WithFileUploads", severity: "CRITICAL", category: "files" },
    // Pagination
    { regex: /wire:model.*search/g, check: /resetPage/, msg: "Search without pagination reset", severity: "HIGH", category: "pagination" },
    // Models
    { regex: /class\s+\w+\s+extends\s+Model/g, check: /#\[Fillable/, msg: "Model without #[Fillable]", severity: "HIGH", category: "models" },
  ];
  
  patterns.forEach(p => {
    if (scanMode !== "all" && p.category !== scanMode) return;
    
    const matches = code.match(p.regex);
    if (!matches) return;
    
    matches.forEach(() => {
      // For security patterns: if vulnerability pattern found, always report
      if (p.category === "security" && p.check && p.check.test(code)) {
        issues.push({ type: p.msg, severity: p.severity });
        return;
      }
      
      // For other patterns: if check is null OR check doesn't pass, report issue
      if (p.check === null || !p.check.test(code)) {
        issues.push({ type: p.msg, severity: p.severity });
      }
    });
  });
  
  if (issues.length === 0) return "✅ No bugs found!";
  
  const grouped = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] };
  issues.forEach(i => grouped[i.severity].push(i));
  
  let output = `🐛 Found ${issues.length} issue(s):\n`;
  Object.keys(grouped).forEach(sev => {
    if (grouped[sev].length) {
      output += `\n${sev} (${grouped[sev].length}):\n`;
      grouped[sev].forEach((i, idx) => output += `  ${idx + 1}. ${i.type}\n`);
    }
  });
  return output;
}

// ==================== RUN TESTS ====================
console.log("🧪 Running Deep Scan Bugs Tests\n");

let passed = 0;
let failed = 0;

function test(name, code, fileType, scanMode, shouldFind) {
  const result = deepScanBugs(code, fileType, scanMode);
  const hasIssues = !result.includes("No bugs found");
  const success = shouldFind ? hasIssues : !hasIssues;
  
  if (success) {
    console.log(`✅ PASSED: ${name}`);
    passed++;
  } else {
    console.log(`❌ FAILED: ${name}`);
    console.log(`   Expected: ${shouldFind ? "bugs" : "clean"}`);
    console.log(`   Got: ${result.substring(0, 150)}`);
    failed++;
  }
}

// Test 1: Table without wire:key
test("Table without wire:key", 
  "@foreach($items as $item)<tr><td>{{ $item->name }}</td></tr>@endforeach", 
  "blade", "all", true);

// Test 2: create() without validation
test("create() without validation",
  "public function save() { Post::create(['title' => $this->title]); }",
  "php", "validation", true);

// Test 3: XSS vulnerability
test("XSS vulnerability",
  "{!! request()->input('name') !!}",
  "blade", "security", true);

// Test 4: delete() without authorize
test("delete() without authorize",
  "$post->delete();",
  "php", "auth", true);

// Test 5: SQL injection
test("SQL injection",
  'public function query() { DB::raw("SELECT * FROM users WHERE name = \'$name\'"); }',
  "php", "security", true);

// Test 6: Clean code with wire:key
test("Clean code with wire:key",
  "@foreach($items as $item)<tr wire:key=\"{{ $item->id }}\"><td>{{ $item->name }}</td></tr>@endforeach",
  "blade", "all", false);

// Test 7: Model without Fillable
test("Model without #[Fillable]",
  "class Post extends Model {}",
  "model", "models", true);

// Test 8: Command injection
test("Command injection",
  "exec($command);",
  "php", "security", true);

// Test 9: Clean PHP code
test("Clean PHP with validation",
  "$this->validate(); Post::create($validated);",
  "php", "validation", false);

console.log("\n" + "=".repeat(40));
console.log(`📊 Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(40));

process.exit(failed > 0 ? 1 : 0);
