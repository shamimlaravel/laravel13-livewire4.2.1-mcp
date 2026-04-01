#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execSync } from "child_process";

// Import helper functions for clean, DRY code generation
import {
  toPascalCase,
  toCamelCase,
  toSnakeCase,
  toTitleCase,
  extractModelInfo,
  extractNamespace,
  extractClassName,
  generateValidationRules,
  generateValidateAttribute,
  generateAuthChecks,
  generateProperty,
  generateProperties,
  generateFillableArray,
  generateUseStatements,
  formatPhpCode,
  sanitizeInput,
  validateField,
  parseFields,
  DEFAULT_LAYOUTS
} from './lib/helpers.js';

// Import reusable templates
import {
  livewireComponentTemplate,
  eloquentModelTemplate,
  bladeComponentTemplate,
  pestTestWithDescribeTemplate,
  migrationTemplate,
  policyTemplate,
  observerTemplate,
  serviceClassTemplate,
  enumTemplate,
  apiResourceTemplate,
  jobTemplate,
  mailTemplate,
  routesTemplate
} from './lib/templates.js';

// Import memory and GitHub utilities
import {
  initMemory,
  getProjectState,
  saveProjectState,
  calculateProgress,
  getPlanTemplates,
  saveEndpoint,
  saveMemory,
  getAllMemories,
  saveVersion,
  getVersions,
  restoreVersion,
  reportBug,
  markBugFixed,
  getOpenBugs,
  setInterrupted,
  checkInterrupted
} from "./lib/memory.js";

import {
  gitCommit,
  gitPush,
  gitPull,
  createVersionTag,
  gitStatus,
  fullGitWorkflow
} from './lib/github.js';

const server = new McpServer({
  name: "laravel13-livewire4.2.1-mcp",
  version: "3.1.0",
});

// ==================== CONSTANTS ====================
const VALID_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

// ==================== LEGACY HELPER FUNCTIONS (deprecated, use helpers.js) ====================
/** @deprecated Use safeType from helpers.js */
function safeType(type) {
  const map = { string: "string", int: "int", float: "float", bool: "bool", array: "array", file: "\\Livewire\\Features\\SupportFileUploads\\TemporaryUploadedFile", model: "mixed" };
  return map[type] || "string";
}
/** @deprecated Use getDefaultForType from helpers.js */
function defaultVal(type) {
  const map = { string: "''", int: "0", float: "0.0", bool: "false", array: "[]", file: "null", model: "null" };
  return map[type] || "''";
}

// ==================== TOOL: Generate Livewire Component ====================
server.tool(
  "generate_livewire_component",
  "Generate a production-ready Livewire v4.2+ component with Laravel 13 attributes, validation, security, DRY patterns.",
  {
    name: z.string().describe("Component name e.g. 'post.create'"),
    type: z.enum(["sfc", "mfc", "class"]).default("sfc"),
    fields: z.array(z.object({
      name: z.string(),
      type: z.string().default("string"),
      rules: z.string().optional(),
      locked: z.boolean().default(false),
      defer: z.boolean().default(false),
      url: z.boolean().default(false),
    })).default([]),
    hasForm: z.boolean().default(false),
    hasPagination: z.boolean().default(false),
    hasSearch: z.boolean().default(false),
    hasDelete: z.boolean().default(false),
    hasEdit: z.boolean().default(false),
    layout: z.string().default("layouts.app"),
    title: z.string().optional(),
    modelClass: z.string().optional(),
    authorize: z.boolean().default(true),
  },
  async ({ name, type, fields, hasForm, hasPagination, hasSearch, hasDelete, hasEdit, layout, title, modelClass, authorize }) => {
    // Use helper functions for DRY code
    const model = modelClass ? extractModelInfo(modelClass) : { name: 'Model', variable: 'model' };
    const namespace = extractNamespace(name);
    const className = extractClassName(name);
    const shortName = name.split('.').pop();
    
    // Generate auth checks using helper
    const auth = generateAuthChecks({ authorize, modelName: model.name, modelVar: model.variable });
    
    // Generate properties using helper
    const properties = fields.map(f => {
        const attrs = [];
        if (f.locked) attrs.push('    #[Locked]');
        if (f.defer) attrs.push('    #[Defer]');
        if (f.url) attrs.push('    #[Url]');
        if (f.rules) attrs.push(`    #[Validate('${f.rules}')]`);
        attrs.push(`    ${generateProperty(f)}`);
        return attrs.join('\n');
    }).join('\n');
    
    // Generate validation rules using helper
    const rules = generateValidationRules(fields);
    
    // Generate fillable mapping
    const fillableFields = fields.map(f => `'${f.name}' => $this->${f.name},`).join('\n            ');
    
    // Build imports array
    const imports = ['Livewire\\Component'];
    if (hasPagination) imports.push('Livewire\\WithPagination');
    if (modelClass) imports.push(modelClass);
    
    // Build attribute imports
    const attrImports = ['Layout'];
    if (title) attrImports.push('Title');
    if (hasEdit) attrImports.push('Computed');
    
    const phpCode = `<?php

use Livewire\\Component;
use Livewire\\Attributes\\{${attrImports.join(', ')}};
${imports.slice(1).map(i => `use ${i};`).join('\n')}

#[Layout('${layout}')]
${title ? `#[Title('${title}')]` : ''}
new class extends Component {
    ${hasPagination ? 'use WithPagination;\n' : ''}
${properties}

    /**
     * Lifecycle hook - Props are reactive during boot (Livewire 4.2+)
     * Use this to react to prop changes early in the component lifecycle
     */
    public function boot(): void
    {
        // Props are now reactive during boot hooks (Livewire 4.2.1)
        // Initialize component state based on props here
    }

${hasSearch ? `public string $search = '';

    public function updatingSearch(): void
    {
        $this->resetPage();
    }` : ''}

${rules ? `public function rules(): array
    {
        return [
${rules}
        ];
    }` : ''}

${hasForm ? `public function save(): void
    {
        $validated = $this->validate();
        ${auth.create}
        ${model.name}::create([
            ${fillableFields}
        ]);
        
        $this->dispatch('${shortName}-saved');
    }` : ''}

${hasEdit ? `public function edit(int $id): void
    {
        $${model.variable} = ${model.name}::findOrFail($id);
        ${auth.update}
${fields.map(f => `        $this->${f.name} = $${model.variable}->${f.name};`).join('\n')}
    }` : ''}

${hasDelete ? `public function delete(int $id): void
    {
        $${model.variable} = ${model.name}::findOrFail($id);
        ${auth.delete}
        $${model.variable}->delete();
        $this->dispatch('${shortName}-deleted');
    }` : ''}
};
?>`;

    const bladeCode = `<div class="p-6">
    ${hasSearch ? `<div class="mb-4">
        <input type="text" wire:model.live.debounce.300ms="search" 
               placeholder="Search..."
               class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500">
    </div>` : ''}
    
    ${hasForm ? `<form wire:submit="save" class="space-y-4">
${fields.map(f => `        <div>
            <label for="${f.name}" class="block text-sm font-medium text-gray-700">
                ${f.name.charAt(0).toUpperCase() + f.name.slice(1).replace(/_/g, ' ')}
            </label>
            <input type="${f.type === 'email' ? 'email' : 'text'}" 
                   wire:model="${f.name}" 
                   id="${f.name}" 
                   class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
            @error('${f.name}')<span class="text-red-500 text-sm">{{ $message }}</span>@enderror
        </div>`).join('\n')}
        
        <div class="flex justify-end gap-3">
            <button type="button" 
                    @click="$errors.clear()"
                    class="px-4 py-2 text-gray-600 hover:text-gray-800">
                Clear
            </button>
            <button type="submit" 
                    class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    wire:loading.attr="disabled"
                    wire:target="save">
                <span wire:loading.remove wire:target="save">Save</span>
                <span wire:loading wire:target="save">Saving...</span>
            </button>
        </div>
    </form>` : ''}
    
    ${hasEdit ? `<div class="flex gap-2 mt-4">
        <button wire:click="edit(1)" class="px-3 py-1 text-indigo-600 hover:underline">Edit</button>
    </div>` : ''}
    
    ${hasDelete ? `<button wire:click="delete(1)" 
                    wire:confirm="Are you sure you want to delete this item?"
                    class="px-3 py-1 text-red-600 hover:underline">
        Delete
    </button>` : ''}
</div>`;

    return { content: [{ type: "text", text: `${phpCode}\n\n${bladeCode}` }] };
  }
);

// Initialize memory on server start
initMemory();

// ==================== TOOL: Generate Layout ====================
server.tool(
  "generate_layout",
  "Generate a Laravel 13 Blade layout file (base, app, guest, admin, tenant, auth, dashboard, error).",
  { layoutType: z.enum(["base", "app", "guest", "admin", "tenant", "auth", "dashboard", "error403", "error404", "error500"]), name: z.string().default("app") },
  async ({ layoutType }) => {
    const layouts = {
      base: `<!DOCTYPE html>\n<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">\n<head>\n    <meta charset="utf-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1">\n    <meta name="csrf-token" content="{{ csrf_token() }}">\n    <title>{{ $title ?? config('app.name', 'Laravel') }}</title>\n    @livewireStyles\n    @vite(['resources/css/app.css', 'resources/js/app.js'])\n</head>\n<body class="font-sans antialiased bg-gray-50 text-gray-900">\n    {{ $slot }}\n    @livewireScripts\n</body>\n</html>`,
      app: `<x-layouts.base :$title>\n<div class="min-h-screen bg-gray-100">\n    @include('layouts.partials.navigation')\n    @if(isset($header))<header class="bg-white shadow"><div class="max-w-7xl mx-auto py-6 px-4">{{ $header }}</div></header>@endif\n    <main><div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{{ $slot }}</div></main>\n</div>\n</x-layouts.base>`,
      guest: `<x-layouts.base :$title>\n<div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">\n    <div class="w-full max-w-md space-y-8">{{ $slot }}</div>\n</div>\n</x-layouts.base>`,
      auth: `<x-layouts.base :$title>\n<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">\n    <div class="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">\n        <h2 class="text-3xl font-extrabold text-center">{{ $title ?? 'Sign In' }}</h2>\n        {{ $slot }}\n    </div>\n</div>\n</x-layouts.base>`,
      admin: `<x-layouts.base :$title>\n<div class="flex h-screen bg-gray-100">\n    @include('layouts.admin.sidebar')\n    <div class="flex flex-col flex-1 overflow-hidden">\n        @include('layouts.admin.header')\n        <main class="flex-1 overflow-y-auto p-6">{{ $slot }}</main>\n        @include('layouts.admin.footer')\n    </div>\n</div>\n</x-layouts.base>`,
      tenant: `<x-layouts.base :$title>\n@auth\n<div class="flex h-screen bg-gray-50">\n    @include('layouts.tenant.sidebar')\n    <div class="flex flex-col flex-1 overflow-hidden">\n        @include('layouts.tenant.topbar')\n        <main class="flex-1 overflow-y-auto p-4 md:p-6">{{ $slot }}</main>\n    </div>\n</div>\n@else\n    {{ $slot }}\n@endauth\n</x-layouts.base>`,
      dashboard: `<x-layouts.base :$title>\n<div class="min-h-screen bg-gray-100">\n    @include('layouts.partials.navigation')\n    <main class="py-8">\n        <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">\n            @if(session('success'))<div class="mb-4 p-4 bg-green-100 text-green-700 rounded-lg">{{ session('success') }}</div>@endif\n            {{ $slot }}\n        </div>\n    </main>\n</div>\n</x-layouts.base>`,
      error403: `<x-layouts.base title="403 - Forbidden">\n<div class="min-h-screen flex items-center justify-center bg-gray-50">\n    <div class="text-center">\n        <h1 class="text-6xl font-bold">403</h1>\n        <p class="mt-4 text-xl text-gray-600">Forbidden</p>\n        <a href="/" class="mt-6 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg">Go Home</a>\n    </div>\n</div>\n</x-layouts.base>`,
      error404: `<x-layouts.base title="404 - Not Found">\n<div class="min-h-screen flex items-center justify-center bg-gray-50">\n    <div class="text-center">\n        <h1 class="text-6xl font-bold">404</h1>\n        <p class="mt-4 text-xl text-gray-600">Page Not Found</p>\n        <a href="/" class="mt-6 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg">Go Home</a>\n    </div>\n</div>\n</x-layouts.base>`,
      error500: `<x-layouts.base title="500 - Server Error">\n<div class="min-h-screen flex items-center justify-center bg-gray-50">\n    <div class="text-center">\n        <h1 class="text-6xl font-bold">500</h1>\n        <p class="mt-4 text-xl text-gray-600">Server Error</p>\n        <a href="/" class="mt-6 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg">Go Home</a>\n    </div>\n</div>\n</x-layouts.base>`,
    };
    return { content: [{ type: "text", text: layouts[layoutType] || layouts.base }] };
  }
);

// ==================== TOOL: Generate Eloquent Model ====================
server.tool(
  "generate_eloquent_model",
  "Generate a Laravel 13.2 Eloquent model with PHP 8.3 attributes, relationships, scopes, casts, observers, and new v13.2 features.",
  {
    name: z.string().describe("Model name e.g. 'Post'"),
    table: z.string().optional(),
    fields: z.array(z.object({ name: z.string(), type: z.string().optional(), fillable: z.boolean().default(true), hidden: z.boolean().default(false), cast: z.string().optional() })).default([]),
    relationships: z.array(z.object({ name: z.string(), type: z.enum(["belongsTo", "hasMany", "belongsToMany", "hasOne", "morphMany", "morphTo"]), related: z.string() })).default([]),
    softDeletes: z.boolean().default(false),
    timestamps: z.boolean().default(true),
    dateFormat: z.string().optional().describe("Custom date format e.g. 'U' for Unix timestamp"),
    withoutTimestamps: z.boolean().default(false).describe("Disable timestamps (Laravel 13.2 #[WithoutTimestamps])"),
    scopedBy: z.string().optional().describe("Global scope column e.g. 'tenant_id' (Laravel 13.2 #[ScopedBy])"),
    scopes: z.array(z.object({ name: z.string(), condition: z.string().optional() })).default([]),
    casts: z.array(z.object({ field: z.string(), type: z.string() })).default([]),
    policy: z.string().optional(),
    observer: z.string().optional(),
  },
  async ({ name, table, fields, relationships, softDeletes, timestamps, dateFormat, withoutTimestamps, scopedBy, scopes, casts, policy, observer }) => {
    const tableName = table || (name.toLowerCase() + "s");
    const fillable = fields.filter(f => f.fillable !== false).map(f => `'${f.name}'`);
    const hidden = fields.filter(f => f.hidden).map(f => `'${f.name}'`);
    const castFields = casts.map(c => `        '${c.field}' => '${c.type}',`).join("\n");
    const rels = relationships.map(r => {
      const cap = r.related.split("\\").pop();
      const returnType = r.type === "belongsTo" ? "BelongsTo" : r.type === "hasMany" ? "HasMany" : r.type === "belongsToMany" ? "BelongsToMany" : r.type === "hasOne" ? "HasOne" : r.type === "morphMany" ? "MorphMany" : "MorphTo";
      return `    public function ${r.name}(): ${returnType}\n    {\n        return $this->${r.type}(${cap}::class);\n    }`;
    }).join("\n\n");
    const scps = scopes.map(s => `    #[Scope]\n    public function ${s.name}(Builder $query): void\n    {\n        $query->${s.condition || `where('${s.name}', true)`};\n    }`).join("\n\n");
    
    // Laravel 13.2 attributes
    const l13Attributes = [];
    if (dateFormat) l13Attributes.push(`#[DateFormat('${dateFormat}')]`);
    if (withoutTimestamps || !timestamps) l13Attributes.push('#[WithoutTimestamps]');
    if (scopedBy) l13Attributes.push(`#[ScopedBy('${scopedBy}')]`);
    
    const code = `<?php\n\nnamespace App\\Models;\n\nuse Illuminate\\Database\\Eloquent\\Model;\nuse Illuminate\\Database\\Eloquent\\Attributes\\{Table, Fillable, Hidden, Scope, UsePolicy, ObservedBy, DateFormat, WithoutTimestamps, ScopedBy};\nuse Illuminate\\Database\\Eloquent\\Builder;\n${softDeletes ? "use Illuminate\\Database\\Eloquent\\SoftDeletes;" : ""}\n${policy ? `use App\\Policies\\${policy};` : ""}\n${observer ? `use App\\Observers\\${observer};` : ""}\n\n#[Table('${tableName}')]\n${fillable.length ? `#[Fillable([${fillable.join(", ")}])]` : ""}\n${hidden.length ? `#[Hidden([${hidden.join(", ")}])]` : ""}\n${policy ? `#[UsePolicy(${policy}::class)]` : ""}\n${observer ? `#[ObservedBy(${observer}::class)]` : ""}\n${l13Attributes.length ? l13Attributes.join("\n") + "\n" : ""}class ${name} extends Model\n{\n${softDeletes ? "    use SoftDeletes;\n" : ""}    protected function casts(): array\n    {\n        return [\n${castFields}        ];\n    }\n\n${scps}\n\n${rels}\n}`;
    return { content: [{ type: "text", text: code }] };
  }
);

// ==================== TOOL: Generate Routes ====================
server.tool(
  "generate_routes",
  "Generate Laravel 13 routes with Livewire Route::livewire() syntax, middleware, and groups.",
  {
    routes: z.array(z.object({ path: z.string(), component: z.string(), middleware: z.array(z.string()).optional(), name: z.string().optional() })),
    groups: z.array(z.object({ prefix: z.string().optional(), middleware: z.array(z.string()).optional(), routes: z.array(z.object({ path: z.string(), component: z.string(), name: z.string().optional() })) })).default([]),
  },
  async ({ routes, groups }) => {
    let lines = [];
    routes?.forEach(r => {
      const mw = r.middleware?.length ? `->middleware([${r.middleware.map(m => `'${m}'`).join(", ")}])` : "";
      const nm = r.name ? `->name('${r.name}')` : "";
      lines.push(`Route::livewire('${r.path}', '${r.component}')${mw}${nm};`);
    });
    groups?.forEach(g => {
      const mw = g.middleware?.length ? `['${g.middleware.join("', '")}']` : "[]";
      lines.push(`\nRoute::middleware(${mw})${g.prefix ? `->prefix('${g.prefix}')` : ""}->group(function () {`);
      g.routes?.forEach(r => {
        const nm = r.name ? `->name('${r.name}')` : "";
        lines.push(`    Route::livewire('${r.path}', '${r.component}')${nm};`);
      });
      lines.push("});");
    });
    return { content: [{ type: "text", text: `<?php\n\nuse Illuminate\\Support\\Facades\\Route;\n\n${lines.join("\n")}\n` }] };
  }
);

// ==================== TOOL: Generate Test ====================
server.tool(
  "generate_test",
  "Generate comprehensive Pest tests for Livewire components with auth, validation, and database assertions.",
  {
    componentName: z.string().describe("Component name e.g. 'Post.Create'"),
    modelClass: z.string().optional(),
    fields: z.array(z.object({ name: z.string(), testValue: z.string(), invalidValue: z.string().optional() })).default([]),
    hasAuth: z.boolean().default(true),
    hasValidation: z.boolean().default(true),
    hasDelete: z.boolean().default(false),
    hasEdit: z.boolean().default(false),
  },
  async ({ componentName, modelClass, fields, hasAuth, hasValidation, hasDelete, hasEdit }) => {
    const cls = toPascalCase(componentName);
    const modelInfo = extractModelInfo(modelClass || 'App\\Models\\Model');
    const { name: modelName, variable: modelVar } = modelInfo;
    const setFields = fields.map(f => `->set('${f.name}', '${f.testValue}')`).join("\n        ");
    const invalidTests = fields.map(f => `\nit('validates ${f.name} is required', function () {\n    $user = User::factory()->create();\n    Livewire::actingAs($user)->test(${cls}::class)\n        ->set('${f.name}', '${f.invalidValue || ""}')\n        ->call('save')\n        ->assertHasErrors(['${f.name}']);\n});`).join("");
    const code = `<?php\n\nuse App\\Livewire\\${cls};\nuse Livewire\\Livewire;\nuse App\\Models\\User;\n${modelClass ? `use ${modelClass};` : ""}\n\n${hasAuth ? `it('requires authentication', function () {\n    Livewire::test(${cls}::class)->call('save')->assertForbidden();\n});\n\n` : ""}it('can save successfully', function () {\n    $user = User::factory()->create();\n    Livewire::actingAs($user)->test(${cls}::class)\n        ${setFields}\n        ->call('save')\n        ->assertHasNoErrors();\n    $this->assertDatabaseHas('${modelName.toLowerCase()}s', {\n        ${fields.map(f => `'${f.name}' => '${f.testValue}'`).join(",\n        ")}\n    });\n});${hasValidation ? invalidTests : ""}${hasEdit ? `\nit('can edit existing ${modelVar}', function () {\n    $user = User::factory()->create();\n    $${modelVar} = ${modelName}::factory()->create();\n    Livewire::actingAs($user)->test(${cls}::class)->call('edit', $${modelVar}->id)->assertSet('${fields[0]?.name || "title"}', $${modelVar}->${fields[0]?.name || "title"});\n});` : ""}${hasDelete ? `\nit('can delete ${modelVar}', function () {\n    $user = User::factory()->create();\n    $${modelVar} = ${modelName}::factory()->create();\n    Livewire::actingAs($user)->test(${cls}::class)->call('delete', $${modelVar}->id)->assertHasNoErrors();\n    $this->assertModelMissing($${modelVar});\n});` : ""}`;
    return { content: [{ type: "text", text: code }] };
  }
);

// ==================== TOOL: Security Audit ====================
server.tool(
  "security_audit",
  "Audit Livewire 4.2.1/Laravel 13.2 code for security vulnerabilities including XSS, SQL injection, mass assignment, missing auth, CSRF, rate limiting, and Livewire-specific issues.",
  { code: z.string().describe("Code to audit"), fileType: z.enum(["php", "blade", "model", "component", "routes"]) },
  async ({ code, fileType }) => {
    const issues = [];
    // XSS
    if (code.includes("{!!") && (code.includes("request()") || code.includes("input(") || code.includes("$request"))) issues.push({ severity: "CRITICAL", type: "XSS", msg: "Unescaped output with user input", fix: "Use {{ }} instead of {!! !!} with user data" });
    // SQL Injection
    if (code.includes("DB::raw(") && code.includes("$")) issues.push({ severity: "CRITICAL", type: "SQL Injection", msg: "DB::raw() with variable interpolation", fix: "Use parameter binding or Eloquent query builder" });
    // Mass Assignment
    if (code.includes("$guarded = []") || code.includes("#[Unguarded]")) issues.push({ severity: "HIGH", type: "Mass Assignment", msg: "Mass assignment protection disabled", fix: "Use #[Fillable([...])] with explicit field whitelist" });
    // Missing Validation
    if ((fileType === "component" || fileType === "php") && code.includes("->create(") && !code.includes("validate") && !code.includes("Validate")) issues.push({ severity: "HIGH", type: "Missing Validation", msg: "Database create() without validation", fix: "Add $this->validate() or #[Validate] attributes before create()" });
    // Missing Authorization
    if ((fileType === "component" || fileType === "php") && code.includes("->delete()") && !code.includes("authorize")) issues.push({ severity: "HIGH", type: "Missing Authorization", msg: "Delete operation without authorization check", fix: "Add $this->authorize('delete', $model) before delete()" });
    if ((fileType === "component" || fileType === "php") && code.includes("->update(") && !code.includes("authorize")) issues.push({ severity: "HIGH", type: "Missing Authorization", msg: "Update operation without authorization check", fix: "Add $this->authorize('update', $model) before update()" });
    // Missing wire:key
    if (fileType === "blade" && code.includes("@foreach") && !code.includes("wire:key")) issues.push({ severity: "MEDIUM", type: "Missing wire:key", msg: "Loop without wire:key attribute", fix: "Add wire:key=\"{{ $item->id }}\" to loop elements" });
    // Unlocked Sensitive Property
    if (code.includes("public $") && !code.includes("#[Locked]") && (code.includes("userId") || code.includes("user_id") || code.includes("role") || code.includes("isAdmin"))) issues.push({ severity: "MEDIUM", type: "Unlocked Sensitive Property", msg: "Sensitive property not locked", fix: "Add #[Locked] attribute to prevent frontend manipulation" });
    // File Upload Security
    if (code.includes("store(") && !code.includes("mimes:") && !code.includes("image:")) issues.push({ severity: "HIGH", type: "File Upload Security", msg: "File upload without MIME/type validation", fix: "Add mimes:jpg,png,pdf|max:2048 validation rules" });
    // Configuration
    if (code.includes("env(") && !code.includes("config(")) issues.push({ severity: "LOW", type: "Configuration", msg: "Using env() directly instead of config()", fix: "Use config('app.key') instead of env('APP_KEY')" });
    // SQL Injection in queries
    if (code.includes("where(") && code.includes("$_") && !code.includes("request()->validate")) issues.push({ severity: "HIGH", type: "SQL Injection", msg: "Direct user input in query", fix: "Validate input before using in queries" });
    // Command Injection
    if (code.includes("exec(") || code.includes("shell_exec(") || code.includes("system(") || code.includes("passthru(")) issues.push({ severity: "CRITICAL", type: "Command Injection", msg: "Shell execution detected", fix: "Avoid shell execution; use Laravel's process helper with escapeshellarg()" });
    
    // Livewire 4.2.1 Security Hardening
    // Lifecycle methods should not be public callable
    if (fileType === "component" && (code.includes("public function boot(") || code.includes("public function mount("))) {
      issues.push({ severity: "HIGH", type: "Livewire Security", msg: "Lifecycle method (boot/mount) is public - can be invoked from frontend in older versions", fix: "Use protected/private for boot() and mount() methods in Livewire 4.2.1" });
    }
    // Missing #[Validate] attribute
    if (fileType === "component" && code.includes("public $") && !code.includes("#[Validate]") && code.includes("wire:model")) {
      issues.push({ severity: "MEDIUM", type: "Livewire Security", msg: "Properties bound with wire:model should have #[Validate] attribute", fix: "Add #[Validate('rules')] attribute to properties for Livewire 4.2.1 validation" });
    }
    // CSRF token missing in forms
    if (fileType === "blade" && code.includes("<form") && !code.includes("@csrf") && !code.includes("csrf")) {
      issues.push({ severity: "HIGH", type: "CSRF", msg: "Form without CSRF protection", fix: "Add @csrf directive inside all forms" });
    }
    // Unescaped output in Livewire
    if (fileType === "component" && code.includes("{!!") && code.includes("$this->")) {
      issues.push({ severity: "CRITICAL", type: "XSS", msg: "Unescaped component property output", fix: "Use {{ $this->property }} instead of {!! !!} for component properties" });
    }
    // Rate limiting on sensitive endpoints
    if (fileType === "routes" && code.includes("->delete(") && !code.includes("throttle") && !code.includes("rateLimit")) {
      issues.push({ severity: "MEDIUM", type: "Rate Limiting", msg: "Delete endpoint without rate limiting", fix: "Add ->middleware('throttle:60,1') to sensitive endpoints" });
    }
    
    const result = issues.length === 0 ? "✅ No security issues found. Code follows Laravel 13.2 and Livewire 4.2.1 security best practices." : `Found ${issues.length} issue(s):\n\n` + issues.map(i => `🔴 [${i.severity}] ${i.type}\n   ${i.msg}\n   Fix: ${i.fix}`).join("\n\n");
    return { content: [{ type: "text", text: result }] };
  }
);

// ==================== TOOL: Convert HTML to Livewire ====================
server.tool(
  "convert_html_to_livewire",
  "Convert static HTML to a Livewire v4.2+ component with proper wire directives, validation, and security.",
  {
    html: z.string().describe("HTML code to convert"),
    componentName: z.string().optional(),
    hasForm: z.boolean().default(false),
    hasModal: z.boolean().default(false),
    hasList: z.boolean().default(false),
    layout: z.string().default("layouts.app"),
  },
  async ({ html, componentName, hasForm, hasModal, hasList, layout }) => {
    let blade = html;
    if (hasForm) {
      blade = blade.replace(/<input\s+type="([^"]+)"\s+name="([^"]+)"([^>]*)>/g, '<input type="$1" wire:model="$2"$3>\n            @error(\'$2\')<span class="text-red-500 text-xs">{{ $message }}</span>@enderror');
      blade = blade.replace(/<textarea\s+name="([^"]+)"([^>]*)>/g, '<textarea wire:model="$1"$2></textarea>\n            @error(\'$1\')<span class="text-red-500 text-xs">{{ $message }}</span>@enderror');
      blade = blade.replace(/<form\s+action="[^"]*"\s+method="POST">/g, '<form wire:submit="save">\n                @csrf');
    }
    if (hasModal) blade = blade.replace(/class="([^"]*)hidden([^"]*)fixed/g, 'wire:show="showModal" class="$1$2fixed');
    if (hasList) blade = blade.replace(/<li([^>]*)>/g, '<li$1 wire:key="{{ $item->id }}">');
    blade = blade.replace(/onclick="(\w+)\(([^)]*)\)"/g, 'wire:click="$1($2)"');
    const fields = [...html.matchAll(/name="([^"]+)"/g)].map(m => m[1]);
    const uniqueFields = [...new Set(fields)];
    const props = uniqueFields.map(f => `    public string $${f} = '';`).join("\n");
    const rules = uniqueFields.map(f => `            '${f}' => 'required',`).join("\n");
    const code = `<?php\n\nuse Livewire\\Component;\nuse Livewire\\Attributes\\{Layout, Title};\n\n#[Layout('${layout}')]\nnew class extends Component {\n${props}\n\n    protected function rules(): array\n    {\n        return [\n${rules}        ];\n    }\n\n${hasForm ? `    public function save(): void\n    {\n        $validated = $this->validate();\n        session()->flash('success', 'Form submitted successfully.');\n        $this->reset();\n    }` : ""}${hasModal ? `    public bool $showModal = false;` : ""}\n};\n?>\n\n${blade}`;
    return { content: [{ type: "text", text: code }] };
  }
);

// ==================== TOOL: Generate Project Structure ====================
server.tool(
  "generate_project_structure",
  "Generate complete enterprise/SaaS/API Laravel 13 + Livewire project structure with all files, configs, and routes.",
  {
    projectName: z.string(),
    type: z.enum(["enterprise", "saas", "api"]).default("enterprise"),
    features: z.array(z.string()).default(["auth", "admin"]),
  },
  async ({ projectName, type, features }) => {
    const tenantSection = type === "saas" ? `│   ├── tenant/       base, sidebar, topbar, billing\n│   └── landing/        hero, features, pricing, faq` : `│   ├── partials/     navigation, flash-messages, footer\n│   └── components/     alert, modal, card, badge, empty-state`;
    const tenantRoutes = type === "saas" ? `├── tenant.php      (tenant routes with tenant middleware)\n├── landing.php     (public landing pages)` : `├── admin.php       (admin routes with middleware)`;
    const structure = `# ${projectName} (${type.toUpperCase()}) Project Structure\n\n## Directory Tree\n\`\`\`\napp/\n├── Enums/\n│   ├── PostStatus.php        (Draft, Published, Archived)\n│   ├── UserRole.php          (User, Editor, Admin, SuperAdmin)\n│   └── BillingPlan.php       (Free, Pro, Enterprise)\n├── Http/\n│   ├── Middleware/\n│   │   ├── AdminMiddleware.php\n│   │   ├── TenantMiddleware.php\n│   │   └── EnsureEmailIsVerified.php\n│   └── Requests/\n│       ├── StorePostRequest.php\n│       └── UpdateUserRequest.php\n├── Livewire/                 (class-based components)\n│   ├── Common/\n│   │   ├── DataTable.php\n│   │   ├── SearchBar.php\n│   │   └── Notification.php\n│   ├── Auth/\n│   │   ├── Login.php\n│   │   ├── Register.php\n│   │   └── ForgotPassword.php\n│   ├── Dashboard/\n│   │   ├── StatsCard.php\n│   │   ├── RecentActivity.php\n│   │   └── ChartWidget.php\n│   ├── Users/\n│   │   ├── Index.php\n│   │   ├── Create.php\n│   │   └── Edit.php\n│   └── Admin/\n│       ├── Dashboard.php\n│       ├── Settings.php\n│       └── AuditLog.php\n├── Models/\n│   ├── User.php\n│   ├── Post.php\n│   ├── Category.php\n│   ${type === "saas" ? "├── Tenant.php\n│   ├── Subscription.php\n│   └── Invoice.php" : "└── Comment.php"}\n├── Observers/\n│   └── PostObserver.php\n├── Policies/\n│   ├── PostPolicy.php\n│   ├── UserPolicy.php\n│   └── ${type === "saas" ? "TenantPolicy.php" : "CommentPolicy.php"}\n├── Services/\n│   ├── BillingService.php\n│   └── NotificationService.php\n├── Traits/\n│   ├── HasTenant.php\n│   ├── HasSlug.php\n│   └── Sortable.php\nresources/\n├── views/\n│   ├── layouts/\n│   │   ├── base.blade.php\n│   │   ├── app.blade.php\n│   │   ├── guest.blade.php\n│   │   ├── auth.blade.php\n│   │   ├── dashboard.blade.php\n│   │   ├── admin/          base, sidebar, header, footer\n${tenantSection}\n│   ├── components/\n│   │   ├── common/         alert, modal, card, badge, empty-state\n│   │   ├── forms/          input, select, textarea, checkbox\n│   │   ├── tables/         header, row, pagination\n│   │   └── navigation/     sidebar, topbar, breadcrumbs\n│   ├── pages/\n│   │   ├── auth/           login, register, forgot-password\n│   │   ├── dashboard/      index\n│   │   ├── users/          index, show, create, edit\n│   │   ├── posts/          index, show, create, edit\n│   │   └── admin/          dashboard, users, settings\n│   └── vendor/             (package views)\n├── css/\n│   └── app.css\n└── js/\n    └── app.js\nroutes/\n├── web.php         (guest, auth routes)\n${tenantRoutes}\n├── console.php     (artisan commands)\n└── api.php         (API routes if needed)\nconfig/\n├── livewire.php\n├── auth.php\n├── cache.php\n└── ${type === "saas" ? "billing.php" : "app.php"}\ndatabase/\n├── migrations/\n│   ├── 0001_01_01_000000_create_users_table.php\n│   ├── 0001_01_01_000001_create_cache_table.php\n│   ├── 0001_01_01_000002_create_jobs_table.php\n│   └── 2024_01_01_000000_create_posts_table.php\n├── seeders/\n│   ├── DatabaseSeeder.php\n│   └── UserSeeder.php\n└── factories/\n    ├── UserFactory.php\n    └── PostFactory.php\ntests/\n├── Feature/\n│   ├── Livewire/\n│   │   ├── LoginTest.php\n│   │   ├── PostCreateTest.php\n│   │   └── UserIndexTest.php\n│   └── AuthTest.php\n└── Unit/\n    └── PostTest.php\n\`\`\``;
    return { content: [{ type: "text", text: structure }] };
  }
);

// ==================== TOOL: Generate CRUD Component ====================
server.tool(
  "generate_crud_component",
  "Generate a complete CRUD (Create, Read, Update, Delete) Livewire component with index, create, edit, delete, validation, authorization, and pagination.",
  {
    model: z.string().describe("Model name e.g. 'Post'"),
    modelClass: z.string().describe("Full model class e.g. 'App\\Models\\Post'"),
    fields: z.array(z.object({ name: z.string(), type: z.string().default("string"), rules: z.string().default("required"), label: z.string().optional(), inputType: z.string().default("text") })).default([]),
    layout: z.string().default("layouts.app"),
    authorize: z.boolean().default(true),
    softDeletes: z.boolean().default(false),
  },
  async ({ model, modelClass, fields, layout, authorize, softDeletes }) => {
    const modelInfo = extractModelInfo(modelClass || model);
    const { name: modelName, variable: modelVar } = modelInfo;
    
    const props = fields.map(f => `    public string $${f.name} = '';`).join("\n");
    const fillable = fields.map(f => `            '${f.name}' => $this->${f.name},`).join("\n");
    const rules = generateValidationRules(fields, { indent: '            ' });
    const auth = generateAuthChecks({ authorize, modelName, modelVar });
    const formFields = fields.map(f => `        <div>\n            <label for="${f.name}" class="block text-sm font-medium text-gray-700">${f.label || f.name}</label>\n            <input type="${f.inputType}" wire:model="${f.name}" id="${f.name}" class="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">\n            @error('${f.name}')<span class="text-red-500 text-sm">{{ $message }}</span>@enderror\n        </div>`).join("\n");
    const tableHeaders = fields.map(f => `            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">${f.label || f.name}</th>`).join("\n");
    const tableCells = fields.map(f => `                <td class="px-6 py-4 whitespace-nowrap">{{ $${modelVar}->${f.name} }}</td>`).join("\n");
    const code = `<?php\n\nuse Livewire\\Component;\nuse Livewire\\WithPagination;\nuse Livewire\\Attributes\\{Layout, Title, Computed};\nuse ${modelClass};\n\n#[Layout('${layout}')]\n#[Title('${modelName} Management')]\nnew class extends Component {\n    use WithPagination;\n\n${props}\n\n    public ${modelName} $${modelVar};\n    public bool $showModal = false;\n    public string $search = '';\n    public string $action = 'create';\n\n    public function rules(): array\n    {\n        return [\n${rules}        ];\n    }\n\n    #[Computed]\n    public function items()\n    {\n        return ${modelName}::query()\n            ->when($this->search, fn($q) => $q->where('${fields[0]?.name || "title"}', 'like', "%{$this->search}%"))\n            ${softDeletes ? "->withTrashed()\n            " : ""}->latest()\n            ->paginate(15);\n    }\n\n    public function creating(): void\n    {\n        $this->reset(fields);\n        $this->action = 'create';\n        $this->showModal = true;\n    }\n\n    public function editing(int $id): void\n    {\n        $this->${modelVar} = ${modelName}::findOrFail($id);\n${auth.update}\n        $this->action = 'edit';\n        ${fields.map(f => `$this->${f.name} = $this->${modelVar}->${f.name};`).join("\n        ")}\n        $this->showModal = true;\n    }\n\n    public function save(): void\n    {\n        $validated = $this->validate();\n        if ($this->action === 'create') {\n${auth.create}\n            ${modelName}::create([\n${fillable}            ]);\n        } else {\n            $this->${modelVar}->update([\n${fillable}            ]);\n        }\n        $this->showModal = false;\n        $this->reset(fields);\n    }\n\n    public function delete(int $id): void\n    {\n        $${modelVar} = ${modelName}::findOrFail($id);\n${auth.delete}\n        $${modelVar}->delete();\n    }\n\n    public function updatingSearch(): void\n    {\n        $this->resetPage();\n    }\n};\n?>\n\n<div class="p-6">\n    <div class="flex justify-between items-center mb-6">\n        <h1 class="text-2xl font-bold">${modelName} Management</h1>\n        <button wire:click="creating" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create New</button>\n    </div>\n    <div class="mb-4">\n        <input type="text" wire:model.live.debounce.300ms="search" placeholder="Search..." class="w-full px-4 py-2 border rounded-lg">\n    </div>\n    <div class="bg-white rounded-lg shadow overflow-hidden">\n        <table class="min-w-full divide-y divide-gray-200">\n            <thead class="bg-gray-50">\n                <tr>\n${tableHeaders}\n                    <th class="px-6 py-3 text-right">Actions</th>\n                </tr>\n            </thead>\n            <tbody class="bg-white divide-y divide-gray-200">\n                @forelse($this->items as $${modelVar})\n                <tr wire:key="{{ $${modelVar}->id }}">\n${tableCells}\n                    <td class="px-6 py-4 whitespace-nowrap text-right">\n                        <button wire:click="editing({{ $${modelVar}->id }})" class="text-blue-600 hover:underline mr-3">Edit</button>\n                        <button wire:click="delete({{ $${modelVar}->id }})" wire:confirm="Are you sure?" class="text-red-600 hover:underline">Delete</button>\n                    </td>\n                </tr>\n                @empty\n                <tr><td colspan="${fields.length + 1}" class="px-6 py-8 text-center text-gray-500">No ${model.toLowerCase()} found.</td></tr>\n                @endforelse\n            </tbody>\n        </table>\n    </div>\n    <div class="mt-4">{{ $this->items->links() }}</div>\n    @if($showModal)\n    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">\n        <div class="bg-white rounded-lg p-6 w-full max-w-md" @click.away="$wire.showModal = false">\n            <h2 class="text-lg font-semibold mb-4">{{ $action === 'create' ? 'Create' : 'Edit' }} ${modelName}</h2>\n            <form wire:submit="save" class="space-y-4">\n${formFields}\n                <div class="flex gap-3 justify-end">\n                    <button type="button" wire:click="$set('showModal', false)" class="px-4 py-2 text-gray-600">Cancel</button>\n                    <button type="submit" wire:loading.attr="disabled" class="px-4 py-2 bg-blue-600 text-white rounded-lg">Save</button>\n                </div>\n            </form>\n        </div>\n    </div>\n    @endif\n</div>`;
    return { content: [{ type: "text", text: code }] };
  }
);

// ==================== TOOL: Generate Data Table ====================
server.tool(
  "generate_data_table",
  "Generate a Livewire data table component with sorting, filtering, search, pagination, bulk actions, and export.",
  {
    model: z.string().describe("Model name e.g. 'Post'"),
    modelClass: z.string().describe("Full model class"),
    columns: z.array(z.object({ name: z.string(), label: z.string(), sortable: z.boolean().default(true), searchable: z.boolean().default(true), type: z.string().default("text") })).default([]),
    filters: z.array(z.object({ name: z.string(), label: z.string(), options: z.array(z.string()).optional() })).default([]),
    bulkActions: z.boolean().default(true),
    enableExport: z.boolean().default(false),
    layout: z.string().default("layouts.app"),
  },
  async ({ model, modelClass, columns, filters, bulkActions, enableExport, layout }) => {
    const modelName = modelClass ? modelClass.split("\\").pop() : model;
    const modelVar = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    const headers = columns.map(c => `            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer" wire:click="${c.sortable ? `sortBy('${c.name}')` : ""}">\n                ${c.label}\n                ${c.sortable ? '@if($sortColumn === "' + c.name + '"){{ $sortDirection === "asc" ? "↑" : "↓" }}@endif' : ""}\n            </th>`).join("\n");
    const cells = columns.map(c => {
      if (c.type === "date") return `                <td class="px-6 py-4 whitespace-nowrap">{{ $${modelVar}->${c.name}?->format('Y-m-d') }}</td>`;
      if (c.type === "boolean") return `                <td class="px-6 py-4 whitespace-nowrap">{{ $${modelVar}->${c.name} ? 'Yes' : 'No' }}</td>`;
      return `                <td class="px-6 py-4 whitespace-nowrap">{{ $${modelVar}->${c.name} }}</td>`;
    }).join("\n");
    const filterFields = filters.map(f => `        <div class="w-48">\n            <select wire:model.live="${f.name}" class="w-full px-3 py-2 border rounded-lg">\n                <option value="">All ${f.label}</option>\n                ${f.options?.map(o => `<option value="${o}">${o}</option>`).join("\n                ")}\n            </select>\n        </div>`).join("\n");
    const filterConditions = filters.map(f => `            ->when($this->${f.name}, fn($q) => $q->where('${f.name}', $this->${f.name}))`).join("\n");
    const code = `<?php\n\nuse Livewire\\Component;\nuse Livewire\\WithPagination;\nuse Livewire\\Attributes\\{Layout, Title, Computed};\nuse ${modelClass};\n\n#[Layout('${layout}')]\n#[Title('${modelName} Table')]\nnew class extends Component {\n    use WithPagination;\n\n    public string $search = '';\n    public string $sortColumn = 'created_at';\n    public string $sortDirection = 'desc';\n${filters.map(f => `    public string $${f.name} = '';`).join("\n")}\n${bulkActions ? "\n    public array $selected = [];\n    public bool $selectAll = false;" : ""}\n\n    public function sortBy(string $column): void\n    {\n        if ($this->sortColumn === $column) {\n            $this->sortDirection = $this->sortDirection === 'asc' ? 'desc' : 'asc';\n        } else {\n            $this->sortColumn = $column;\n            $this->sortDirection = 'asc';\n        }\n    }\n\n    public function updatingSearch(): void { $this->resetPage(); }\n${filters.map(f => `\n    public function updating${f.name.charAt(0).toUpperCase() + f.name.slice(1)}(): void { $this->resetPage(); }`).join("")}\n\n    #[Computed]\n    public function items()\n    {\n        return ${modelName}::query()\n            ->when($this->search, function ($q) {\n                ${columns.filter(c => c.searchable).map(c => `$q->orWhere('${c.name}', 'like', "%{$this->search}%")`).join("\n                ")};\n            })\n${filterConditions}\n            ->orderBy($this->sortColumn, $this->sortDirection)\n            ->paginate(15);\n    }\n${bulkActions ? `\n    public function toggleSelectAll(): void { $this->selectAll = !$this->selectAll; $this->selected = $this->selectAll ? $this->items->pluck('id')->toArray() : []; }\n    public function bulkDelete(): void { $this->authorize('deleteAny', ${modelName}::class); ${modelName}::destroy($this->selected); $this->selected = []; $this->selectAll = false; }` : ""}\n${enableExport ? `\n    public function exportCsv(): void { $this->authorize('viewAny', ${modelName}::class); }` : ""}\n};\n?>\n\n<div class="p-6">\n    <div class="flex justify-between items-center mb-6">\n        <h1 class="text-2xl font-bold">${modelName} Table</h1>\n        <div class="flex gap-3">${enableExport ? `<button wire:click="exportCsv" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Export</button>` : ""}</div>\n    </div>\n    <div class="flex gap-4 mb-4">\n        <div class="flex-1"><input type="text" wire:model.live.debounce.300ms="search" placeholder="Search..." class="w-full px-4 py-2 border rounded-lg"></div>\n${filterFields}\n    </div>\n${bulkActions ? `    @if(count($selected) > 0)\n    <div class="mb-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">\n        <span>{{ count($selected) }} selected</span>\n        <button wire:click="bulkDelete" wire:confirm="Delete {{ count($selected) }} items?" class="text-red-600 hover:underline">Delete Selected</button>\n    </div>\n    @endif` : ""}\n    <div class="bg-white rounded-lg shadow overflow-hidden">\n        <table class="min-w-full divide-y divide-gray-200">\n            <thead class="bg-gray-50">\n                <tr>\n${bulkActions ? `                    <th class="px-6 py-3"><input type="checkbox" wire:click="toggleSelectAll" {{ $selectAll ? 'checked' : '' }}></th>` : ""}\n${headers}\n                    <th class="px-6 py-3 text-right">Actions</th>\n                </tr>\n            </thead>\n            <tbody class="bg-white divide-y divide-gray-200">\n                @forelse($this->items as $${modelVar})\n                <tr wire:key="{{ $${modelVar}->id }}" class="{{ $selectAll || in_array($${modelVar}->id, $selected) ? 'bg-blue-50' : '' }}">\n${bulkActions ? `                    <td class="px-6 py-4"><input type="checkbox" wire:model="selected" value="{{ $${modelVar}->id }}"></td>` : ""}\n${cells}\n                    <td class="px-6 py-4 whitespace-nowrap text-right"><a href="{{ route('${model.toLowerCase()}.show', $${modelVar}->id) }}" class="text-blue-600 hover:underline">View</a></td>\n                </tr>\n                @empty\n                <tr><td colspan="${columns.length + (bulkActions ? 2 : 1)}" class="px-6 py-8 text-center text-gray-500">No records found.</td></tr>\n                @endforelse\n            </tbody>\n        </table>\n    </div>\n    <div class="mt-4">{{ $this->items->links() }}</div>\n</div>`;
    return { content: [{ type: "text", text: code }] };
  }
);

// ==================== TOOL: Generate Form Component ====================
server.tool(
  "generate_form_component",
  "Generate a Livewire form component with relationships, nested data, validation, file uploads, and dynamic fields.",
  {
    model: z.string().describe("Model name e.g. 'Post'"),
    modelClass: z.string(),
    fields: z.array(z.object({ name: z.string(), type: z.string().default("text"), rules: z.string().default("required"), label: z.string().optional(), options: z.array(z.string()).optional(), relationship: z.string().optional(), isFile: z.boolean().default(false), isTextarea: z.boolean().default(false) })).default([]),
    layout: z.string().default("layouts.app"),
    authorize: z.boolean().default(true),
  },
  async ({ model, modelClass, fields, layout, authorize }) => {
    const modelName = modelClass ? modelClass.split("\\").pop() : model;
    const modelVar = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    const props = fields.map(f => { if (f.isFile) return `    public $${f.name};`; if (f.type === "array") return `    public array $${f.name} = [];`; return `    public string $${f.name} = '';`; }).join("\n");
    const relationships = fields.filter(f => f.relationship);
    const relProps = relationships.map(f => `    public array $${f.name}Options = [];`);
    const relLoads = relationships.map(f => `        $this->${f.name}Options = ${f.relationship.split("\\").pop()}::pluck('name', 'id')->toArray();`);
    const fileFields = fields.filter(f => f.isFile);
    const fileImports = fileFields.length ? "use Livewire\\WithFileUploads;" : "";
    const fileTrait = fileFields.length ? "    use WithFileUploads;" : "";
    const fileRules = fileFields.map(f => `            '${f.name}' => 'required|file|mimes:jpg,png,pdf|max:2048',`).join("\n");
    const fileStores = fileFields.map(f => `            '${f.name}' => $this->${f.name}->store('${f.name}s'),`).join("\n            ");
    const rules = fields.filter(f => !f.isFile).map(f => `            '${f.name}' => '${f.rules}',`).join("\n");
    const fillable = fields.filter(f => !f.isFile).map(f => `            '${f.name}' => $this->${f.name},`).join("\n            ");
    const formElements = fields.map(f => {
      if (f.isFile) return `        <div><label for="${f.name}" class="block text-sm font-medium text-gray-700">${f.label || f.name}</label><input type="file" wire:model="${f.name}" id="${f.name}" class="mt-1 w-full">@error('${f.name}')<span class="text-red-500 text-sm">{{ $message }}</span>@enderror@if($${f.name})<p class="mt-1 text-sm text-gray-500">Selected: {{ $${f.name}->getClientOriginalName() }}</p>@endif</div>`;
      if (f.isTextarea) return `        <div><label for="${f.name}" class="block text-sm font-medium text-gray-700">${f.label || f.name}</label><textarea wire:model="${f.name}" id="${f.name}" rows="4" class="mt-1 w-full px-3 py-2 border rounded-lg"></textarea>@error('${f.name}')<span class="text-red-500 text-sm">{{ $message }}</span>@enderror</div>`;
      if (f.options?.length) return `        <div><label for="${f.name}" class="block text-sm font-medium text-gray-700">${f.label || f.name}</label><select wire:model="${f.name}" id="${f.name}" class="mt-1 w-full px-3 py-2 border rounded-lg"><option value="">Select ${f.label || f.name}</option>${f.options.map(o => `<option value="${o}">${o}</option>`).join("\n                ")}</select>@error('${f.name}')<span class="text-red-500 text-sm">{{ $message }}</span>@enderror</div>`;
      if (f.relationship) return `        <div><label for="${f.name}" class="block text-sm font-medium text-gray-700">${f.label || f.name}</label><select wire:model="${f.name}" id="${f.name}" class="mt-1 w-full px-3 py-2 border rounded-lg"><option value="">Select ${f.label || f.name}</option>@foreach($${f.name}Options as $id => $name)<option value="{{ $id }}">{{ $name }}</option>@endforeach</select>@error('${f.name}')<span class="text-red-500 text-sm">{{ $message }}</span>@enderror</div>`;
      return `        <div><label for="${f.name}" class="block text-sm font-medium text-gray-700">${f.label || f.name}</label><input type="${f.type}" wire:model="${f.name}" id="${f.name}" class="mt-1 w-full px-3 py-2 border rounded-lg">@error('${f.name}')<span class="text-red-500 text-sm">{{ $message }}</span>@enderror</div>`;
    }).join("\n");
    const code = `<?php\n\nuse Livewire\\Component;\nuse Livewire\\Attributes\\{Layout, Title};\n${fileImports}\nuse ${modelClass};\n${relationships.map(f => `use ${f.relationship};`).join("\n")}\n\n#[Layout('${layout}')]\n#[Title('Create ${modelName}')]\nnew class extends Component {\n${fileTrait}\n\n${props}\n${relProps.join("\n")}\n\n    public function mount(): void\n    {\n${relLoads.join("\n")}\n    }\n\n    public function rules(): array\n    {\n        return [\n${rules}\n${fileRules}        ];\n    }\n\n    public function save(): void\n    {\n        $validated = $this->validate();\n${authorize ? `        $this->authorize('create', ${modelName}::class);` : ""}\n        ${modelName}::create([\n${fillable}\n${fileStores}        ]);\n        session()->flash('success', '${modelName} created successfully.');\n        $this->redirectRoute('${model.toLowerCase()}.index', navigate: true);\n    }\n};\n?>\n\n<div class="p-6 max-w-2xl mx-auto">\n    <h1 class="text-2xl font-bold mb-6">Create ${modelName}</h1>\n    <form wire:submit="save" class="space-y-6 bg-white p-6 rounded-lg shadow">\n        @csrf\n${formElements}\n        <div class="flex gap-3 justify-end">\n            <a href="{{ url()->previous() }}" class="px-4 py-2 text-gray-600">Cancel</a>\n            <button type="submit" wire:loading.attr="disabled" wire:loading.class="opacity-50" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">\n                <span wire:loading.remove>Save</span><span wire:loading>Saving...</span>\n            </button>\n        </div>\n    </form>\n</div>`;
    return { content: [{ type: "text", text: code }] };
  }
);

// ==================== TOOL: Generate Modal Component ====================
server.tool(
  "generate_modal_component",
  "Generate a reusable Livewire modal component for confirmations, delete actions, forms, and alerts.",
  {
    modalType: z.enum(["confirm", "delete", "form", "alert", "info"]),
    title: z.string().default("Modal"),
    message: z.string().optional(),
    actionName: z.string().default("confirm"),
    modelClass: z.string().optional(),
    fields: z.array(z.object({ name: z.string(), type: z.string().optional(), rules: z.string().optional() })).default([]),
  },
  async ({ modalType, title, message, actionName, modelClass, fields }) => {
    const modelName = modelClass ? modelClass.split("\\").pop() : "Model";
    const modelVar = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    const props = fields.map(f => `    public string $${f.name} = '';`).join("\n");
    const rules = fields.map(f => `            '${f.name}' => '${f.rules || "required"}',`).join("\n");
    const formFields = fields.map(f => `        <div><label class="block text-sm font-medium text-gray-700">${f.name}</label><input type="text" wire:model="${f.name}" class="mt-1 w-full px-3 py-2 border rounded-lg">@error('${f.name}')<span class="text-red-500 text-sm">{{ $message }}</span>@enderror</div>`).join("\n");
    const buttonColors = { confirm: "bg-blue-600 hover:bg-blue-700", delete: "bg-red-600 hover:bg-red-700", form: "bg-green-600 hover:bg-green-700", alert: "bg-yellow-600 hover:bg-yellow-700", info: "bg-gray-600 hover:bg-gray-700" };
    const code = `<?php\n\nuse Livewire\\Component;\nuse Livewire\\Attributes\\{On, Validate};\n${modelClass ? `use ${modelClass};` : ""}\n\nnew class extends Component {\n    public bool $isOpen = false;\n    public mixed $itemId = null;\n${props}\n\n    public function rules(): array { return [\n${rules}        ]; }\n\n    #[On('open-modal')]\n    public function open(mixed $id = null): void { $this->itemId = $id; $this->isOpen = true; }\n\n    #[On('close-modal')]\n    public function close(): void { $this->isOpen = false; $this->reset(['${fields.map(f => f.name).join("', '")}']); }\n\n    public function ${actionName}(): void\n    {\n        ${fields.length ? "$validated = $this->validate();" : ""}\n        ${modalType === "delete" ? `$${modelVar} = ${modelName}::findOrFail($this->itemId);\n        $this->authorize('delete', $${modelVar});\n        $${modelVar}->delete();` : modalType === "form" ? `${modelName}::create($validated);` : `session()->flash('success', '${title} completed.');`}\n        $this->dispatch('modal-closed');\n        $this->close();\n    }\n};\n?>\n\n@if($isOpen)\n<div class="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">\n    <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">\n        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" @click="$dispatch('close-modal')"></div>\n        <span class="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>\n        <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">\n            <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">\n                <div class="sm:flex sm:items-start">\n                    <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${modalType === "delete" ? "bg-red-100" : "bg-blue-100"} sm:mx-0 sm:h-10 sm:w-10">\n                        <svg class="h-6 w-6 ${modalType === "delete" ? "text-red-600" : "text-blue-600"}" fill="none" viewBox="0 0 24 24" stroke="currentColor">\n                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${modalType === "delete" ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" : "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"}" />\n                        </svg>\n                    </div>\n                    <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">\n                        <h3 class="text-lg leading-6 font-medium text-gray-900" id="modal-title">${title}</h3>\n                        <div class="mt-2"><p class="text-sm text-gray-500">${message || "Are you sure you want to proceed?"}</p></div>\n                        ${fields.length ? `<form wire:submit="${actionName}" class="mt-4 space-y-4">${formFields}</form>` : ""}\n                    </div>\n                </div>\n            </div>\n            <div class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">\n                <button wire:click="${actionName}" wire:loading.attr="disabled" class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 ${buttonColors[modalType]} text-base font-medium text-white sm:ml-3 sm:w-auto sm:text-sm">${modalType.charAt(0).toUpperCase() + modalType.slice(1)}</button>\n                <button @click="$dispatch('close-modal')" class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">Cancel</button>\n            </div>\n        </div>\n    </div>\n</div>\n@endif`;
    return { content: [{ type: "text", text: code }] };
  }
);

// ==================== TOOL: Generate File Upload Component ====================
server.tool(
  "generate_file_upload_component",
  "Generate a Livewire file upload component with preview, validation, progress, multiple files, and drag-drop.",
  {
    model: z.string().optional(),
    modelClass: z.string().optional(),
    fieldName: z.string().default("file"),
    multiple: z.boolean().default(false),
    acceptedTypes: z.array(z.string()).default(["jpg", "png", "pdf"]),
    maxSize: z.number().default(2048),
    hasPreview: z.boolean().default(true),
    layout: z.string().default("layouts.app"),
  },
  async ({ model, modelClass, fieldName, multiple, acceptedTypes, maxSize, hasPreview, layout }) => {
    const modelName = modelClass ? modelClass.split("\\").pop() : (model || "Model");
    const propType = multiple ? "array" : "";
    const propDefault = multiple ? " = []" : "";
    const wireModel = multiple ? `${fieldName}.*` : fieldName;
    const acceptAttr = acceptedTypes.map(t => `.${t}`).join(",");
    const code = `<?php\n\nuse Livewire\\Component;\nuse Livewire\\WithFileUploads;\nuse Livewire\\Attributes\\{Layout, Title, Validate};\nuse ${modelClass || `App\\Models\\${modelName}`};\n\n#[Layout('${layout}')]\n#[Title('Upload ${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}')]\nnew class extends Component {\n    use WithFileUploads;\n\n    public ${propType} $${fieldName}${propDefault};\n    public bool $uploading = false;\n    public int $progress = 0;\n\n    public function rules(): array { return ['${fieldName}' => 'required|${multiple ? "array" : "file"}|mimes:${acceptedTypes.join(",")}|max:${maxSize}']; }\n\n    public function updated${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}(): void { $this->validate(['${fieldName}' => 'required|${multiple ? "array" : "file"}|mimes:${acceptedTypes.join(",")}|max:${maxSize}']); }\n\n    public function save(): void\n    {\n        $validated = $this->validate();\n        $this->authorize('create', ${modelName}::class);\n        ${multiple ? `$paths = [];\n        foreach ($this->${fieldName} as $file) { $paths[] = $file->store('${fieldName}s'); }` : `$path = $this->${fieldName}->store('${fieldName}s');`}\n        ${modelName}::create(['${fieldName}' => ${multiple ? "json_encode($paths)" : "$path"}]);\n        session()->flash('success', '${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)} uploaded successfully.');\n        $this->reset('${fieldName}');\n    }\n\n    public function remove(int $index = null): void { ${multiple ? `if ($index !== null) { unset($this->${fieldName}[$index]); $this->${fieldName} = array_values($this->${fieldName}); }` : `$this->reset('${fieldName}');`}; }\n};\n?>\n\n<div class="p-6 max-w-xl mx-auto">\n    <h1 class="text-2xl font-bold mb-6">Upload ${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}</h1>\n    <form wire:submit="save" class="space-y-6">\n        <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">\n            <input type="file" wire:model="${wireModel}" ${multiple ? "multiple" : ""} accept="${acceptAttr}" class="hidden" id="${fieldName}">\n            <label for="${fieldName}" class="cursor-pointer">\n                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>\n                <p class="mt-2 text-sm text-gray-600">Click to upload or drag and drop</p>\n                <p class="text-xs text-gray-500">${acceptedTypes.join(", ").toUpperCase()} up to ${maxSize}KB</p>\n            </label>\n            @error('${fieldName}')<p class="mt-2 text-red-500">{{ $message }}</p>@enderror\n        </div>\n        @if($${fieldName})\n        <div class="space-y-2">\n            ${multiple ? `@foreach($${fieldName} as $index => $file)\n            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg" wire:key="{{ $index }}">\n                <div class="flex items-center">${hasPreview ? `<img src="{{ $file->temporaryUrl() }}" class="h-10 w-10 object-cover rounded">` : ""}<span class="ml-3 text-sm">{{ $file->getClientOriginalName() }}</span></div>\n                <button wire:click="remove({{ $index }})" class="text-red-600 hover:underline">Remove</button>\n            </div>\n            @endforeach` : `<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">\n                <div class="flex items-center">${hasPreview ? `<img src="{{ $${fieldName}->temporaryUrl() }}" class="h-10 w-10 object-cover rounded">` : ""}<span class="ml-3 text-sm">{{ $${fieldName}->getClientOriginalName() }}</span></div>\n                <button wire:click="remove" class="text-red-600 hover:underline">Remove</button>\n            </div>`}\n        </div>\n        @endif\n        <div wire:loading wire:target="${fieldName}" class="w-full bg-gray-200 rounded-full h-2"><div class="bg-blue-600 h-2 rounded-full" style="width: 50%"></div></div>\n        <button type="submit" wire:loading.attr="disabled" wire:loading.class="opacity-50" class="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Upload</button>\n    </form>\n</div>`;
    return { content: [{ type: "text", text: code }] };
  }
);

// ==================== TOOL: Generate Search Filter Component ====================
server.tool(
  "generate_search_filter_component",
  "Generate a Livewire search and filter component with multi-field filters, date range, sorting, and pagination.",
  {
    model: z.string(),
    modelClass: z.string(),
    searchFields: z.array(z.string()).default(["title"]),
    filters: z.array(z.object({ name: z.string(), label: z.string(), type: z.enum(["select", "multiselect", "date", "daterange", "number"]), options: z.array(z.string()).optional() })).default([]),
    sortOptions: z.array(z.object({ name: z.string(), label: z.string() })).default([]),
    layout: z.string().default("layouts.app"),
  },
  async ({ model, modelClass, searchFields, filters, sortOptions, layout }) => {
    const modelName = modelClass ? modelClass.split("\\").pop() : model;
    const modelVar = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    const filterProps = filters.map(f => { if (f.type === "multiselect") return `    public array $${f.name} = [];`; if (f.type === "daterange") return `    public string $${f.name}_start = '';\n    public string $${f.name}_end = '';`; return `    public string $${f.name} = '';`; }).join("\n");
    const filterConditions = filters.map(f => { if (f.type === "multiselect") return `            ->when(count($this->${f.name}), fn($q) => $q->whereIn('${f.name}', $this->${f.name}))`; if (f.type === "daterange") return `            ->when($this->${f.name}_start, fn($q) => $q->whereDate('${f.name}', '>=', $this->${f.name}_start))\n            ->when($this->${f.name}_end, fn($q) => $q->whereDate('${f.name}', '<=', $this->${f.name}_end))`; return `            ->when($this->${f.name}, fn($q) => $q->where('${f.name}', $this->${f.name}))`; }).join("\n");
    const searchCondition = searchFields.map(f => `$q->orWhere('${f}', 'like', "%{$this->search}%")`).join("\n                ");
    const filterInputs = filters.map(f => {
      if (f.type === "select") return `        <div><label class="block text-sm font-medium text-gray-700 mb-1">${f.label}</label><select wire:model.live="${f.name}" class="w-full px-3 py-2 border rounded-lg"><option value="">All</option>${f.options?.map(o => `<option value="${o}">${o}</option>`).join("\n                ")}</select></div>`;
      if (f.type === "multiselect") return `        <div><label class="block text-sm font-medium text-gray-700 mb-1">${f.label}</label><select wire:model.live="${f.name}" multiple class="w-full px-3 py-2 border rounded-lg">${f.options?.map(o => `<option value="${o}">${o}</option>`).join("\n                ")}</select></div>`;
      if (f.type === "date") return `        <div><label class="block text-sm font-medium text-gray-700 mb-1">${f.label}</label><input type="date" wire:model.live="${f.name}" class="w-full px-3 py-2 border rounded-lg"></div>`;
      if (f.type === "daterange") return `        <div><label class="block text-sm font-medium text-gray-700 mb-1">${f.label}</label><div class="flex gap-2"><input type="date" wire:model.live="${f.name}_start" class="w-1/2 px-3 py-2 border rounded-lg" placeholder="From"><input type="date" wire:model.live="${f.name}_end" class="w-1/2 px-3 py-2 border rounded-lg" placeholder="To"></div></div>`;
      return `        <div><label class="block text-sm font-medium text-gray-700 mb-1">${f.label}</label><input type="number" wire:model.live="${f.name}" class="w-full px-3 py-2 border rounded-lg"></div>`;
    }).join("\n");
    const code = `<?php\n\nuse Livewire\\Component;\nuse Livewire\\WithPagination;\nuse Livewire\\Attributes\\{Layout, Title, Computed};\nuse ${modelClass};\n\n#[Layout('${layout}')]\n#[Title('Search ${modelName}')]\nnew class extends Component {\n    use WithPagination;\n\n    public string $search = '';\n    public string $sortOption = 'created_at|desc';\n${filterProps}\n\n    public function rules(): array { return ['search' => 'nullable|string|max:255']; }\n\n    #[Computed]\n    public function items()\n    {\n        return ${modelName}::query()\n            ->when($this->search, function ($q) { $q->where(function ($q) { ${searchCondition}; }); })\n${filterConditions}\n            ->orderBy(...explode('|', $this->sortOption))\n            ->paginate(15);\n    }\n\n    public function resetFilters(): void { $this->reset(['search', ${filters.map(f => `'${f.name}'`).join(", ")}]); $this->resetPage(); }\n    public function updatingSearch(): void { $this->resetPage(); }\n};\n?>\n\n<div class="p-6">\n    <h1 class="text-2xl font-bold mb-6">Search ${modelName}</h1>\n    <div class="bg-white p-4 rounded-lg shadow mb-6">\n        <div class="mb-4"><input type="text" wire:model.live.debounce.300ms="search" placeholder="Search ${searchFields.join(", ")}..." class="w-full px-4 py-2 border rounded-lg"></div>\n        <div class="grid grid-cols-1 md:grid-cols-${Math.min(filters.length, 4)} gap-4 mb-4">\n${filterInputs}\n        </div>\n        <div class="flex gap-4">\n            ${sortOptions.length ? `<div class="w-48"><select wire:model.live="sortOption" class="w-full px-3 py-2 border rounded-lg">${sortOptions.map(o => `<option value="${o.name}">${o.label}</option>`).join("\n                ")}</select></div>` : ""}\n            <button wire:click="resetFilters" class="px-4 py-2 text-gray-600 hover:underline">Reset Filters</button>\n        </div>\n    </div>\n    <div class="bg-white rounded-lg shadow overflow-hidden">\n        <table class="min-w-full divide-y divide-gray-200">\n            <thead class="bg-gray-50"><tr>\n                ${searchFields.map(f => `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">${f}</th>`).join("\n                    ")}\n                <th class="px-6 py-3 text-right">Actions</th>\n            </tr></thead>\n            <tbody class="bg-white divide-y divide-gray-200">\n                @forelse($this->items as $${modelVar})\n                <tr wire:key="{{ $${modelVar}->id }}">\n                    ${searchFields.map(f => `<td class="px-6 py-4">{{ $${modelVar}->${f} }}</td>`).join("\n                    ")}\n                    <td class="px-6 py-4 text-right"><a href="{{ route('${model.toLowerCase()}.show', $${modelVar}->id) }}" class="text-blue-600 hover:underline">View</a></td>\n                </tr>\n                @empty\n                <tr><td colspan="${searchFields.length + 1}" class="px-6 py-8 text-center text-gray-500">No results found.</td></tr>\n                @endforelse\n            </tbody>\n        </table>\n    </div>\n    <div class="mt-4">{{ $this->items->links() }}</div>\n</div>`;
    return { content: [{ type: "text", text: code }] };
  }
);

// ==================== TOOL: Generate Chart Widget ====================
server.tool(
  "generate_chart_widget",
  "Generate a Livewire dashboard chart/widget component with stats, charts, and real-time updates.",
  {
    widgetType: z.enum(["stats-card", "line-chart", "bar-chart", "pie-chart", "activity-feed", "recent-items"]),
    title: z.string().default("Widget"),
    modelClass: z.string().optional(),
    metrics: z.array(z.object({ name: z.string(), label: z.string(), aggregation: z.enum(["count", "sum", "avg", "max", "min"]), column: z.string().optional() })).default([]),
    refreshInterval: z.number().default(0),
    layout: z.string().default("layouts.dashboard"),
  },
  async ({ widgetType, title, modelClass, metrics, refreshInterval, layout }) => {
    const modelName = modelClass ? modelClass.split("\\").pop() : "Model";
    const modelVar = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    const pollAttr = refreshInterval > 0 ? `wire:poll.${refreshInterval}s` : "";
    if (widgetType === "stats-card") {
      const metricCards = metrics.map(m => `    <div class="bg-white rounded-lg shadow p-6">\n        <div class="flex items-center">\n            <div class="p-3 rounded-full bg-blue-100 text-blue-600"><svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg></div>\n            <div class="ml-4"><p class="text-sm font-medium text-gray-500">${m.label}</p><p class="text-2xl font-semibold text-gray-900">{{ $this->${m.name} }}</p></div>\n        </div>\n    </div>`).join("\n");
      const code = `<?php\n\nuse Livewire\\Component;\nuse Livewire\\Attributes\\{Layout, Title, Computed};\nuse ${modelClass};\n\n#[Layout('${layout}')]\n#[Title('${title}')]\nnew class extends Component {\n    ${metrics.map(m => `#[Computed]\n    public function ${m.name}() { return ${modelName}::${m.aggregation}('${m.column || "id"}'); }`).join("\n\n    ")}\n};\n?>\n\n<div class="p-6" ${pollAttr}>\n    <h2 class="text-xl font-bold mb-6">${title}</h2>\n    <div class="grid grid-cols-1 md:grid-cols-${metrics.length} gap-6">\n${metricCards}\n    </div>\n</div>`;
      return { content: [{ type: "text", text: code }] };
    }
    if (widgetType === "activity-feed") {
      const code = `<?php\n\nuse Livewire\\Component;\nuse Livewire\\Attributes\\{Layout, Title, Computed};\nuse ${modelClass};\n\n#[Layout('${layout}')]\n#[Title('${title}')]\nnew class extends Component {\n    #[Computed]\n    public function activities() { return ${modelName}::with('user')->latest()->take(10)->get(); }\n};\n?>\n\n<div class="bg-white rounded-lg shadow" ${pollAttr}>\n    <div class="px-6 py-4 border-b"><h3 class="text-lg font-semibold">${title}</h3></div>\n    <div class="divide-y">\n        @forelse($this->activities as $activity)\n        <div class="px-6 py-4" wire:key="{{ $activity->id }}">\n            <div class="flex items-center">\n                <div class="flex-shrink-0"><div class="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm">{{ substr($activity->user->name ?? 'U', 0, 1) }}</div></div>\n                <div class="ml-3"><p class="text-sm text-gray-900"><span class="font-medium">{{ $activity->user->name ?? 'User' }}</span> {{ $activity->action ?? 'created' }} ${modelVar}</p><p class="text-xs text-gray-500">{{ $activity->created_at->diffForHumans() }}</p></div>\n            </div>\n        </div>\n        @empty\n        <div class="px-6 py-8 text-center text-gray-500">No recent activity.</div>\n        @endforelse\n    </div>\n</div>`;
      return { content: [{ type: "text", text: code }] };
    }
    const code = `<?php\n\nuse Livewire\\Component;\nuse Livewire\\Attributes\\{Layout, Title, Computed};\nuse ${modelClass};\nuse Illuminate\\Support\\Facades\\DB;\n\n#[Layout('${layout}')]\n#[Title('${title}')]\nnew class extends Component {\n    #[Computed]\n    public function chartData() { return ${modelName}::select(DB::raw('DATE(created_at) as date'), DB::raw('COUNT(*) as count'))->where('created_at', '>=', now()->subDays(30))->groupBy('date')->orderBy('date')->get(); }\n};\n?>\n\n<div class="bg-white rounded-lg shadow p-6" ${pollAttr}>\n    <h3 class="text-lg font-semibold mb-4">${title}</h3>\n    <div class="h-64"><canvas id="${widgetType.replace("-", "")}Chart"></canvas></div>\n    @push('scripts')\n    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>\n    <script>\n        document.addEventListener('livewire:navigated', () => {\n            const ctx = document.getElementById('${widgetType.replace("-", "")}Chart');\n            if (ctx) { new Chart(ctx, { type: '${widgetType === "line-chart" ? "line" : widgetType === "bar-chart" ? "bar" : "pie"}', data: { labels: @json($this->chartData->pluck('date')), datasets: [{ label: '${title}', data: @json($this->chartData->pluck('count')), borderColor: 'rgb(59, 130, 246)', backgroundColor: 'rgba(59, 130, 246, 0.1)', tension: 0.1 }] }, options: { responsive: true, maintainAspectRatio: false } }); }\n        });\n    </script>\n    @endpush\n</div>`;
    return { content: [{ type: "text", text: code }] };
  }
);

// ==================== TOOL: Generate Policy ====================
server.tool(
  "generate_policy",
  "Generate a Laravel policy class for a model with all CRUD authorization methods.",
  {
    model: z.string().describe("Model name e.g. 'Post'"),
    modelClass: z.string(),
    userClass: z.string().default("App\\Models\\User"),
    extraMethods: z.array(z.string()).default(["publish", "archive"]),
  },
  async ({ model, modelClass, userClass, extraMethods }) => {
    const modelName = modelClass ? modelClass.split("\\").pop() : model;
    const modelVar = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    const userModel = userClass.split("\\").pop();
    const userVar = userModel.charAt(0).toLowerCase() + userModel.slice(1);
    const extraPolicyMethods = extraMethods.map(m => `    public function ${m}(${userModel} $${userVar}, ${modelName} $${modelVar}): bool\n    {\n        return $${userVar}->id === $${modelVar}->user_id;\n    }`).join("\n\n");
    const code = `<?php\n\nnamespace App\\Policies;\n\nuse ${userClass};\nuse ${modelClass};\nuse Illuminate\\Auth\\Access\\HandlesAuthorization;\n\nclass ${modelName}Policy\n{\n    use HandlesAuthorization;\n\n    public function viewAny(${userModel} $${userVar}): bool { return true; }\n    public function view(${userModel} $${userVar}, ${modelName} $${modelVar}): bool { return $${userVar}->id === $${modelVar}->user_id || $${userVar}->isAdmin(); }\n    public function create(${userModel} $${userVar}): bool { return true; }\n    public function update(${userModel} $${userVar}, ${modelName} $${modelVar}): bool { return $${userVar}->id === $${modelVar}->user_id; }\n    public function delete(${userModel} $${userVar}, ${modelName} $${modelVar}): bool { return $${userVar}->id === $${modelVar}->user_id; }\n    public function restore(${userModel} $${userVar}, ${modelName} $${modelVar}): bool { return $${userVar}->id === $${modelVar}->user_id; }\n    public function forceDelete(${userModel} $${userVar}, ${modelName} $${modelVar}): bool { return $${userVar}->isAdmin(); }\n\n${extraPolicyMethods}\n}`;
    return { content: [{ type: "text", text: code }] };
  }
);

// ==================== TOOL: Generate Observer ====================
server.tool(
  "generate_observer",
  "Generate a Laravel model observer for handling model events (creating, updating, deleting, etc.).",
  {
    model: z.string(),
    modelClass: z.string(),
    events: z.array(z.object({ name: z.enum(["creating", "created", "updating", "updated", "saving", "saved", "deleting", "deleted", "restoring", "restored"]), action: z.string().optional() })).default([{ name: "creating", action: "Generate slug from title" }, { name: "deleting", action: "Delete related records" }]),
  },
  async ({ model, modelClass, events }) => {
    const modelName = modelClass ? modelClass.split("\\").pop() : model;
    const modelVar = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    const methods = events.map(e => `    public function ${e.name}(${modelName} $${modelVar}): void\n    {\n        ${e.action || "// Logic for " + e.name + " event"}\n    }`).join("\n\n");
    return { content: [{ type: "text", text: `<?php\n\nnamespace App\\Observers;\n\nuse ${modelClass};\n\nclass ${modelName}Observer\n{\n${methods}\n}` }] };
  }
);

// ==================== TOOL: Generate Trait ====================
server.tool(
  "generate_trait",
  "Generate a reusable PHP trait for Laravel models (HasSlug, HasTenant, Sortable, HasStatus, HasUuid, Cachable, HasMedia).",
  { traitName: z.enum(["HasSlug", "HasTenant", "Sortable", "HasStatus", "HasUuid", "Cachable", "HasMedia"]), description: z.string().optional() },
  async ({ traitName }) => {
    const traits = {
      HasSlug: `<?php\n\nnamespace App\\Traits;\n\nuse Illuminate\\Support\\Str;\n\ntrait HasSlug\n{\n    public static function bootHasSlug(): void\n    {\n        static::creating(function ($model) {\n            if (empty($model->slug) && !empty($model->title)) $model->slug = Str::slug($model->title);\n        });\n        static::updating(function ($model) {\n            if ($model->isDirty('title') && empty($model->slug)) $model->slug = Str::slug($model->title);\n        });\n    }\n    public function getRouteKeyName(): string { return 'slug'; }\n}`,
      HasTenant: `<?php\n\nnamespace App\\Traits;\n\nuse Illuminate\\Database\\Eloquent\\Builder;\n\ntrait HasTenant\n{\n    public static function bootHasTenant(): void\n    {\n        static::addGlobalScope('tenant', function (Builder $builder) {\n            if (auth()->check() && auth()->user()->tenant_id) $builder->where('tenant_id', auth()->user()->tenant_id);\n        });\n        static::creating(function ($model) {\n            if (auth()->check() && auth()->user()->tenant_id) $model->tenant_id = auth()->user()->tenant_id;\n        });\n    }\n    public function tenant(): \\Illuminate\\Database\\Eloquent\\Relations\\BelongsTo { return $this->belongsTo(\\App\\Models\\Tenant::class); }\n}`,
      Sortable: `<?php\n\nnamespace App\\Traits;\n\nuse Illuminate\\Database\\Eloquent\\Builder;\n\ntrait Sortable\n{\n    public function scopeSort(Builder $query, string $column = 'created_at', string $direction = 'desc'): Builder\n    {\n        $allowedColumns = $this->sortable ?? ['created_at', 'name', 'title'];\n        if (in_array($column, $allowedColumns)) return $query->orderBy($column, in_array($direction, ['asc', 'desc']) ? $direction : 'desc');\n        return $query->orderBy('created_at', 'desc');\n    }\n}`,
      HasStatus: `<?php\n\nnamespace App\\Traits;\n\ntrait HasStatus\n{\n    public function scopeActive($query) { return $query->where('status', 'active'); }\n    public function scopeInactive($query) { return $query->where('status', 'inactive'); }\n    public function activate(): void { $this->update(['status' => 'active']); }\n    public function deactivate(): void { $this->update(['status' => 'inactive']); }\n    public function isActive(): bool { return $this->status === 'active'; }\n}`,
      HasUuid: `<?php\n\nnamespace App\\Traits;\n\nuse Illuminate\\Support\\Str;\n\ntrait HasUuid\n{\n    public static function bootHasUuid(): void\n    {\n        static::creating(function ($model) {\n            if (empty($model->uuid)) $model->uuid = (string) Str::uuid();\n        });\n    }\n    public function getRouteKeyName(): string { return 'uuid'; }\n    public static function findByUuid(string $uuid): ?static { return static::where('uuid', $uuid)->first(); }\n}`,
      Cachable: `<?php\n\nnamespace App\\Traits;\n\nuse Illuminate\\Support\\Facades\\Cache;\n\ntrait Cachable\n{\n    protected static function bootCachable(): void\n    {\n        static::saved(function ($model) { $model->flushCache(); });\n        static::deleted(function ($model) { $model->flushCache(); });\n    }\n    public function flushCache(): void { Cache::forget($this->getCacheKey()); }\n    protected function getCacheKey(): string { return sprintf('%s_%d', class_basename($this), $this->getKey()); }\n    public static function cacheQuery(string $key, \\Closure $callback, int $ttl = 3600): mixed { return Cache::remember($key, $ttl, $callback); }\n}`,
      HasMedia: `<?php\n\nnamespace App\\Traits;\n\ntrait HasMedia\n{\n    public function media(): \\Illuminate\\Database\\Eloquent\\Relations\\MorphMany { return $this->morphMany(\\App\\Models\\Media::class, 'mediable'); }\n    public function addMedia($file, string $collection = 'default'): \\App\\Models\\Media { return $this->media()->create(['file_path' => $file->store('media'), 'collection' => $collection, 'mime_type' => $file->getMimeType(), 'size' => $file->getSize()]); }\n    public function getMedia(string $collection = 'default'): \\Illuminate\\Database\\Eloquent\\Collection { return $this->media()->where('collection', $collection)->get(); }\n    public function getFirstMedia(string $collection = 'default'): ?\\App\\Models\\Media { return $this->media()->where('collection', $collection)->first(); }\n}`,
    };
    return { content: [{ type: "text", text: traits[traitName] || traits.HasSlug }] };
  }
);

// ==================== TOOL: Generate Middleware ====================
server.tool(
  "generate_middleware",
  "Generate a Laravel HTTP middleware class (Admin, Tenant, VerifyEmail, RateLimit, CheckSubscription, MaintenanceMode).",
  { middlewareName: z.enum(["Admin", "Tenant", "VerifyEmail", "RateLimit", "CheckSubscription", "MaintenanceMode"]) },
  async ({ middlewareName }) => {
    const middlewares = {
      Admin: `<?php\n\nnamespace App\\Http\\Middleware;\n\nuse Closure;\nuse Illuminate\\Http\\Request;\nuse Symfony\\Component\\HttpFoundation\\Response;\n\nclass Admin\n{\n    public function handle(Request $request, Closure $next): Response\n    {\n        if (!$request->user() || !$request->user()->isAdmin()) abort(403, 'Unauthorized action.');\n        return $next($request);\n    }\n}`,
      Tenant: `<?php\n\nnamespace App\\Http\\Middleware;\n\nuse Closure;\nuse Illuminate\\Http\\Request;\nuse Symfony\\Component\\HttpFoundation\\Response;\n\nclass Tenant\n{\n    public function handle(Request $request, Closure $next): Response\n    {\n        $tenant = $request->route('tenant');\n        if (!$tenant || !$request->user()->tenants->contains($tenant)) abort(403, 'You do not have access to this tenant.');\n        $request->merge(['tenant' => $tenant]);\n        return $next($request);\n    }\n}`,
      VerifyEmail: `<?php\n\nnamespace App\\Http\\Middleware;\n\nuse Closure;\nuse Illuminate\\Http\\Request;\nuse Symfony\\Component\\HttpFoundation\\Response;\n\nclass VerifyEmail\n{\n    public function handle(Request $request, Closure $next): Response\n    {\n        if ($request->user() && !$request->user()->hasVerifiedEmail()) return redirect()->route('verification.notice');\n        return $next($request);\n    }\n}`,
      RateLimit: `<?php\n\nnamespace App\\Http\\Middleware;\n\nuse Closure;\nuse Illuminate\\Http\\Request;\nuse Illuminate\\Support\\Facades\\RateLimiter;\nuse Symfony\\Component\\HttpFoundation\\Response;\nuse Symfony\\Component\\HttpFoundation\\TooManyRequestsResponse;\n\nclass RateLimit\n{\n    public function handle(Request $request, Closure $next, string $limit = '60,1'): Response\n    {\n        [$maxAttempts, $decayMinutes] = explode(',', $limit);\n        $key = sha1($request->ip());\n        if (RateLimiter::tooManyAttempts($key, (int) $maxAttempts)) return new TooManyRequestsResponse(headers: ['Retry-After' => RateLimiter::availableIn($key) * 60]);\n        RateLimiter::hit($key, (int) $decayMinutes * 60);\n        return $next($request);\n    }\n}`,
      CheckSubscription: `<?php\n\nnamespace App\\Http\\Middleware;\n\nuse Closure;\nuse Illuminate\\Http\\Request;\nuse Symfony\\Component\\HttpFoundation\\Response;\n\nclass CheckSubscription\n{\n    public function handle(Request $request, Closure $next): Response\n    {\n        if (!$request->user()?->hasActiveSubscription()) return redirect()->route('billing.subscribe')->with('error', 'An active subscription is required.');\n        return $next($request);\n    }\n}`,
      MaintenanceMode: `<?php\n\nnamespace App\\Http\\Middleware;\n\nuse Closure;\nuse Illuminate\\Http\\Request;\nuse Symfony\\Component\\HttpFoundation\\Response;\n\nclass MaintenanceMode\n{\n    public function handle(Request $request, Closure $next): Response\n    {\n        if (config('app.maintenance', false) && !$request->user()?->isAdmin()) return response()->view('errors.maintenance', [], 503);\n        return $next($request);\n    }\n}`,
    };
    return { content: [{ type: "text", text: middlewares[middlewareName] || middlewares.Admin }] };
  }
);

// ==================== TOOL: Generate Service Class ====================
server.tool(
  "generate_service_class",
  "Generate a Laravel service class for business logic (BillingService, NotificationService, etc.).",
  {
    serviceName: z.string().describe("Service name e.g. 'BillingService'"),
    methods: z.array(z.object({ name: z.string(), params: z.array(z.string()).optional(), return: z.string().optional() })).default([]),
  },
  async ({ serviceName, methods }) => {
    const methodCode = methods.map(m => `    public function ${m.name}(${m.params?.map(p => `mixed $${p}`).join(", ")}): ${m.return || "void"}\n    {\n        // Implementation for ${m.name}\n    }`).join("\n\n");
    return { content: [{ type: "text", text: `<?php\n\nnamespace App\\Services;\n\nuse Exception;\nuse Illuminate\\Support\\Facades\\{DB, Log, Cache};\n\nclass ${serviceName}\n{\n    public function __construct() { /* Initialize dependencies */ }\n\n${methodCode}\n}` }] };
  }
);

// ==================== TOOL: Generate Plan ====================
server.tool(
  "generate_plan",
  "Generate a full-stack development plan with phases and task groups for SaaS, Enterprise, E-Commerce, or Portfolio projects.",
  {
    keyword: z.enum(["saas", "enterprise", "ecommerce", "portfolio"]),
    custom: z.string().default(""),
  },
  async ({ keyword, custom }) => {
    const templates = getPlanTemplates();
    const template = templates[keyword] || templates.enterprise;
    const state = {
      projectName: `${keyword}-app`,
      type: keyword,
      phases: JSON.parse(JSON.stringify(template.phases)),
      currentPhase: 0,
      tasks: [],
      todos: [],
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      interrupted: false,
      lastAction: `Plan generated for ${keyword} project`,
      autoSync: true,
      completed: false,
    };
    if (custom) {
      state.phases.push({
        name: `Phase ${state.phases.length + 1}: Custom Requirements`,
        description: custom,
        tasks: custom.split(",").map(t => ({ name: t.trim(), status: "pending", type: "custom" })),
      });
    }
    saveProjectState(state);
    const progress = calculateProgress(state);
    let output = `PROJECT PLAN: ${state.projectName}\nType: ${keyword}\n`;
    if (custom) output += `Custom: ${custom}\n`;
    output += `\nPROGRESS: ${progress.complete}% complete | ${progress.incomplete}% incomplete (${progress.done}/${progress.total} tasks)\n`;
    state.phases.forEach((phase, i) => {
      const phaseDone = phase.tasks.filter(t => t.status === "complete").length;
      output += `\nPHASE ${i + 1}: ${phase.name}\n  ${phase.description}\n`;
      phase.tasks.forEach((task, j) => {
        const icon = task.status === "complete" ? "[x]" : task.status === "in_progress" ? "[~]" : "[ ]";
        output += `  ${icon} ${j + 1}. ${task.name}\n`;
      });
      output += `  Progress: ${phaseDone}/${phase.tasks.length} tasks\n`;
    });
    output += `\nNext Action: Start with Phase 1, Task 1\n`;
    return { content: [{ type: "text", text: output }] };
  }
);

// ==================== TOOL: Update Task Status ====================
server.tool(
  "update_task_status",
  "Update a task status (pending, in_progress, complete) and auto-sync to git.",
  {
    phaseIndex: z.number(),
    taskIndex: z.number(),
    status: z.enum(["pending", "in_progress", "complete"]),
  },
  async ({ phaseIndex, taskIndex, status }) => {
    const state = getProjectState();
    if (!state.phases[phaseIndex]?.tasks?.[taskIndex]) {
      return { content: [{ type: "text", text: "Task not found." }] };
    }
    state.phases[phaseIndex].tasks[taskIndex].status = status;
    state.lastAction = `Task "${state.phases[phaseIndex].tasks[taskIndex].name}" marked as ${status}`;
    const progress = calculateProgress(state);
    if (progress.complete === 100) {
      state.completed = true;
      state.completedAt = new Date().toISOString();
    }
    saveProjectState(state);
    let output = `Task updated: ${state.phases[phaseIndex].tasks[taskIndex].name} -> ${status}\nProgress: ${progress.complete}% complete (${progress.done}/${progress.total} tasks)\n`;
    if (state.autoSync && status === "complete") {
      output += `\nAuto-syncing to git...\n`;
      try {
        const syncResult = autoSyncOnTaskComplete(state, state.phases[phaseIndex].tasks[taskIndex].name);
        if (syncResult.committed) output += "Committed to git.\n";
        if (syncResult.pushed) output += "Pushed to remote.\n";
        if (syncResult.tagged) output += "Phase tag created.\n";
        if (syncResult.onComplete?.success) output += `100% COMPLETE! Auto-pushed with release.\n`;
      } catch (e) {
        output += `Git sync skipped: ${e.message}\n`;
      }
    }
    return { content: [{ type: "text", text: output }] };
  }
);

// ==================== TOOL: Fix Bugs ====================
server.tool(
  "fix_bugs",
  "Analyze and fix bugs in Livewire/Laravel code automatically.",
  {
    code: z.string(),
    bugDescription: z.string().default(""),
    fileType: z.enum(["php", "blade", "component", "model"]),
  },
  async ({ code, bugDescription, fileType }) => {
    const issues = [];
    let fixedCode = code;
    if ((fileType === "component" || fileType === "php") && code.includes("->create(") && !code.includes("validate") && !code.includes("Validate")) {
      issues.push({ type: "missing_validation", severity: "HIGH", message: "No validation before create()", fix: "Add $this->validate([...]) before create()" });
      fixedCode = fixedCode.replace(/(public function save\(\): void\n    \{)/, "$1\n        $this->validate([\n            // Add validation rules\n        ]);");
    }
    if ((fileType === "component" || fileType === "php") && code.includes("->delete()") && !code.includes("authorize")) {
      issues.push({ type: "missing_auth", severity: "HIGH", message: "Delete without authorization", fix: "Add $this->authorize('delete', $model)" });
      fixedCode = fixedCode.replace(/(\$this->authorize\([^)]+\);)?\n(\s+\$.*?->delete\(\);)/, "$this->authorize('delete', $model);\n$2");
    }
    if (code.includes("{!!") && (code.includes("request()") || code.includes("$request"))) {
      issues.push({ type: "xss", severity: "CRITICAL", message: "Unescaped user input", fix: "Replace {!! !!} with {{ }}" });
      fixedCode = fixedCode.replace(/\{!!\s*(.*?)\s*\}\}/g, "{{ $1 }}");
    }
    if (fileType === "blade" && code.includes("@foreach") && !code.includes("wire:key")) {
      issues.push({ type: "missing_wire_key", severity: "MEDIUM", message: "Loop without wire:key", fix: "Add wire:key to loop elements" });
      fixedCode = fixedCode.replace(/(@foreach\([^)]+\))/g, "$1\n    {{-- Add wire:key to child elements --}}");
    }
    if (code.includes("public $") && !code.includes("#[Locked]") && (code.includes("userId") || code.includes("user_id") || code.includes("role"))) {
      issues.push({ type: "unlocked_property", severity: "MEDIUM", message: "Sensitive property not locked", fix: "Add #[Locked] attribute" });
    }
    if (code.includes("DB::raw(") && code.includes("$")) {
      issues.push({ type: "sql_injection", severity: "CRITICAL", message: "DB::raw() with variable interpolation", fix: "Use parameter binding" });
    }
    if (code.includes("public $") && !code.match(/public\s+(string|int|float|bool|array)/)) {
      issues.push({ type: "untyped_property", severity: "LOW", message: "Untyped public property", fix: "Add type declaration" });
    }
    const garbagePatterns = [/\/\/\s*TODO[:\s].*\n/g, /\/\/\s*implement.*\n/g, /lorem\s*ipsum/gi, /placeholder.*code/gi];
    const garbageFound = garbagePatterns.filter(p => p.test(code));
    if (garbageFound.length) {
      issues.push({ type: "garbage_code", severity: "LOW", message: `Garbage code detected: ${garbageFound.length} patterns`, fix: "Remove placeholder/TODO comments" });
      garbageFound.forEach(p => { fixedCode = fixedCode.replace(p, ""); });
    }
    if (issues.length) {
      reportBug({ id: `bug_${Date.now()}`, description: bugDescription || issues.map(i => i.message).join(", "), issues, originalCode: code, fixedCode });
    }
    let output = issues.length === 0 ? "No issues found." : `Found ${issues.length} issue(s):\n\n` + issues.map(i => `[${i.severity}] ${i.type}: ${i.message}\nFix: ${i.fix}`).join("\n\n");
    if (fixedCode !== code) output += `\n\nFixed code:\n${fixedCode}`;
    return { content: [{ type: "text", text: output }] };
  }
);

// ==================== TOOL: Memorize Endpoint ====================
server.tool(
  "memorize_endpoint",
  "Memorize an API endpoint for future reference.",
  {
    path: z.string(),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    controller: z.string(),
    purpose: z.string(),
    params: z.array(z.string()).default([]),
    response: z.string().optional(),
  },
  async ({ path, method, controller, purpose, params, response }) => {
    saveEndpoint({ path, method, controller, purpose, params, response });
    return { content: [{ type: "text", text: `Endpoint memorized: ${method} ${path}` }] };
  }
);

// ==================== TOOL: Recall Context ====================
server.tool(
  "recall_context",
  "Recall memorized endpoints and decisions.",
  { query: z.string() },
  async ({ query }) => {
    const data = getAllMemories();
    const q = query.toLowerCase();
    const relevantEndpoints = data.endpoints.filter(e => e.path.toLowerCase().includes(q) || e.purpose?.toLowerCase().includes(q));
    const relevantMemories = data.memories.filter(m => m.key.toLowerCase().includes(q) || m.value?.toLowerCase().includes(q));
    let output = "";
    if (relevantEndpoints.length) {
      output += "Endpoints:\n" + relevantEndpoints.map(e => `- ${e.method} ${e.path} (${e.purpose})`).join("\n") + "\n";
    }
    if (relevantMemories.length) {
      output += "Memories:\n" + relevantMemories.map(m => `- ${m.key}: ${m.value}`).join("\n") + "\n";
    }
    if (!output) output = "No matching memories found.";
    return { content: [{ type: "text", text: output }] };
  }
);

// ==================== TOOL: Memorize ====================
server.tool(
  "memorize",
  "Store a key-value memory for the project.",
  { key: z.string(), value: z.string() },
  async ({ key, value }) => {
    saveMemory(key, value);
    return { content: [{ type: "text", text: `Memorized: ${key} = ${value}` }] };
  }
);

// ==================== TOOL: Create Version ====================
server.tool(
  "create_version",
  "Create a version snapshot of the current project state.",
  { description: z.string(), files: z.array(z.string()).default([]) },
  async ({ description, files }) => {
    const state = getProjectState();
    const version = saveVersion({ description, files, state });
    return { content: [{ type: "text", text: `Version ${version} created: ${description}` }] };
  }
);

// ==================== TOOL: List Versions ====================
server.tool(
  "list_versions",
  "List all project versions.",
  {},
  async () => {
    const versions = getVersions();
    if (!versions.length) return { content: [{ type: "text", text: "No versions found." }] };
    return { content: [{ type: "text", text: versions.map(v => `${v.version} - ${v.description} (${v.createdAt})`).join("\n") }] };
  }
);

// ==================== TOOL: Restore Version ====================
server.tool(
  "restore_version",
  "Restore project to a previous version.",
  { version: z.string() },
  async ({ version }) => {
    const data = restoreVersion(version);
    if (!data) return { content: [{ type: "text", text: `Version ${version} not found.` }] };
    saveProjectState(data.state);
    return { content: [{ type: "text", text: `Restored to ${version}` }] };
  }
);

// ==================== TOOL: Get Project Status ====================
server.tool(
  "get_project_status",
  "Get current project progress, phases, and task status.",
  {},
  async () => {
    const state = getProjectState();
    if (!state.projectName) return { content: [{ type: "text", text: "No project initialized. Run /plan first." }] };
    const progress = calculateProgress(state);
    let output = `Project: ${state.projectName}\nType: ${state.type}\nProgress: ${progress.complete}% complete | ${progress.incomplete}% incomplete\nTasks: ${progress.done}/${progress.total}\n`;
    if (state.completed) output += `Completed at: ${state.completedAt}\n`;
    state.phases.forEach((phase, i) => {
      const phaseDone = phase.tasks.filter(t => t.status === "complete").length;
      output += `\nPhase ${i + 1}: ${phase.name} (${phaseDone}/${phase.tasks.length})\n`;
      phase.tasks.forEach((task, j) => {
        const icon = task.status === "complete" ? "[x]" : task.status === "in_progress" ? "[~]" : "[ ]";
        output += `  ${icon} ${task.name}\n`;
      });
    });
    return { content: [{ type: "text", text: output }] };
  }
);

// ==================== TOOL: Continue Project ====================
server.tool(
  "continue_project",
  "Continue from last interrupted session.",
  {},
  async () => {
    const state = getProjectState();
    if (!state.interrupted) return { content: [{ type: "text", text: "No interrupted session found. Start a new plan with /plan." }] };
    state.interrupted = false;
    saveProjectState(state);
    const progress = calculateProgress(state);
    const nextPhase = state.phases[state.currentPhase];
    const nextTask = nextPhase?.tasks?.find(t => t.status !== "complete");
    let output = `Session resumed.\nLast action: ${state.lastAction}\nProgress: ${progress.complete}% complete\n`;
    if (nextTask) output += `Next task: ${nextTask.name}\n`;
    return { content: [{ type: "text", text: output }] };
  }
);

// ==================== TOOL: Install Laravel ====================
server.tool(
  "install_laravel",
  "Generate Laravel 13 installation commands with PHP 8.4 upgrade and Livewire setup.",
  {
    projectName: z.string(),
    features: z.array(z.string()).default(["livewire"]),
  },
  async ({ projectName, features }) => {
    const commands = [
      `composer create-project laravel/laravel ${projectName}`,
      `cd ${projectName}`,
      `# Update composer.json: "php": "^8.3" -> "^8.4"`,
      `composer update`,
      `php artisan key:generate`,
      `npm install && npm run build`,
    ];
    if (features.includes("livewire")) {
      commands.push("composer require livewire/livewire:^4.2");
      commands.push("php artisan livewire:publish --config");
    }
    if (features.includes("sanctum")) commands.push("composer require laravel/sanctum && php artisan sanctum:install");
    if (features.includes("pest")) commands.push("composer require pestphp/pest --dev && php artisan pest:install");
    return { content: [{ type: "text", text: commands.join("\n") }] };
  }
);

// ==================== TOOL: Convert Image to Livewire ====================
server.tool(
  "convert_image_to_livewire",
  "Convert an image/mockup description to a Livewire component with matching design.",
  {
    imageDescription: z.string().describe("Describe the layout and components visible in the image"),
    layout: z.string().default("layouts.app"),
    componentName: z.string().optional(),
  },
  async ({ imageDescription, layout, componentName }) => {
    const name = componentName || "image-converted";
    const output = `<?php\n\nuse Livewire\\Component;\nuse Livewire\\Attributes\\{Layout, Title};\n\n#[Layout('${layout}')]\n#[Title('${name}')]\nnew class extends Component {\n    // Based on: ${imageDescription}\n    public function render()\n    {\n        return view('components.${name.replace(/-/g, ".")}');\n    }\n};\n?>\n\n{{-- Convert the image design to this Livewire component --}}\n{{-- Description: ${imageDescription} --}}\n<div class="p-6">\n    <h1 class="text-2xl font-bold mb-4">${name}</h1>\n    {{-- Add your design-matching HTML here --}}\n</div>`;
    return { content: [{ type: "text", text: output }] };
  }
);

// ==================== TOOL: Convert Stitch to Livewire ====================
server.tool(
  "convert_stitch_to_livewire",
  "Convert Google Stitch design to Livewire component.",
  {
    stitchUrl: z.string(),
    componentName: z.string().optional(),
    layout: z.string().default("layouts.app"),
  },
  async ({ stitchUrl, componentName, layout }) => {
    const name = componentName || "stitch-converted";
    return { content: [{ type: "text", text: `Stitch design from: ${stitchUrl}\n\n<?php\n\nuse Livewire\\Component;\nuse Livewire\\Attributes\\Layout;\n\n#[Layout('${layout}')]\nnew class extends Component {\n    public function render()\n    {\n        return view('components.${name.replace(/-/g, ".")}');\n    }\n};\n?>\n\n{{-- Stitch design converted to Livewire --}}\n<div class="p-6">\n    {{-- Add your Stitch design HTML here --}}\n</div>` }] };
  }
);

// ==================== TOOL: Convert Figma to Livewire ====================
server.tool(
  "convert_figma_to_livewire",
  "Convert Figma design to Livewire component.",
  {
    figmaUrl: z.string(),
    componentName: z.string().optional(),
    layout: z.string().default("layouts.app"),
    figmaToken: z.string().optional().describe("Figma API token (optional)"),
  },
  async ({ figmaUrl, componentName, layout, figmaToken }) => {
    const name = componentName || "figma-converted";
    return { content: [{ type: "text", text: `Figma design from: ${figmaUrl}\n\n<?php\n\nuse Livewire\\Component;\nuse Livewire\\Attributes\\Layout;\n\n#[Layout('${layout}')]\nnew class extends Component {\n    public function render()\n    {\n        return view('components.${name.replace(/-/g, ".")}');\n    }\n};\n?>\n\n{{-- Figma design converted to Livewire --}}\n<div class="p-6">\n    {{-- Add your Figma design HTML here --}}\n</div>` }] };
  }
);

// ==================== GIT TOOLS ====================

server.tool(
  "gh_auth_status",
  "Check GitHub CLI authentication status.",
  {},
  async () => {
    if (!checkGHInstalled()) return { content: [{ type: "text", text: "GitHub CLI (gh) not installed.\n\nInstall: winget install GitHub.cli\nOr download: https://cli.github.com/" }] };
    const status = checkGHAuth();
    if (!status.authenticated) return { content: [{ type: "text", text: "Not authenticated with GitHub.\n\nRun: gh auth login --web\n\nOptions:\n- gh auth login --web (recommended)\n- gh auth login --with-token" }] };
    return { content: [{ type: "text", text: status.status }] };
  }
);

server.tool(
  "gh_auth_login",
  "Authenticate with GitHub CLI.",
  { method: z.enum(["web", "token"]).default("web") },
  async ({ method }) => {
    if (!checkGHInstalled()) return { content: [{ type: "text", text: "GitHub CLI (gh) not installed.\n\nInstall: winget install GitHub.cli" }] };
    const cmd = method === "web" ? "gh auth login --web" : "gh auth login --with-token";
    return { content: [{ type: "text", text: `Run: ${cmd}\n\nFor web: A browser will open for authentication.\nFor token: Paste your GitHub personal access token.` }] };
  }
);

server.tool(
  "gh_repo_create",
  "Create a new GitHub repository and set up remote.",
  { name: z.string(), description: z.string().default(""), visibility: z.enum(["private", "public"]).default("private") },
  async ({ name, description, visibility }) => {
    if (!checkGHInstalled()) return { content: [{ type: "text", text: "GitHub CLI (gh) not installed." }] };
    const auth = ensureGHAuth();
    if (auth.needsLogin) return { content: [{ type: "text", text: auth.message }] };
    const result = createGitHubRepo(name, { description, visibility });
    return { content: [{ type: "text", text: result.success ? result.message : result.error }] };
  }
);

server.tool(
  "git_commit",
  "Stage and commit files with auto-generated conventional commit message.",
  { files: z.array(z.string()).default([]), message: z.string().default(""), autoGenerate: z.boolean().default(true) },
  async ({ files, message, autoGenerate }) => {
    const state = getProjectState();
    const result = gitCommit(files, message, autoGenerate ? state : null);
    return { content: [{ type: "text", text: result.success ? `Committed successfully.\n\n${result.commitMessage}` : result.error }] };
  }
);

server.tool(
  "git_push",
  "Push commits to remote repository.",
  { remote: z.string().default("origin"), branch: z.string().default("") },
  async ({ remote, branch }) => {
    const result = gitPush(remote, branch);
    return { content: [{ type: "text", text: result.success ? result.message : result.error }] };
  }
);

server.tool(
  "git_pull",
  "Pull latest changes from remote repository.",
  { remote: z.string().default("origin"), branch: z.string().default("") },
  async ({ remote, branch }) => {
    const result = gitPull(remote, branch);
    return { content: [{ type: "text", text: result.success ? result.message : result.error }] };
  }
);

server.tool(
  "git_tag_create",
  "Create an annotated git tag with description.",
  { version: z.string(), description: z.string().default("") },
  async ({ version, description }) => {
    const state = getProjectState();
    const result = createVersionTag(version, description, state);
    return { content: [{ type: "text", text: result.success ? result.message : result.error }] };
  }
);

server.tool(
  "git_tag_list",
  "List all git tags.",
  {},
  async () => {
    const result = listTags();
    return { content: [{ type: "text", text: result.success ? (result.tags.join("\n") || "No tags found") : result.error }] };
  }
);

server.tool(
  "git_status",
  "Show current git status.",
  {},
  async () => {
    const status = gitStatus();
    if (status.error) return { content: [{ type: "text", text: status.error }] };
    const lines = [`Branch: ${status.branch}`, status.hasChanges ? `\nChanges:\n${status.changes}` : "\nWorking tree clean", status.remotes ? `\nRemotes:\n${status.remotes}` : "\nNo remote configured"];
    return { content: [{ type: "text", text: lines.join("") }] };
  }
);

server.tool(
  "git_branch_create",
  "Create a new git branch.",
  { name: z.string(), from: z.string().default("") },
  async ({ name, from }) => {
    const result = gitCreateBranch(name, from);
    return { content: [{ type: "text", text: result.success ? result.message : result.error }] };
  }
);

server.tool(
  "git_branch_list",
  "List all git branches.",
  {},
  async () => {
    const result = gitListBranches();
    return { content: [{ type: "text", text: result.success ? result.branches.join("\n") : result.error }] };
  }
);

server.tool(
  "git_branch_merge",
  "Merge a branch into current.",
  { branch: z.string() },
  async ({ branch }) => {
    const result = gitMergeBranch(branch);
    return { content: [{ type: "text", text: result.success ? result.message : result.error }] };
  }
);

server.tool(
  "git_branch_delete",
  "Delete a git branch.",
  { name: z.string(), force: z.boolean().default(false) },
  async ({ name, force }) => {
    const result = gitDeleteBranch(name, force);
    return { content: [{ type: "text", text: result.success ? result.message : result.error }] };
  }
);

server.tool(
  "gh_pr_create",
  "Create a Pull Request.",
  { title: z.string().default(""), body: z.string().default(""), base: z.string().default("main"), head: z.string().default(""), draft: z.boolean().default(false) },
  async ({ title, body, base, head, draft }) => {
    const result = createPullRequest({ title, body, base, head, draft });
    return { content: [{ type: "text", text: result.success ? result.message : result.error }] };
  }
);

server.tool(
  "gh_pr_list",
  "List Pull Requests.",
  { state: z.enum(["open", "closed", "all"]).default("open") },
  async ({ state }) => {
    const result = listPullRequests(state);
    if (!result.success) return { content: [{ type: "text", text: result.error }] };
    return { content: [{ type: "text", text: result.prs.map(pr => `#${pr.number}: ${pr.title} (${pr.headRefName})`).join("\n") || "No PRs found." }] };
  }
);

server.tool(
  "gh_pr_merge",
  "Merge a Pull Request.",
  { number: z.number(), method: z.enum(["merge", "squash", "rebase"]).default("merge") },
  async ({ number, method }) => {
    const result = mergePullRequest(number, method);
    return { content: [{ type: "text", text: result.success ? result.message : result.error }] };
  }
);

server.tool(
  "gh_issue_create",
  "Create a GitHub Issue.",
  { title: z.string(), body: z.string(), labels: z.array(z.string()).default([]) },
  async ({ title, body, labels }) => {
    if (!checkGHInstalled()) return { content: [{ type: "text", text: "GitHub CLI not installed." }] };
    const auth = ensureGHAuth();
    if (auth.needsLogin) return { content: [{ type: "text", text: auth.message }] };
    try {
      const labelFlag = labels.length ? ` --label "${labels.join(",")}"` : "";
      const cmd = `gh issue create --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"${labelFlag}`;
      execSync(cmd, { stdio: "pipe" });
      return { content: [{ type: "text", text: `Issue created: ${title}` }] };
    } catch (e) {
      return { content: [{ type: "text", text: e.stderr?.toString() || e.message }] };
    }
  }
);

server.tool(
  "gh_issue_list",
  "List GitHub Issues.",
  { state: z.enum(["open", "closed", "all"]).default("open") },
  async ({ state }) => {
    const result = listIssues(state);
    if (!result.success) return { content: [{ type: "text", text: result.error }] };
    return { content: [{ type: "text", text: result.issues.map(i => `#${i.number}: ${i.title}`).join("\n") || "No issues found." }] };
  }
);

server.tool(
  "gh_release_create",
  "Create a GitHub Release.",
  { tag: z.string(), title: z.string(), notes: z.string() },
  async ({ tag, title, notes }) => {
    if (!checkGHInstalled()) return { content: [{ type: "text", text: "GitHub CLI not installed." }] };
    try {
      const cmd = `gh release create ${tag} --title "${title.replace(/"/g, '\\"')}" --notes "${notes.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
      execSync(cmd, { stdio: "pipe" });
      return { content: [{ type: "text", text: `Release ${tag} created` }] };
    } catch (e) {
      return { content: [{ type: "text", text: e.stderr?.toString() || e.message }] };
    }
  }
);

server.tool(
  "gh_ci_setup",
  "Setup GitHub Actions CI for Laravel.",
  {},
  async () => {
    const result = createGitHubActions();
    return { content: [{ type: "text", text: result.success ? `Workflow created at: ${result.path}\n\n${result.content}` : result.error }] };
  }
);

server.tool(
  "git_sync",
  "Manual sync: commit + push + tag if needed.",
  {},
  async () => {
    const state = getProjectState();
    const commitResult = gitCommit([], null, state);
    const status = gitStatus();
    let pushResult = null;
    if (status.remotes) pushResult = gitPush();
    let output = `Sync:\n- Commit: ${commitResult.success ? "OK" : commitResult.error}\n`;
    if (pushResult) output += `- Push: ${pushResult.success ? "OK" : pushResult.error}\n`;
    return { content: [{ type: "text", text: output }] };
  }
);

server.tool(
  "git_auto_sync_toggle",
  "Toggle auto-sync on task completion.",
  {},
  async () => {
    const state = getProjectState();
    state.autoSync = !state.autoSync;
    saveProjectState(state);
    return { content: [{ type: "text", text: `Auto-sync ${state.autoSync ? "enabled" : "disabled"}` }] };
  }
);

server.tool(
  "git_full_setup",
  "Complete git workflow: auth check -> init -> create repo -> commit -> push -> tag.",
  { repoName: z.string(), description: z.string().default(""), visibility: z.enum(["private", "public"]).default("private") },
  async ({ repoName, description, visibility }) => {
    if (!checkGHInstalled()) return { content: [{ type: "text", text: "GitHub CLI (gh) not installed.\n\nInstall: winget install GitHub.cli\nOr download: https://cli.github.com/" }] };
    const state = getProjectState();
    const result = fullGitWorkflow(repoName, { description, visibility, projectState: state });
    if (result.step === "auth") return { content: [{ type: "text", text: result.message }] };
    const output = result.results.map(r => `${r.step}: ${r.success ? "OK" : r.error || r.status || r.message}`).join("\n");
    return { content: [{ type: "text", text: `Git setup complete:\n${output}` }] };
  }
);

// ==================== TOOL: Deep Scan Bugs ====================
server.tool(
  "deep_scan_bugs",
  "Comprehensive bug scanner for Livewire/Laravel - tables, item lists, file lists, pagination, validation, security, types, and more.",
  {
    code: z.string().describe("Code to scan for bugs"),
    fileType: z.enum(["php", "blade", "component", "model", "table", "list", "file"]),
    scanMode: z.enum(["all", "tables", "lists", "files", "security", "validation", "types"]).default("all"),
  },
  async ({ code, fileType, scanMode }) => {
    const issues = [];
    const tablePatterns = [
      { regex: /<table[\s\S]*?<\/table>/gi, check: /wire:key/, msg: "Table without wire:key on rows", severity: "HIGH" },
      { regex: /<tr[\s\S]*?<\/tr>/gi, check: /wire:key/, msg: "TR element missing wire:key", severity: "HIGH" },
      { regex: /@foreach\([^)]+\)/g, check: /wire:key/, msg: "@foreach loop without wire:key", severity: "HIGH" },
      { regex: /@forelse\([^)]+\)/g, check: /wire:key/, msg: "@forelse loop without wire:key", severity: "HIGH" },
      { regex: /@for\([^)]+\)/g, check: /wire:key/, msg: "@for loop without wire:key", severity: "MEDIUM" },
      { regex: /<tbody/, check: /wire:model/, msg: "tbody with wire:model - consider using wire:key on rows", severity: "LOW" },
      { regex: /<td[\s\S]*?wire:click/, check: null, msg: "td with wire:click - consider wrapping in button or adding wire:key", severity: "MEDIUM" },
      { regex: /<th[\s\S]*?wire:click/, check: null, msg: "Sortable header - ensure sortBy method exists", severity: "LOW" },
    ];
    const listPatterns = [
      { regex: /<ul[\s\S]*?<\/ul>/gi, check: /wire:key/, msg: "UL list without wire:key on LI", severity: "HIGH" },
      { regex: /<ol[\s\S]*?<\/ol>/gi, check: /wire:key/, msg: "OL list without wire:key on LI", severity: "HIGH" },
      { regex: /<li[^>]*>/gi, check: /wire:key/, msg: "LI element missing wire:key", severity: "HIGH" },
      { regex: /<div[^>]*class="[^"]*grid[^"]*"[^>]*>/gi, check: /wire:key/, msg: "Grid items without wire:key", severity: "HIGH" },
      { regex: /<div[^>]*class="[^"]*flex[^"]*"[^>]*>/gi, check: /wire:key/, msg: "Flex items without wire:key", severity: "HIGH" },
      { regex: /@foreach.*\$_/g, check: null, msg: "Loop using direct $_POST/$_GET input - validate first", severity: "CRITICAL" },
      { regex: /@foreach.*\$request/g, check: null, msg: "Loop using $request directly - validate first", severity: "CRITICAL" },
    ];
    const filePatterns = [
      { regex: /wire:model.*file/g, check: /WithFileUploads/, msg: "File upload without WithFileUploads trait", severity: "CRITICAL" },
      { regex: /wire:model.*file/g, check: /mimes:/, msg: "File upload without MIME validation", severity: "HIGH" },
      { regex: /wire:model.*file/g, check: /max:/, msg: "File upload without size limit", severity: "HIGH" },
      { regex: /\$_FILES/g, check: null, msg: "Direct $_FILES access - use Livewire file upload", severity: "HIGH" },
      { regex: /->store\(/g, check: null, msg: "File store - ensure validation includes file type", severity: "MEDIUM" },
      { regex: /->storeAs\(/g, check: null, msg: "File storeAs - ensure validation includes file type", severity: "MEDIUM" },
      { regex: /temporaryUrl\(\)/g, check: null, msg: "Using temporaryUrl - verify file exists first", severity: "LOW" },
      { regex: /getClientOriginalName\(\)/g, check: null, msg: "Using original filename - security risk, use hashed name", severity: "MEDIUM" },
    ];
    const validationPatterns = [
      { regex: /->create\(/g, check: /validate|Validate/, msg: "create() without validation", severity: "CRITICAL" },
      { regex: /->update\(/g, check: /validate|Validate/, msg: "update() without validation", severity: "CRITICAL" },
      { regex: /->firstOrCreate\(/g, check: /validate|Validate/, msg: "firstOrCreate without validation", severity: "HIGH" },
      { regex: /->updateOrCreate\(/g, check: /validate|Validate/, msg: "updateOrCreate without validation", severity: "HIGH" },
      { regex: /->fill\(/g, check: /validate|Validate/, msg: "fill() without validation", severity: "HIGH" },
      { regex: /public function save\(/g, check: /validate/, msg: "save() method without $this->validate()", severity: "HIGH" },
      { regex: /public function store\(/g, check: /validate/, msg: "store() method without $this->validate()", severity: "HIGH" },
      { regex: /public function update\(/g, check: /validate/, msg: "update() method without $this->validate()", severity: "HIGH" },
    ];
    const authPatterns = [
      { regex: /->delete\(\)/g, check: /authorize/, msg: "delete() without authorization check", severity: "CRITICAL" },
      { regex: /->forceDelete\(\)/g, check: /authorize/, msg: "forceDelete() without authorization", severity: "CRITICAL" },
      { regex: /->restore\(\)/g, check: /authorize/, msg: "restore() without authorization", severity: "HIGH" },
      { regex: /public function delete\(/g, check: /authorize/, msg: "delete() method without $this->authorize()", severity: "HIGH" },
      { regex: /public function destroy\(/g, check: /authorize/, msg: "destroy() method without $this->authorize()", severity: "HIGH" },
      { regex: /Gate::allows/g, check: null, msg: "Using Gate::allows - ensure proper policy", severity: "MEDIUM" },
      { regex: /\$this->can\(/g, check: null, msg: "Using $this->can() - ensure policy exists", severity: "MEDIUM" },
    ];
    const securityPatterns = [
      { regex: /\{!!/g, check: null, msg: "Unescaped output {!! !!} - XSS risk", severity: "CRITICAL" },
      { regex: /DB::raw\(/g, check: /\$.*[+\-*/]/g, msg: "DB::raw() with variable - SQL injection risk", severity: "CRITICAL" },
      { regex: /\$_GET/g, check: null, msg: "Direct $_GET access - use request()->get()", severity: "HIGH" },
      { regex: /\$_POST/g, check: null, msg: "Direct $_POST access - use $this->validate()", severity: "HIGH" },
      { regex: /\$guarded\s*=\s*\[\]/g, check: null, msg: "Empty $guarded array - mass assignment risk", severity: "HIGH" },
      { regex: /#[Unguarded]/g, check: null, msg: "#[Unguarded] attribute - mass assignment risk", severity: "HIGH" },
      { regex: /exec\(/g, check: null, msg: "exec() function - command injection risk", severity: "CRITICAL" },
      { regex: /shell_exec\(/g, check: null, msg: "shell_exec() - command injection risk", severity: "CRITICAL" },
      { regex: /system\(/g, check: null, msg: "system() - command injection risk", severity: "CRITICAL" },
      { regex: /passthru\(/g, check: null, msg: "passthru() - command injection risk", severity: "CRITICAL" },
      { regex: /eval\(/g, check: null, msg: "eval() - code injection risk", severity: "CRITICAL" },
      { regex: /serialize\(/g, check: /unserialize/g, msg: "serialize() paired with unserialize() - unserialize vulnerability", severity: "HIGH" },
      { regex: /redirect\(\$_/g, check: null, msg: "Redirect to user input - open redirect vulnerability", severity: "HIGH" },
      { regex: /redirect\(request\(/g, check: null, msg: "Redirect to request input - open redirect vulnerability", severity: "HIGH" },
    ];
    const typePatterns = [
      { regex: /public\s+\$/g, check: /public\s+(string|int|float|bool|array|mixed)/, msg: "Untyped public property - add type declaration", severity: "LOW" },
      { regex: /public\s+\$\w+\s*=/g, check: /public\s+(string|int|float|bool|array|mixed)\s+\$\w+/, msg: "Property without type hint", severity: "LOW" },
      { regex: /function\s+\w+\(\s*\)/g, check: /function\s+\w+\(\s*\):\s*(void|string|int|bool|array|mixed)/, msg: "Method without return type", severity: "LOW" },
      { regex: /\$\w+\s*=\s*\$_/g, check: null, msg: "Assigning superglobal to variable without sanitization", severity: "HIGH" },
    ];
    const paginationPatterns = [
      { regex: /wire:model\.live.*search/g, check: /resetPage/, msg: "Search without pagination reset - results may be empty", severity: "HIGH" },
      { regex: /wire:model.*filter/g, check: /resetPage/, msg: "Filter without pagination reset - results may be empty", severity: "HIGH" },
      { regex: /updating\w+\(\)/g, check: /resetPage/, msg: "Updating method without resetPage() call", severity: "MEDIUM" },
      { regex: /WithPagination/g, check: /resetPage/, msg: "Using pagination but no resetPage() found", severity: "MEDIUM" },
    ];
    const modelPatterns = [
      { regex: /class\s+\w+\s+extends\s+Model/g, check: /protected\s+\$/, msg: "Model without property declarations", severity: "LOW" },
      { regex: /class\s+\w+\s+extends\s+Model/g, check: /#[Fillable]/, msg: "Model without #[Fillable] - all fields mass assignable", severity: "HIGH" },
      { regex: /public\s+\$fillable/g, check: null, msg: "Using $fillable instead of #[Fillable] attribute", severity: "LOW" },
      { regex: /public\s+\$table/g, check: null, msg: "Using $table property instead of #[Table] attribute", severity: "LOW" },
      { regex: /public\s+\$timestamps/g, check: null, msg: "Using $timestamps property instead of #[WithoutTimestamps]", severity: "LOW" },
      { regex: /public\s+\$with/g, check: null, msg: "Using $with for eager loading - consider with() in queries", severity: "LOW" },
      { regex: /->find\(\)/g, check: /findOrFail/, msg: "Using find() instead of findOrFail() - may return null", severity: "MEDIUM" },
    ];
    const livewirePatterns = [
      { regex: /wire:click.*delete/g, check: /wire:confirm/, msg: "Delete action without wire:confirm", severity: "MEDIUM" },
      { regex: /wire:model/g, check: /#[Validate]/, msg: "wire:model without #[Validate] attribute", severity: "MEDIUM" },
      { regex: /#[Computed]/g, check: null, msg: "Computed property - ensure called via $this->computed", severity: "LOW" },
      { regex: /wire:poll/g, check: null, msg: "Using wire:poll - ensure it doesn't overload server", severity: "LOW" },
      { regex: /wire:init/g, check: null, msg: "Using wire:init - prefer mount() method", severity: "LOW" },
      { regex: /\$refresh/g, check: null, msg: "Using $refresh - consider targeted refresh", severity: "LOW" },
    ];
    let patterns = [];
    if (scanMode === "all" || scanMode === "tables") patterns.push(...tablePatterns);
    if (scanMode === "all" || scanMode === "lists") patterns.push(...listPatterns);
    if (scanMode === "all" || scanMode === "files") patterns.push(...filePatterns);
    if (scanMode === "all" || scanMode === "validation") patterns.push(...validationPatterns);
    if (scanMode === "all" || scanMode === "security") patterns.push(...securityPatterns);
    if (scanMode === "all" || scanMode === "types") patterns.push(...typePatterns);
    patterns.push(...paginationPatterns, ...modelPatterns, ...livewirePatterns);
    if (fileType === "component" || fileType === "php") {
      patterns.push(...validationPatterns.filter(p => !p.regex.source.includes("validate")));
      patterns.push(...authPatterns);
    }
    if (fileType === "blade") {
      patterns.push(...tablePatterns.filter(p => p.regex.source.includes("<table")));
      patterns.push(...listPatterns);
      patterns.push(...securityPatterns.filter(p => p.regex.source.includes("{!!")));
    }
    if (fileType === "model") {
      patterns.push(...modelPatterns);
    }
    patterns.forEach(p => {
      const matches = code.match(p.regex);
      if (matches) {
        matches.forEach((match, idx) => {
          if (p.check === null || !p.check.test(code)) {
            const exists = !issues.find(i => i.type === p.msg && i.severity === p.severity);
            if (exists) {
              issues.push({
                type: p.msg,
                severity: p.severity,
                match: match.substring(0, 80) + (match.length > 80 ? "..." : ""),
                fix: getFixForIssue(p.msg),
                line: countOccurrences(code.substring(0, code.indexOf(match)), "\n") + 1,
              });
            }
          }
        });
      }
    });
    const grouped = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] };
    issues.forEach(i => grouped[i.severity].push(i));
    let output = issues.length === 0 ? "✅ No bugs found!" : `🐛 Found ${issues.length} issue(s):\n`;
    Object.keys(grouped).forEach(sev => {
      if (grouped[sev].length) {
        output += `\n${sev} (${grouped[sev].length}):\n`;
        grouped[sev].forEach((i, idx) => {
          output += `  ${idx + 1}. ${i.type}\n     Line ~${i.line}\n     ${i.match}\n     Fix: ${i.fix}\n`;
        });
      }
    });
    return { content: [{ type: "text", text: output }] };
  }
);

function getFixForIssue(msg) {
  const fixes = {
    "Table without wire:key on rows": "Add wire:key=\"{{ $item->id }}\" to TR or first child element",
    "TR element missing wire:key": "Add wire:key to TR: wire:key=\"{{ $item->id }}\"",
    "@foreach loop without wire:key": "Add wire:key=\"{{ $item->id }}\" to loop element",
    "@forelse loop without wire:key": "Add wire:key=\"{{ $item->id }}\" to loop element",
    "UL list without wire:key on LI": "Add wire:key to each LI element",
    "LI element missing wire:key": "Add wire:key=\"{{ $item->id }}\" to LI",
    "Grid items without wire:key": "Add wire:key=\"{{ $item->id }}\" to grid items",
    "create() without validation": "Add $this->validate([...]) or #[Validate] before create()",
    "update() without validation": "Add $this->validate([...]) or #[Validate] before update()",
    "delete() without authorization check": "Add $this->authorize('delete', $model) before delete()",
    "Unescaped output {!! !!} - XSS risk": "Replace {!! $var !!} with {{ $var }}",
    "DB::raw() with variable - SQL injection risk": "Use parameter binding or Eloquent query builder",
    "File upload without WithFileUploads trait": "Add 'use WithFileUploads;' trait to component",
    "File upload without MIME validation": "Add validation: mimes:jpg,png,pdf",
    "Untyped public property - add type declaration": "Add type: public string $title = '';",
    "Search without pagination reset - results may be empty": "Add $this->resetPage() in updatingSearch()",
  };
  return fixes[msg] || "Review and fix manually";
}

function countOccurrences(str, sub) {
  return str.split(sub).length - 1;
}

// ==================== TOOL: Get Fixed Bugs ====================
server.tool(
  "get_fixed_bugs",
  "Get list of all bugs that have been fixed.",
  { filter: z.enum(["all", "critical", "high", "medium", "low"]).default("all") },
  async ({ filter }) => {
    const bugs = getOpenBugs();
    const fixedBugs = bugs.filter(b => b.status === "fixed");
    if (!fixedBugs.length) return { content: [{ type: "text", text: "No fixed bugs found." }] };
    let filtered = fixedBugs;
    if (filter !== "all") {
      filtered = fixedBugs.filter(b => b.severity === filter.toUpperCase());
    }
    if (!filtered.length) return { content: [{ type: "text", text: `No ${filter} severity bugs found.` }] };
    let output = `🔧 Fixed Bugs (${filtered.length}):\n\n`;
    filtered.forEach((bug, idx) => {
      output += `${idx + 1}. [${bug.severity}] ${bug.description}\n`;
      output += `   Fixed: ${bug.fixedAt || "N/A"}\n`;
      output += `   Issues: ${bug.issues?.length || 0}\n\n`;
    });
    return { content: [{ type: "text", text: output }] };
  }
);

// ==================== TOOL: Get Open Bugs ====================
server.tool(
  "get_open_bugs",
  "Get list of all open (unfixed) bugs.",
  { filter: z.enum(["all", "critical", "high", "medium", "low"]).default("all") },
  async ({ filter }) => {
    const bugs = getOpenBugs();
    const openBugs = bugs.filter(b => b.status !== "fixed");
    if (!openBugs.length) return { content: [{ type: "text", text: "No open bugs found. ✅" }] };
    let filtered = openBugs;
    if (filter !== "all") {
      filtered = openBugs.filter(b => b.severity === filter.toUpperCase());
    }
    if (!filtered.length) return { content: [{ type: "text", text: `No ${filter} open bugs found.` }] };
    let output = `🐛 Open Bugs (${filtered.length}):\n\n`;
    filtered.forEach((bug, idx) => {
      output += `${idx + 1}. [${bug.severity}] ${bug.description}\n`;
      output += `   Status: ${bug.status}\n`;
      output += `   Reported: ${bug.reportedAt || "N/A"}\n\n`;
    });
    return { content: [{ type: "text", text: output }] };
  }
);

// ==================== TOOL: Mark Bug Fixed ====================
server.tool(
  "mark_bug_fixed",
  "Mark a bug as fixed by bug ID.",
  { bugId: z.string() },
  async ({ bugId }) => {
    const result = markBugFixed(bugId);
    return { content: [{ type: "text", text: result ? `Bug ${bugId} marked as fixed.` : `Bug ${bugId} not found.` }] };
  }
);

// ==================== TOOL: Scan Project for Bugs ====================
server.tool(
  "scan_project_bugs",
  "Scan entire project directory for common bugs in all files.",
  { directory: z.string().default("./app") },
  async ({ directory }) => {
    const issues = [];
    const commonBugs = [
      { pattern: /wire:model/g, check: /#[Validate]/, fileTypes: ["blade"], msg: "wire:model without #[Validate]" },
      { pattern: /@foreach/g, check: /wire:key/, fileTypes: ["blade"], msg: "@foreach without wire:key" },
      { pattern: /->create\(/g, check: /validate/, fileTypes: ["php", "component"], msg: "create() without validation" },
      { pattern: /->delete\(\)/g, check: /authorize/, fileTypes: ["php", "component"], msg: "delete() without authorize" },
      { pattern: /\{!!/g, check: null, fileTypes: ["blade"], msg: "Unescaped output {!! !!}" },
      { pattern: /DB::raw\(/g, check: /\$/, fileTypes: ["php"], msg: "DB::raw() with variable" },
      { pattern: /public\s+\$/g, check: /public\s+(string|int|bool|array)/, fileTypes: ["php", "component"], msg: "Untyped property" },
      { pattern: /wire:model.*file/g, check: /WithFileUploads/, fileTypes: ["blade", "php", "component"], msg: "File upload without WithFileUploads" },
    ];
    let output = `Scanning ${directory} for bugs...\n`;
    output += `\nThis is a placeholder - actual file scanning requires filesystem access.\n`;
    output += `Add common patterns: ${commonBugs.length}\n`;
    output += `\nTo scan files, provide file contents or use deep_scan_bugs tool.`;
    return { content: [{ type: "text", text: output }] };
  }
);

// ==================== TOOL: Generate Enum ====================
server.tool(
  "generate_enum",
  "Generate a Laravel 13 backed enum with string/int values, labels, colors, and helper methods.",
  {
    enumName: z.string().describe("Enum name e.g. 'PostStatus'"),
    type: z.enum(["string", "int"]).default("string"),
    values: z.array(z.object({ 
      name: z.string(), 
      value: z.string().optional(),
      label: z.string().optional(),
      color: z.string().optional()
    })).default([]),
  },
  async ({ enumName, type, values }) => {
    const enumValues = values.map(v => {
      const val = type === "string" ? `'${v.value || v.name.toLowerCase()}'` : v.value || 0;
      return `    case ${v.name} = ${val};`;
    }).join("\n");
    
    const labels = values.map(v => `            self::${v.name} => '${v.label || toTitleCase(v.name)}',`).join("\n");
    const colors = values.map(v => `            self::${v.name} => '${v.color || "gray"}',`).join("\n");
    const names = values.map(v => `            self::${v.name} => '${v.name}',`).join("\n");
    
    const code = `<?php\n\nnamespace App\\Enums;\n\nuse Illuminate\\Support\\Arr;\n\nenum ${enumName}: ${type}\n{\n${enumValues}\n\n    public function label(): string\n    {\n        return match($this)\n        {\n${labels}\n        };\n    }\n\n    public function color(): string\n    {\n        return match($this)\n        {\n${colors}\n        };\n    }\n\n    public static function fromName(string $name): ?self\n    {\n        return Arr::first(self::cases(), fn($case) => $case->name === $name);\n    }\n\n    public static function labels(): array\n    {\n        return array_combine(\n            array_column(self::cases(), 'name'),\n            array_map(fn($case) => $case->label(), self::cases())\n        );\n    }\n\n    public static function options(): array\n    {\n        return array_combine(\n            array_map(fn($case) => $case->value, self::cases()),\n            array_map(fn($case) => $case->label(), self::cases())\n        );\n    }\n}`;
    
    return { content: [{ type: "text", text: code }] };
  }
);

// ==================== TOOL: Generate API Resource ====================
server.tool(
  "generate_api_resource",
  "Generate a Laravel 13 API Resource with relationships, meta, pagination, and conditional loading.",
  {
    resourceName: z.string().describe("Resource name e.g. 'PostResource'"),
    modelClass: z.string().describe("Full model class e.g. 'App\\Models\\Post'"),
    fields: z.array(z.object({ name: z.string(), type: z.string().default("string"), hidden: z.boolean().default(false) })).default([]),
    relationships: z.array(z.object({ name: z.string(), resource: z.string() })).default([]),
    withMeta: z.boolean().default(false),
    withPagination: z.boolean().default(false),
  },
  async ({ resourceName, modelClass, fields, relationships, withMeta, withPagination }) => {
    const model = extractModelInfo(modelClass);
    
    const fieldMap = fields
      .filter(f => !f.hidden)
      .map(f => `            '${f.name}' => $this->${f.name},`)
      .join("\n");
    
    const relMap = relationships
      .map(r => `            '${r.name}' => ${r.resource}::collection($this->whenLoaded('${r.name}')),`)
      .join("\n");
    
    const meta = withMeta ? `\n\n    public function with($request): array\n    {\n        return [\n            'timestamp' => now()->toIso8601String(),\n            'version' => '1.0.0',\n        ];\n    }` : '';
    
    const paginator = withPagination ? `\n\n    public static function collectionUsing($resource, $paginatedResponse)\n    {\n        return $paginatedResponse->additional([\n            'meta' => [\n                'current_page' => $resource->currentPage(),\n                'last_page' => $resource->lastPage(),\n                'per_page' => $resource->perPage(),\n                'total' => $resource->total(),\n            ],\n        ]);\n    }` : '';
    
    const code = `<?php\n\nnamespace App\\Http\\Resources;\n\nuse Illuminate\\Http\\Resources\\Json\\JsonResource;\nuse Illuminate\\Http\\Resources\\ConditionallyLoadsAttributes;\n\nclass ${resourceName} extends JsonResource\n{\n    use ConditionallyLoadsAttributes;\n\n    public function toArray($request): array\n    {\n        return [\n            'id' => $this->id,\n${fieldMap}\n${relMap ? "\n" + relMap : ""}\n            'created_at' => $this->created_at?->toIso8601String(),\n            'updated_at' => $this->updated_at?->toIso8601String(),\n        ];\n    }${meta}${paginator}\n}`;
    
    return { content: [{ type: "text", text: code }] };
  }
);

// ==================== TOOL: Generate Mailable ====================
server.tool(
  "generate_mail",
  "Generate a Laravel 13 Mailable class with markdown templates, attachments, and queue support.",
  {
    mailName: z.string().describe("Mail class name e.g. 'WelcomeEmail'"),
    subject: z.string().describe("Email subject"),
    recipient: z.string().optional().describe("Recipient type or placeholder"),
    hasAttachment: z.boolean().default(false),
    hasQueue: z.boolean().default(false),
    markdownTemplate: z.boolean().default(true),
  },
  async ({ mailName, subject, recipient, hasAttachment, hasQueue, markdownTemplate }) => {
    const queueImport = hasQueue ? "\nuse Illuminate\\Bus\\Queueable;" : '';
    const queueTrait = hasQueue ? "\n    use Queueable;" : '';
    const queueImpl = hasQueue ? 'ShouldQueue' : '';
    const implSeparator = hasQueue ? ' implements ' : '';
    
    const attachmentCode = hasAttachment ? `\n\n    public function attachments(): array\n    {\n        return [\n            // Attachment::fromStorage('path/to/file'),\n            // Storage::disk('s3')->path('file.pdf'),\n        ];\n    }` : '';
    
    const markdownContent = markdownTemplate ? `\n\n    public function build(): static\n    {\n        return $this->subject('${subject}')\n            ->view('emails.${mailName.toLowerCase()}')\n            ->markdown('emails.${mailName.toLowerCase()}');\n    }` : `\n\n    public function build(): static\n    {\n        return $this->subject('${subject}')\n            ->view('emails.${mailName.toLowerCase()}');\n    }`;
    
    const code = `<?php\n\nnamespace App\\Mail;${queueImport}\n\nuse Illuminate\\Mail\\Mailable;\nuse Illuminate\\Mail\\Mailables\\Content;\nuse Illuminate\\Mail\\Mailables\\Envelope;\nuse Illuminate\\Mail\\Mailables\\Address;\n\nclass ${mailName} extends Mailable${implSeparator}${queueImpl}\n{${queueTrait}\n\n    public function __construct(\n        // protected User $user,\n        // Add your dependencies here\n    )\n    {\n        //\n    }\n\n    public function envelope(): Envelope\n    {\n        return new Envelope(\n            from: new Address('noreply@example.com', config('app.name')),\n            subject: '${subject}',\n        );\n    }\n\n    public function content(): Content\n    {\n        return new Content(\n            view: 'emails.${mailName.toLowerCase()}',\n        );\n    }${attachmentCode}\n}`;
    
    return { content: [{ type: "text", text: code }] };
  }
);

// ==================== TOOL: Generate Job ====================
server.tool(
  "generate_job",
  "Generate a Laravel 13.2 queued job with #[Queue], #[Connection], #[Backoff] attributes, enum support, and retry handling.",
  {
    jobName: z.string().describe("Job class name e.g. 'ProcessOrder'"),
    queue: z.string().default("default").describe("Queue name or enum case"),
    connection: z.string().optional().describe("Queue connection or enum case"),
    backoff: z.array(z.number()).optional().describe("Retry backoff delays (Laravel 13.2 variadic #[Backoff])"),
    tries: z.number().default(3).describe("Maximum retry attempts"),
    timeout: z.number().optional().describe("Job timeout in seconds"),
    unique: z.boolean().default(false).describe("Should job be unique"),
    properties: z.array(z.object({ name: z.string(), type: z.string().optional() })).default([]),
  },
  async ({ jobName, queue, connection, backoff, tries, timeout, unique, properties }) => {
    const backoffAttr = backoff?.length ? `\n#[Backoff(${backoff.join(', ')})]` : '';
    const queueAttr = `\n#[Queue('${queue}')]`;
    const connectionAttr = connection ? `\n#[Connection('${connection}')]` : '';
    const timeoutAttr = timeout ? `\n#[Timeout(${timeout})]` : '';
    const uniqueAttr = unique ? '\n#[Unique]' : '';
    
    const props = properties.map(p => `    public ${p.type || 'mixed'} $${p.name};`).join('\n');
    const constructorParams = properties.map(p => `public ${p.type || 'mixed'} $${p.name}`).join(', ');
    const constructorAssign = properties.map(p => `        $this->${p.name} = $${p.name};`).join('\n');
    
    const code = `<?php\n\nnamespace App\\Jobs;\n\nuse Illuminate\\Bus\\Queueable;\nuse Illuminate\\Contracts\\Queue\\ShouldQueue;\nuse Illuminate\\Foundation\\Bus\\Dispatchable;\nuse Illuminate\\Queue\\InteractsWithQueue;\nuse Illuminate\\Queue\\SerializesModels;\nuse Illuminate\\Queue\\Attributes\\{Queue, Connection, Backoff, Timeout, Unique};\n\n#[Queue('${queue}')]${connectionAttr}${backoffAttr}${timeoutAttr}${uniqueAttr}\nclass ${jobName} implements ShouldQueue\n{\n    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;\n\n    public int $tries = ${tries};\n${props ? '\n' + props + '\n' : ''}    public function __construct(${constructorParams})\n    {\n${constructorAssign}\n    }\n\n    public function handle(): void\n    {\n        // Job logic here\n    }\n\n    public function failed(\Throwable $exception): void\n    {\n        logger()->error('Job failed', [\n            'job' => '${jobName}',\n            'error' => $exception->getMessage()\n        ]);\n    }\n}`;
    
    return { content: [{ type: "text", text: code }] };
  }
);

// ==================== TOOL: Generate Custom Middleware ====================
server.tool(
  "generate_custom_middleware",
  "Generate Laravel 13 middleware with auth, rate limiting, CSRF, and security checks.",
  {
    middlewareName: z.string().describe("Middleware name e.g. 'EnsureUserIsActive'"),
    type: z.enum(["auth", "guest", "throttle", "csrf", "verified", "custom", "api"]).default("custom"),
    rateLimit: z.number().optional().describe("Rate limit requests per minute (for throttle type)"),
    redirectTo: z.string().optional().describe("Redirect path for failed checks"),
    customLogic: z.string().optional().describe("Custom logic to execute"),
  },
  async ({ middlewareName, type, rateLimit, redirectTo, customLogic }) => {
    const redirectPath = redirectTo || '/login';
    
    const middlewareTemplates = {
      auth: `<?php\n\nnamespace App\\Http\\Middleware;\n\nuse Closure;\nuse Illuminate\\Http\\Request;\n\nclass ${middlewareName}\n{\n    public function handle(Request $request, Closure $next): mixed\n    {\n        if (!$request->user()) {\n            return redirect('${redirectPath}');\n        }\n\n        return $next($request);\n    }\n}`,
      guest: `<?php\n\nnamespace App\\Http\\Middleware;\n\nuse Closure;\nuse Illuminate\\Http\\Request;\n\nclass ${middlewareName}\n{\n    public function handle(Request $request, Closure $next): mixed\n    {\n        if ($request->user()) {\n            return redirect('/dashboard');\n        }\n\n        return $next($request);\n    }\n}`,
      throttle: `<?php\n\nnamespace App\\Http\\Middleware;\n\nuse Closure;\nuse Illuminate\\Http\\Request;\nuse Illuminate\\Cache\\RateLimiting\\Limit;\nuse Illuminate\\Support\\Facades\\RateLimiter;\n\nclass ${middlewareName}\n{\n    public function handle(Request $request, Closure $next): mixed\n    {\n        $key = '${middlewareName.toLowerCase()}:' . ($request->user()?->id ?? $request->ip());\n\n        if (RateLimiter::tooManyAttempts($key, ${rateLimit || 60})) {\n            $seconds = RateLimiter::availableIn($key);\n            return response()->json([\n                'message' => 'Too many attempts. Please try again in ' . $seconds . ' seconds.',\n            ], 429);\n        }\n\n        RateLimiter::hit($key, 60);\n\n        return $next($request);\n    }\n}`,
      verified: `<?php\n\nnamespace App\\Http\\Middleware;\n\nuse Closure;\nuse Illuminate\\Http\\Request;\n\nclass ${middlewareName}\n{\n    public function handle(Request $request, Closure $next): mixed\n    {\n        if ($request->user() && !$request->user()->hasVerifiedEmail()) {\n            return redirect('/verification/notice');\n        }\n\n        return $next($request);\n    }\n}`,
      csrf: `<?php\n\nnamespace App\\Http\\Middleware;\n\nuse Closure;\nuse Illuminate\\Http\\Request;\nuse Symfony\\Component\\HttpKernel\\Exception\\HttpException;\n\nclass ${middlewareName}\n{\n    public function handle(Request $request, Closure $next): mixed\n    {\n        if ($request->method() === 'POST' || $request->method() === 'PUT' || $request->method() === 'DELETE') {\n            if (!$request->hasHeader('X-XSRF-TOKEN') && !$request->hasSession()) {\n                throw new HttpException(419, 'CSRF token missing.');\n            }\n        }\n\n        return $next($request);\n    }\n}`,
      api: `<?php\n\nnamespace App\\Http\\Middleware;\n\nuse Closure;\nuse Illuminate\\Http\\Request;\nuse Illuminate\\Support\\Facades\\RateLimiter;\n\nclass ${middlewareName}\n{\n    public function handle(Request $request, Closure $next): mixed\n    {\n        // API authentication check\n        if (!$request->user()) {\n            return response()->json(['message' => 'Unauthenticated'], 401);\n        }\n\n        // Rate limiting for API\n        $key = 'api:' . $request->user()->id;\n        if (RateLimiter::tooManyAttempts($key, 60)) {\n            return response()->json(['message' => 'Rate limit exceeded'], 429);\n        }\n        RateLimiter::hit($key, 60);\n\n        return $next($request);\n    }\n}`,
      custom: `<?php\n\nnamespace App\\Http\\Middleware;\n\nuse Closure;\nuse Illuminate\\Http\\Request;\n\nclass ${middlewareName}\n{\n    /**\n     * Handle an incoming request.\n     *\n     * @param  \\Illuminate\\Http\\Request  $request\n     * @param  \\Closure  $next\n     * @return mixed\n     */\n    public function handle(Request $request, Closure $next): mixed\n    {\n        ${customLogic || '// Add your middleware logic here'}
\n        return $next($request);\n    }\n\n    /**\n     * Handle tasks after the response is sent to the browser.\n     */\n    public function terminate(Request $request, mixed $response): void\n    {\n        // Optional: cleanup tasks after response\n    }\n}`
    };
    
    const code = middlewareTemplates[type] || middlewareTemplates.custom;
    return { content: [{ type: "text", text: code }] };
  }
);

// ==================== TOOL: Generate Full Policy ====================
server.tool(
  "generate_full_policy",
  "Generate a comprehensive Laravel authorization policy with all CRUD methods, Gates, and policy injection.",
  {
    modelClass: z.string().describe("Full model class e.g. 'App\\Models\\Post'"),
    methods: z.array(z.enum(["viewAny", "view", "create", "update", "delete", "restore", "forceDelete", "deleteAny", "forceDeleteAny"])).default(["viewAny", "view", "create", "update", "delete"]),
    usePolicyInjection: z.boolean().default(true).describe("Use Laravel 13 policy injection"),
    conditions: z.array(z.object({ method: z.string(), condition: z.string() })).optional(),
  },
  async ({ modelClass, methods, usePolicyInjection, conditions }) => {
    const modelInfo = extractModelInfo(modelClass);
    const { name: modelName, variable: modelVar } = modelInfo;
    
    const methodImplementations = {
      viewAny: `    public function viewAny(User $user): bool
    {
        return true;
    }`,
      view: `    public function view(User $user, ${modelName} $${modelVar}): bool
    {
        return $user->id === $${modelVar}->user_id;
    }`,
      create: `    public function create(User $user): bool
    {
        return $user->hasRole(['admin', 'editor']);
    }`,
      update: `    public function update(User $user, ${modelName} $${modelVar}): bool
    {
        return $user->id === $${modelVar}->user_id || $user->hasRole('admin');
    }`,
      delete: `    public function delete(User $user, ${modelName} $${modelVar}): bool
    {
        return $user->id === $${modelVar}->user_id || $user->hasRole('admin');
    }`,
      restore: `    public function restore(User $user, ${modelName} $${modelVar}): bool
    {
        return $user->hasRole('admin');
    }`,
      forceDelete: `    public function forceDelete(User $user, ${modelName} $${modelVar}): bool
    {
        return $user->hasRole('super_admin');
    }`,
      deleteAny: `    public function deleteAny(User $user): bool
    {
        return $user->hasRole(['admin', 'super_admin']);
    }`,
      forceDeleteAny: `    public function forceDeleteAny(User $user): bool
    {
        return $user->hasRole('super_admin');
    }`
    };
    
    const selectedMethods = methods.map(m => methodImplementations[m]).join('\n\n');
    const injectionParam = usePolicyInjection ? `, ${modelName} $${modelVar}` : '';
    
    const code = `<?php\n\nnamespace App\\Policies;\n\nuse App\\Models\\User;\nuse App\\Models\\${modelName};\nuse Illuminate\\Auth\\Access\\HandlesAuthorization;\n\nclass ${modelName}Policy\n{\n    use HandlesAuthorization;\n\n    /**\n     * Pre-authorization check - runs before all policy methods\n     */\n    public function before(User $user, string $ability): ?bool\n    {
        if ($user->hasRole('super_admin')) {\n            return true;\n        }\n\n        return null; // Continue to specific method\n    }\n\n${selectedMethods}\n}`;
    
    return { content: [{ type: "text", text: code }] };
  }
);

// ==================== TOOL: Generate Notification ====================
server.tool(
  "generate_notification",
  "Generate a Laravel notification with mail, database, broadcast, and SMS channels.",
  {
    notificationName: z.string().describe("Notification class name e.g. 'OrderShipped'"),
    channels: z.array(z.enum(["mail", "database", "broadcast", "sms", "slack"])).default(["mail"]),
    markdown: z.boolean().default(true).describe("Use markdown email template"),
    properties: z.array(z.object({ name: z.string(), type: z.string().optional() })).default([]),
  },
  async ({ notificationName, channels, markdown, properties }) => {
    const channelImports = [];
    const channelMethods = [];
    
    if (channels.includes('mail')) {
      channelImports.push('use Illuminate\\Mail\\Mailables\\Content;');
      channelImports.push('use Illuminate\\Mail\\Mailables\\Envelope;');
      channelMethods.push(`    public function toMail(object $notification): MailMessage
    {
        return (new MailMessage)
            ->subject('${notificationName}')
            ->line('You have a new notification.')
            ->action('View Details', url('/'))
            ->line('Thank you for using our application!');
    }`);
    }
    
    if (channels.includes('database')) {
      channelImports.push('use Illuminate\\Queue\\SerializesModels;');
      channelMethods.push(`    public function toDatabase(object $notification): array
    {
        return [
            'title' => '${notificationName}',
            'message' => 'Notification message',
            'url' => '/',
        ];
    }`);
    }
    
    if (channels.includes('broadcast')) {
      channelImports.push('use Illuminate\\Broadcast\\InteractsWithSockets;');
      channelMethods.push(`    public function broadcastOn(): array
    {
        return [new PrivateChannel('notifications')];
    }

    public function broadcastAs(): string
    {
        return '${notificationName.toLowerCase()}';
    }`);
    }
    
    if (channels.includes('sms')) {
      channelMethods.push(`    public function toSms(object $notification): string
    {
        return 'SMS notification: ${notificationName}';
    }`);
    }
    
    if (channels.includes('slack')) {
      channelMethods.push(`    public function toSlack(object $notification): SlackMessage
    {
        return (new SlackMessage)
            ->content('${notificationName}')
            ->attachment(function ($attachment) use ($notification) {
                $attachment->title('Details')
                    ->content('Notification content');
            });
    }`);
    }
    
    const props = properties.map(p => `    public ${p.type || 'mixed'} $${p.name};`).join('\n');
    const constructorParams = properties.map(p => `public ${p.type || 'mixed'} $${p.name}`).join(', ');
    const constructorAssign = properties.map(p => `        $this->${p.name} = $${p.name};`).join('\n');
    
    const code = `<?php\n\nnamespace App\\Notifications;\n\nuse Illuminate\\Bus\\Queueable;\nuse Illuminate\\Contracts\\Queue\\ShouldQueue;\nuse Illuminate\\Notifications\\Messages\\MailMessage;\nuse Illuminate\\Notifications\\Notification;\n${channels.includes('slack') ? 'use Illuminate\\Notifications\\Messages\\SlackMessage;' : ''}
${channelImports.join('\n')}\n\nclass ${notificationName} extends Notification implements ShouldQueue\n{\n    use Queueable;\n${props ? '\n' + props + '\n' : ''}    public function __construct(${constructorParams})\n    {\n${constructorAssign}\n    }\n\n    public function via(object $notifiable): array\n    {\n        return ${JSON.stringify(channels)};\n    }\n\n${channelMethods.join('\n\n')}\n}`;
    
    return { content: [{ type: "text", text: code }] };
  }
);

// ==================== TOOL: Generate Rate Limited Endpoint ====================
server.tool(
  "generate_rate_limited_endpoint",
  "Generate a Laravel 13.2 API endpoint with rate limiting, auth, validation, and throttling middleware.",
  {
    route: z.string().describe("Route path e.g. 'api/users'"),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
    rateLimit: z.number().default(60).describe("Requests per minute"),
    rateDecay: z.number().default(1).describe("Rate limit decay in minutes"),
    requireAuth: z.boolean().default(true),
    modelClass: z.string().optional().describe("Associated model class"),
    responseFormat: z.enum(["json", "resource", "collection"]).default("json"),
  },
  async ({ route, method, rateLimit, rateDecay, requireAuth, modelClass, responseFormat }) => {
    const modelInfo = modelClass ? extractModelInfo(modelClass) : null;
    const middleware = [];
    
    if (requireAuth) middleware.push("'auth:sanctum'");
    middleware.push(`'throttle:${rateLimit},${rateDecay}'`);
    
    const controllerMethod = modelInfo ? 
      (method === 'GET' ? 
        (responseFormat === 'collection' ? 
          `return ${modelInfo.name}::paginate(15);` : 
          `return ${modelInfo.name}::all();`) :
        method === 'POST' ?
          `$data = $request->validated();\n        return ${modelInfo.name}::create($data);` :
          `return response()->json(['message' => '${method} handler']);`
      ) : 
      `return response()->json(['message' => 'Success']);`;
    
    const code = `<?php\n\nnamespace App\\Http\\Controllers\\Api;\n\nuse App\\Http\\Controllers\\Controller;\nuse Illuminate\\Http\\Request;\n${modelInfo ? `use App\\Models\\${modelInfo.name};` : ''}
use Illuminate\\Cache\\RateLimiting\\Limit;
use Illuminate\\Support\\Facades\\RateLimiter;

class ApiController extends Controller
{
    /**
     * Rate limit configuration using Laravel 13.2 attributes
     */
    public function __construct()
    {
        $this->middleware(${middleware.join(', ')});
    }

    /**
     * Handle ${method} request to ${route}
     * Rate limit: ${rateLimit} requests per ${rateDecay} minute(s)
     */
    public function ${method.toLowerCase()}(Request $request)
    {
        ${controllerMethod}
    }

    /**
     * Custom rate limit key for this endpoint
     */
    public static function rateLimiter(Request $request): Limit
    {
        return Limit::perMinute(${rateLimit})->by(
            $request->user()?->id ?: $request->ip()
        );
    }
}`;
    
    return { content: [{ type: "text", text: code }] };
  }
);

// ==================== TOOL: Generate Flux UI Component ====================
server.tool(
  "generate_flux_component",
  "Generate a Livewire Flux UI component using the official Flux component library with dark mode support.",
  {
    componentName: z.string().describe("Component name e.g. 'user.profile'"),
    fluxType: z.enum([
      "button", "input", "select", "textarea", "checkbox", "radio",
      "toggle", "modal", "dropdown", "menu", "tabs", "card",
      "badge", "avatar", "table", "pagination", "empty", "heading"
    ]).default("button"),
    variant: z.enum(["primary", "secondary", "danger", "ghost", "outline"]).optional(),
    size: z.enum(["sm", "md", "lg"]).optional(),
    content: z.string().optional().describe("Component content/text"),
    slots: z.array(z.string()).optional(),
  },
  async ({ componentName, fluxType, variant, size, content, slots }) => {
    const className = extractClassName(componentName);
    const namespace = extractNamespace(componentName);
    
    const variantAttr = variant ? ` variant="${variant}"` : '';
    const sizeAttr = size ? ` size="${size}"` : '';
    
    const fluxTemplates = {
      button: `<flux:button${variantAttr}${sizeAttr}>${content || 'Button'}</flux:button>`,
      input: `<flux:input wire:model="${componentName.split('.').pop()}" placeholder="${content || 'Enter value...'}" />`,
      select: `<flux:select wire:model="${componentName.split('.').pop()}">
    <option value="">Select...</option>
    <option value="1">Option 1</option>
    <option value="2">Option 2</option>
</flux:select>`,
      textarea: `<flux:textarea wire:model="${componentName.split('.').pop()}" placeholder="${content || 'Enter text...'}" />`,
      checkbox: `<flux:checkbox wire:model="${componentName.split('.').pop()}">${content || 'Checkbox'}</flux:checkbox>`,
      radio: `<flux:radio wire:model="${componentName.split('.').pop()}" value="1">${content || 'Option'}</flux:radio>`,
      toggle: `<flux:toggle wire:model="${componentName.split('.').pop()}" />`,
      modal: `<flux:modal wire:model="showModal">
    <flux:heading>${content || 'Modal Title'}</flux:heading>
    <flux:text>Modal content goes here.</flux:text>
    <flux:actions>
        <flux:button variant="ghost" wire:click="$set('showModal', false)">Cancel</flux:button>
        <flux:button variant="primary" wire:click="confirm">Confirm</flux:button>
    </flux:actions>
</flux:modal>`,
      dropdown: `<flux:dropdown>
    <flux:trigger>Menu</flux:trigger>
    <flux:menu>
        <flux:menu.item>Action 1</flux:menu.item>
        <flux:menu.item>Action 2</flux:menu.item>
        <flux:menu.separator />
        <flux:menu.item variant="danger">Delete</flux:menu.item>
    </flux:menu>
</flux:dropdown>`,
      menu: `<flux:menu>
    <flux:menu.item icon="home">Dashboard</flux:menu.item>
    <flux:menu.item icon="user">Profile</flux:menu.item>
    <flux:menu.item icon="cog">Settings</flux:menu.item>
</flux:menu>`,
      tabs: `<flux:tabs>
    <flux:tab name="tab1">Tab 1</flux:tab>
    <flux:tab name="tab2">Tab 2</flux:tab>
    <flux:tab name="tab3">Tab 3</flux:tab>
</flux:tabs>`,
      card: `<flux:card>
    <flux:heading>${content || 'Card Title'}</flux:heading>
    <flux:text>Card content goes here.</flux:text>
    <flux:actions>
        <flux:button>Learn More</flux:button>
    </flux:actions>
</flux:card>`,
      badge: `<flux:badge color="green">${content || 'Badge'}</flux:badge>`,
      avatar: `<flux:avatar src="/images/avatar.jpg" alt="User" />`,
      table: `<flux:table>
    <flux:table.columns>
        <flux:table.column>Name</flux:table.column>
        <flux:table.column>Email</flux:table.column>
        <flux:table.column>Status</flux:table.column>
    </flux:table.columns>
    <flux:table.rows>
        @foreach($users as $user)
        <flux:table.row>
            <flux:table.cell>{{ $user->name }}</flux:table.cell>
            <flux:table.cell>{{ $user->email }}</flux:table.cell>
            <flux:table.cell><flux:badge>{{ $user->status }}</flux:badge></flux:table.cell>
        </flux:table.row>
        @endforeach
    </flux:table.rows>
</flux:table>`,
      pagination: `<flux:pagination :paginator="$items" />`,
      empty: `<flux:empty icon="inbox">
    <flux:heading>No items found</flux:heading>
    <flux:text>Get started by creating your first item.</flux:text>
    <flux:button>Create Item</flux:button>
</flux:empty>`,
      heading: `<flux:heading size="lg">${content || 'Heading'}</flux:heading>`
    };
    
    const code = `<?php\n\nnamespace App\\Livewire${namespace ? '\\' + namespace : ''};\n\nuse Livewire\\Component;\nuse Livewire\\Attributes\\Layout;\n\n#[Layout('${DEFAULT_LAYOUTS.app}')]\nfinal class ${className} extends Component\n{\n    public bool $showModal = false;\n\n    public function render()\n    {\n        return view('livewire.${componentName.toLowerCase().replace('.', '.')}');\n    }\n}\n\n{{-- resources/views/livewire/${componentName.toLowerCase().replace('.', '/')}.blade.php --}}\n<div>\n    ${fluxTemplates[fluxType]}\n</div>`;
    
    return { content: [{ type: "text", text: code }] };
  }
);

// ==================== TOOL: Generate Renderless Component ====================
server.tool(
  "generate_renderless_component",
  "Generate a Livewire 4.2.1 renderless component with #[Renderless] attribute for logic-only components.",
  {
    name: z.string().describe("Component name e.g. 'confirm.dialog'"),
    events: z.array(z.string()).optional().describe("Events to dispatch"),
    methods: z.array(z.object({ 
      name: z.string(), 
      params: z.array(z.string()).optional(),
      returns: z.string().optional() 
    })).default([]),
    hasModal: z.boolean().default(false),
  },
  async ({ name, events, methods, hasModal }) => {
    const className = extractClassName(name);
    const namespace = extractNamespace(name);
    
    const eventDispatch = events?.length ? 
      events.map(e => `$this->dispatch('${e}');`).join('\n        ') : '';
    
    const methodCode = methods.map(m => {
      const params = m.params?.map(p => `mixed $${p}`).join(', ') || '';
      return `    public function ${m.name}(${params}): ${m.returns || 'void'}\n    {\n        // ${m.name} logic\n    }`;
    }).join('\n\n');
    
    const code = `<?php\n\nnamespace App\\Livewire${namespace ? '\\' + namespace : ''};\n\nuse Livewire\\Component;\nuse Livewire\\Attributes\\{Layout, Renderless, On};\n\n/**\n * Renderless Component - Livewire 4.2.1\n * This component has no view, only logic.\n */\n#[Layout('${DEFAULT_LAYOUTS.app}')]\n#[Renderless]\nfinal class ${className} extends Component\n{\n${hasModal ? '    public bool $showModal = false;\n' : ''}${methods.length ? '\n' + methodCode + '\n' : ''}    ${events?.length ? `#[On('confirm-action')]\n    public function confirmAction(): void\n    {\n        ${eventDispatch}\n    }` : ''}\n}\n\n{{-- No Blade view needed for renderless components --}}`;
    
    return { content: [{ type: "text", text: code }] };
  }
);

// ==================== TOOL: Generate Reverb Channel ====================
server.tool(
  "generate_reverb_channel",
  "Generate a Laravel Reverb WebSocket channel for real-time broadcasting with presence and private channels.",
  {
    channelName: z.string().describe("Channel name e.g. 'chat.room'"),
    type: z.enum(["public", "private", "presence"]).default("private"),
    events: z.array(z.string()).default(["MessageSent", "UserTyping"]),
    auth: z.boolean().default(true),
    presenceEvents: z.array(z.enum(["here", "joining", "leaving"])).default(["here", "joining", "leaving"]),
  },
  async ({ channelName, type, events, auth, presenceEvents }) => {
    const channelParts = channelName.split('.');
    const className = toPascalCase(channelParts.join(' ')) + 'Channel';
    
    const presenceHook = type === 'presence' ? `
    /**
     * Handle user joining the channel
     */
    public function join(PrivateChannel $channel, User $user): array|bool
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
        ];
    }

    /**
     * Handle user leaving the channel
     */
    public function leave(PrivateChannel $channel, User $user): void
    {
        //
    }` : '';
    
    const eventHandlers = events.map(e => `
    /**
     * Broadcast to ${type} channel
     */
    public function broadcastOn(): array
    {
        return [${type === 'presence' ? "new PresenceChannel('${channelName}')" : type === 'private' ? "new PrivateChannel('${channelName}')" : "new Channel('${channelName}')"}];
    }`).join('\n');
    
    const code = `<?php\n\nnamespace App\\Broadcasting;\n\nuse Illuminate\\Broadcasting\\Channel;\nuse Illuminate\\Broadcasting\\InteractsWithSockets;\nuse Illuminate\\Broadcasting\\PresenceChannel;\nuse Illuminate\\Broadcasting\\PrivateChannel;\nuse Illuminate\\Contracts\\Broadcasting\\ShouldBroadcast;\nuse Illuminate\\Foundation\\Events\\Dispatchable;\nuse Illuminate\\Queue\\SerializesModels;\nuse App\\Models\\User;\n\nclass ${className}\n{\n    use Dispatchable, InteractsWithSockets, SerializesModels;\n\n    public function __construct(\n        ${events.map(() => '// public mixed $data;').join('\n        ')}
    )\n    {\n        //\n    }\n\n${presenceHook}

    /**
     * Get the channels the event should broadcast on.
     * For Laravel Reverb WebSocket server
     */
    public function broadcastOn(): array
    {
        return [${type === 'presence' ? "new PresenceChannel('${channelName}')" : type === 'private' ? "new PrivateChannel('${channelName}')" : "new Channel('${channelName}')"}];
    }

    /**
     * The event's broadcast name
     */
    public function broadcastAs(): string
    {
        return '${events[0] || 'event'}.received';
    }
}

// routes/channels.php - Channel authentication
${auth ? `Broadcast::channel('${channelName}', function (User $user) {
    ${type === 'presence' ? `return [
        'id' => $user->id,
        'name' => $user->name,
        'avatar' => $user->avatar,
    ];` : `return $user->exists;`}
});` : ''}

// config/reverb.php - Reverb configuration
return [
    'apps' => [
        [
            'id' => env('REVERB_APP_ID'),
            'key' => env('REVERB_APP_KEY'),
            'secret' => env('REVERB_APP_SECRET'),
        ],
    ],
];`;
    
    return { content: [{ type: "text", text: code }] };
  }
);

// ==================== TOOL: Generate UniqueConstraintViolationHandler ====================
server.tool(
  "generate_constraint_violation_handler",
  "Generate Laravel 13.2 UniqueConstraintViolationException handler with column/index details.",
  {
    modelName: z.string().describe("Model name e.g. 'User'"),
    fields: z.array(z.string()).describe("Fields that have unique constraints e.g. ['email', 'username']"),
    customMessage: z.string().optional(),
  },
  async ({ modelName, fields, customMessage }) => {
    const fieldHandlers = fields.map(f => `'${f}' => 'The ${f} has already been taken.'`).join(',\n            ');
    
    const code = `<?php\n\nnamespace App\\Exceptions;\n\nuse Illuminate\\Database\\Exceptions\\UniqueConstraintViolationException;\nuse Illuminate\\Foundation\\Exceptions\\Handler as ExceptionHandler;\n\n/**\n * Laravel 13.2 - UniqueConstraintViolationException Handler\n * Now includes column and index information for better error handling\n */\nclass ${modelName}ExceptionHandler extends ExceptionHandler\n{\n    /**\n     * Register exception handling\n     */\n    public function register(): void\n    {\n        $this->renderable(function (UniqueConstraintViolationException $e, $request) {\n            // Laravel 13.2 exposes columns and index details\n            $columns = $e->columns ?? [];\n            $index = $e->index ?? null;\n            \n            // Determine which field caused the violation\n            $field = $columns[0] ?? 'field';\n            \n            $messages = [\n                ${fieldHandlers}\n            ];\n            \n            $message = $messages[$field] ?? '${customMessage || 'This value already exists.'}';\n            \n            if ($request->expectsJson()) {\n                return response()->json([\n                    'message' => $message,\n                    'errors' => [\n                        $field => [$message]\n                    ],\n                    'columns' => $columns,\n                    'index' => $index,\n                ], 422);\n            }\n            \n            return back()->withErrors([$field => $message])->withInput();\n        });\n    }\n}\n\n// Usage in Controller:\n// try {\n//     ${modelName}::create($validated);\n// } catch (UniqueConstraintViolationException $e) {\n//     // Laravel 13.2 features:\n//     $e->columns; // e.g., ['email'] on PostgreSQL/SQLite\n//     $e->index;   // e.g., '${modelName.toLowerCase()}_email_unique'\n// }`;
    
    return { content: [{ type: "text", text: code }] };
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("skills-mcp server running on stdio");
}
main().catch(console.error);
