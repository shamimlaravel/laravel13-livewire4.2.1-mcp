/**
 * Reusable template constants for code generation
 * Laravel 13 + Livewire 4.2 MCP Server
 * 
 * These templates ensure consistency across all generated code
 */

import { 
    LIVEWIRE_IMPORTS, 
    LARAVEL_IMPORTS, 
    DEFAULT_LAYOUTS,
    toPascalCase,
    toTitleCase
} from './helpers.js';

// ============================================
// PHP CLASS TEMPLATES
// ============================================

/**
 * Generate Livewire component class
 */
export function livewireComponentTemplate({
    namespace,
    className,
    imports = [],
    layout = DEFAULT_LAYOUTS.app,
    title = '',
    properties = [],
    methods = [],
    renderView = ''
}) {
    const allImports = [LIVEWIRE_IMPORTS.component, ...imports];
    
    // Add attribute imports
    const attrImports = [];
    if (layout) attrImports.push('Layout');
    if (title) attrImports.push('Title');
    
    if (attrImports.length > 0) {
        allImports.push(`${LIVEWIRE_IMPORTS.attributes.layout.split('\\').slice(0, -1).join('\\')}\\{${attrImports.join(', ')}}`);
    }
    
    return `<?php

namespace ${namespace};

${allImports.map(i => `use ${i};`).join('\n')}

#[Layout('${layout}')]
${title ? `#[Title('${title}')]` : ''}
class ${className} extends Component
{
${properties.length > 0 ? properties.map(p => `    ${p}`).join('\n') : ''}

${methods.length > 0 ? methods.join('\n\n') : ''}

    public function render(): \\Illuminate\\View\\View
    {
        return view('${renderView}');
    }
}`;
}

/**
 * Generate Eloquent model class
 */
export function eloquentModelTemplate({
    namespace = 'App\\Models',
    className,
    imports = [],
    table = null,
    fillable = [],
    casts = [],
    relations = [],
    scopes = [],
    accessors = [],
    uses = [],
    isReadonly = false
}) {
    const allImports = ['Illuminate\\Database\\Eloquent\\Model', ...imports];
    
    // Add trait imports
    if (uses.length > 0) {
        uses.forEach(trait => {
            allImports.push(`App\\Traits\\${trait}`);
        });
    }
    
    // Add relationship imports if needed
    if (relations.some(r => r.type === 'belongsToMany' || r.type === 'morphMany')) {
        allImports.push('Illuminate\\Database\\Eloquent\\Relations\\BelongsToMany');
    }
    
    let content = `<?php

namespace ${namespace};

${[...new Set(allImports)].map(i => `use ${i};`).join('\n')}

${isReadonly ? 'readonly ' : ''}class ${className} extends Model
{
    protected $table = '${table || className.toLowerCase() + 's'}';

    protected array $fillable = [
${fillable.map(f => `        '${f}'`).join(',\n')}
    ];

${casts.length > 0 ? `protected array $casts = [
${casts.map(c => `        '${c.field}' => '${c.type}'`).join(',\n')}
    ];` : ''}

${relations.map(r => generateRelation(r)).join('\n\n')}

${scopes.map(s => generateScope(s)).join('\n\n')}

${accessors.map(a => generateAccessor(a)).join('\n\n')}
}`;

    return content;
}

/**
 * Generate relation method
 */
function generateRelation(relation) {
    const { type, name, related, foreignKey, localKey } = relation;
    
    const templates = {
        hasOne: `public function ${name}(): HasOne
    {
        return $this->hasOne(${related}::class${foreignKey ? `, '${foreignKey}'` : ''}${localKey ? `, '${localKey}'` : ''});
    }`,
        hasMany: `public function ${name}(): HasMany
    {
        return $this->hasMany(${related}::class${foreignKey ? `, '${foreignKey}'` : ''}${localKey ? `, '${localKey}'` : ''});
    }`,
        belongsTo: `public function ${name}(): BelongsTo
    {
        return $this->belongsTo(${related}::class${foreignKey ? `, '${foreignKey}'` : ''});
    }`,
        belongsToMany: `public function ${name}(): BelongsToMany
    {
        return $this->belongsToMany(${related}::class${foreignKey ? `, '${foreignKey}'` : ''});
    }`,
        hasManyThrough: `public function ${name}(): HasManyThrough
    {
        return $this->hasManyThrough(${related}::class, ${relation.through}::class);
    }`,
        morphOne: `public function ${name}(): MorphOne
    {
        return $this->morphOne(${related}::class, '${relation.morphName}');
    }`,
        morphMany: `public function ${name}(): MorphMany
    {
        return $this->morphMany(${related}::class, '${relation.morphName}');
    }`,
        morphTo: `public function ${name}(): MorphTo
    {
        return $this->morphTo();
    }`
    };
    
    return templates[type] || '';
}

/**
 * Generate scope method
 */
function generateScope(scope) {
    return `public function scope${scope.name.charAt(0).toUpperCase() + scope.name.slice(1)}(\\Illuminate\\Database\\Eloquent\\Builder $query, $value): void
    {
        $query->where('${scope.column}', $value);
    }`;
}

/**
 * Generate accessor method
 */
function generateAccessor(accessor) {
    return `public function get${accessor.name.charAt(0).toUpperCase() + accessor.name.slice(1)}Attribute(): string
    {
        return ${accessor.expression};
    }`;
}

// ============================================
// BLADE TEMPLATES
// ============================================

/**
 * Generate Blade layout template
 */
export function bladeLayoutTemplate({
    name = 'app',
    title = '',
    slot = '',
    assets = {}
}) {
    const { css = [], js = [] } = assets;
    
    return `<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    
    <title>${title ? `${title} - ` : ''}{{ config('app.name') }}</title>
    
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.bunny.net">
    <link href="https://fonts.bunny.net/css?family=inter:300,400,500,600,700" rel="stylesheet" />
    
    <!-- Styles -->
    @vite(['resources/css/app.css', 'resources/js/app.js'])
    ${css.map(c => `<link rel="stylesheet" href="${c}">`).join('\n    ')}
    
    @livewireStyles
</head>
<body class="font-sans antialiased bg-gray-100">
    {{ $slot }}
    
    @livewireScripts
    ${js.map(j => `<script src="${j}"></script>`).join('\n    ')}
</body>
</html>`;
}

/**
 * Generate Blade Livewire component template
 */
export function bladeComponentTemplate({
    name,
    formFields = [],
    slots = [],
    actions = [],
    content = ''
}) {
    return `<div class="p-6">
    @if (session()->has('success'))
        <div class="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            {{ session('success') }}
        </div>
    @endif

    @if (session()->has('error'))
        <div class="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {{ session('error') }}
        </div>
    @endif

    <form wire:submit="save">
${formFields.map(f => generateBladeField(f)).join('\n\n')}
        
        <div class="flex items-center justify-end mt-6 space-x-4">
            @if(isset($showCancel) && $showCancel)
                <button type="button" wire:click="cancel" class="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300">
                    Cancel
                </button>
            @endif
            
            <button type="submit" 
                    class="px-6 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    wire:loading.attr="disabled"
                    wire:target="save">
                <span wire:loading.remove wire:target="save">Save</span>
                <span wire:loading wire:target="save">Saving...</span>
            </button>
        </div>
    </form>
</div>`;
}

/**
 * Generate Blade field component
 */
function generateBladeField(field) {
    const { name, label, type = 'text', rules = '' } = field;
    const labelStr = label || name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ');
    
    const fieldTemplates = {
        text: `<div class="mb-4">
            <label for="${name}" class="block text-sm font-medium text-gray-700">${labelStr}</label>
            <input type="text" 
                   id="${name}" 
                   wire:model="${name}"
                   class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                   {{ $errors->has('${name}') ? 'aria-invalid="true"' : '' }}>
            @error('${name}') <span class="text-red-500 text-sm">{{ $message }}</span> @enderror
        </div>`,
        
        textarea: `<div class="mb-4">
            <label for="${name}" class="block text-sm font-medium text-gray-700">${labelStr}</label>
            <textarea id="${name}" 
                      wire:model="${name}"
                      rows="4"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"></textarea>
            @error('${name}') <span class="text-red-500 text-sm">{{ $message }}</span> @enderror
        </div>`,
        
        select: `<div class="mb-4">
            <label for="${name}" class="block text-sm font-medium text-gray-700">${labelStr}</label>
            <select id="${name}" 
                    wire:model="${name}"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500">
                <option value="">Select ${labelStr}</option>
                @foreach($${name}s ?? [] as $option)
                    <option value="{{ $option->id }}">{{ $option->name }}</option>
                @endforeach
            </select>
            @error('${name}') <span class="text-red-500 text-sm">{{ $message }}</span> @enderror
        </div>`,
        
        checkbox: `<div class="mb-4">
            <label class="flex items-center">
                <input type="checkbox" 
                       wire:model="${name}"
                       class="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500">
                <span class="ml-2 text-sm text-gray-700">${labelStr}</span>
            </label>
            @error('${name}') <span class="text-red-500 text-sm">{{ $message }}</span> @enderror
        </div>`,
        
        file: `<div class="mb-4">
            <label for="${name}" class="block text-sm font-medium text-gray-700">${labelStr}</label>
            <input type="file" 
                   id="${name}" 
                   wire:model="${name}"
                   class="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100">
            @error('${name}') <span class="text-red-500 text-sm">{{ $message }}</span> @enderror
        </div>`
    };
    
    return fieldTemplates[type] || fieldTemplates.text;
}

/**
 * Generate Blade modal template
 */
export function bladeModalTemplate({
    name,
    title = '',
    content = '',
    actions = []
}) {
    return `<div x-data="{ open: false }" 
     x-on:open-modal.window="if ($event.detail.name === '${name}') open = true"
     x-on:close-modal.window="if ($event.detail.name === '${name}') open = false"
     x-show="open"
     x-cloak
     class="fixed inset-0 z-50 overflow-y-auto">
    
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-black bg-opacity-50" 
         x-show="open" 
         x-transition:enter="transition ease-out duration-200"
         x-transition:enter-start="opacity-0"
         x-transition:enter-end="opacity-100"
         x-transition:leave="transition ease-in duration-150"
         x-transition:leave-start="opacity-100"
         x-transition:leave-end="opacity-0"
         @click="open = false"></div>
    
    <!-- Modal -->
    <div class="flex min-h-full items-center justify-center p-4">
        <div class="relative bg-white rounded-lg shadow-xl max-w-lg w-full"
             x-show="open"
             x-transition:enter="transition ease-out duration-200"
             x-transition:enter-start="opacity-0 scale-95"
             x-transition:enter-end="opacity-100 scale-100"
             x-transition:leave="transition ease-in duration-150"
             x-transition:leave-start="opacity-100 scale-100"
             x-transition:leave-end="opacity-0 scale-95">
            
            <!-- Header -->
            <div class="flex items-center justify-between p-4 border-b">
                <h3 class="text-lg font-semibold text-gray-900">${title}</h3>
                <button @click="open = false" class="text-gray-400 hover:text-gray-600">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            
            <!-- Content -->
            <div class="p-4">
${content}
            </div>
            
            <!-- Footer -->
            <div class="flex justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-lg">
                <button @click="open = false" 
                        class="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300">
                    Cancel
                </button>
                ${actions.map(a => `
                <button wire:click="${a.action}" 
                        class="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                    ${a.label}
                </button>`).join('')}
            </div>
        </div>
    </div>
</div>`;
}

// ============================================
// ROUTE TEMPLATES
// ============================================

/**
 * Generate Laravel routes with Livewire
 */
export function routesTemplate({
    prefix = '',
    name = '',
    middleware = [],
    routes = []
}) {
    const middlewareStr = middleware.length > 0 
        ? `->middleware([${middleware.map(m => `'${m}'`).join(', ')}])` 
        : '';
    
    return `<?php

use Illuminate\\Support\\Facades\\Route;
use App\\Livewire${prefix ? '\\' + prefix.replace('/', '\\') : ''};

Route::middleware(['auth', 'verified'])->group(function () {
${routes.map(r => `    Route::get('${r.path}', ${r.component}::class)->name('${r.name}');`).join('\n')}
});`;
}

// ============================================
// TEST TEMPLATES
// ============================================

/**
 * Generate PestPHP test template
 */
export function pestTestTemplate({
    testName,
    imports = [],
    beforeEach = '',
    tests = []
}) {
    return `<?php

${imports.map(i => `use ${i};`).join('\n')}

${beforeEach ? `beforeEach(function () {
${beforeEach}
});` : ''}

${tests.map(t => `
it('${t.name}', function () {
${t.body}
});`).join('\n')}`;
}

/**
 * Generate comprehensive PestPHP test with describe blocks
 */
export function pestTestWithDescribeTemplate({
    componentName,
    imports = [],
    beforeEach = '',
    describeBlocks = []
}) {
    return `<?php

use Livewire\\Livewire;
${imports.map(i => `use ${i};`).join('\n')}

describe('${componentName} Component', function () {
${beforeEach ? `    beforeEach(function () {
${beforeEach}
    });` : ''}
${describeBlocks.map(block => `
    describe('${block.name}', function () {
${block.tests.map(test => `        it('${test.name}', function () {
${test.body}
        })`).join('\n\n')}
    });`).join('\n')}
});`;
}

// ============================================
// MIGRATION TEMPLATES
// ============================================

/**
 * Generate Laravel migration template
 */
export function migrationTemplate({
    tableName,
    up = [],
    down = true
}) {
    return `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('${tableName}', function (Blueprint $table) {
            $table->id();
${up.map(col => `            ${col}`).join('\n')}
            $table->timestamps();
${down ? '            $table->softDeletes();' : ''}
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('${tableName}');
    }
};`;
}

// ============================================
// SERVICE CLASS TEMPLATES
// ============================================

/**
 * Generate service class template
 */
export function serviceClassTemplate({
    namespace = 'App\\Services',
    className,
    dependencies = [],
    methods = []
}) {
    return `<?php

namespace ${namespace};

use Illuminate\\Support\\Facades\\Log;

readonly class ${className}
{
    public function __construct(
${dependencies.map(d => `        private ${d.type} $${d.name},`).join('\n')}
    ) {}

${methods.map(m => `
    public function ${m.name}(${m.params || ''}): ${m.returnType || 'mixed'}
    {
        ${m.body}
    }`).join('\n')}
}`;
}

// ============================================
// POLICY TEMPLATES
// ============================================

/**
 * Generate authorization policy template
 */
export function policyTemplate({
    namespace = 'App\\Policies',
    modelClass,
    methods = ['viewAny', 'view', 'create', 'update', 'delete', 'restore', 'forceDelete']
}) {
    const modelName = modelClass.split('\\').pop();
    const modelVar = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    
    const defaultMethods = {
        viewAny: `public function viewAny(User $user): bool
    {
        return true;
    }`,
        view: `public function view(User $user, ${modelName} $${modelVar}): bool
    {
        return true;
    }`,
        create: `public function create(User $user): bool
    {
        return $user->hasRole('admin');
    }`,
        update: `public function update(User $user, ${modelName} $${modelVar}): bool
    {
        return $user->id === $${modelVar}->user_id || $user->hasRole('admin');
    }`,
        delete: `public function delete(User $user, ${modelName} $${modelVar}): bool
    {
        return $user->id === $${modelVar}->user_id || $user->hasRole('admin');
    }`,
        restore: `public function restore(User $user, ${modelName} $${modelVar}): bool
    {
        return $user->hasRole('admin');
    }`,
        forceDelete: `public function forceDelete(User $user, ${modelName} $${modelVar}): bool
    {
        return $user->hasRole('super-admin');
    }`
    };
    
    return `<?php

namespace ${namespace};

use App\\Models\\${modelName};
use App\\Models\\User;
use Illuminate\\Access\\Gate\\HandlesAttributes;

class ${modelName}Policy
{
    use HandlesAttributes;

${methods.map(m => defaultMethods[m]).filter(Boolean).join('\n\n')}
}`;
}

// ============================================
// OBSERVER TEMPLATES
// ============================================

/**
 * Generate model observer template
 */
export function observerTemplate({
    namespace = 'App\\Observers',
    modelClass,
    events = ['creating', 'created', 'updating', 'updated', 'deleting', 'deleted', 'saving', 'saved']
}) {
    const modelName = modelClass.split('\\').pop();
    
    const eventHandlers = {
        creating: `public function creating(${modelName} $model): void
    {
        // Run before creating
    }`,
        created: `public function created(${modelName} $model): void
    {
        // Run after created
    }`,
        updating: `public function updating(${modelName} $model): void
    {
        // Run before updating
    }`,
        updated: `public function updated(${modelName} $model): void
    {
        // Run after updated
    }`,
        deleting: `public function deleting(${modelName} $model): void
    {
        // Run before deleting
    }`,
        deleted: `public function deleted(${modelName} $model): void
    {
        // Run after deleted - perform cleanup
    }`,
        restoring: `public function restoring(${modelName} $model): void
    {
        // Run before restoring
    }`,
        restored: `public function restored(${modelName} $model): void
    {
        // Run after restored
    }`,
        saving: `public function saving(${modelName} $model): void
    {
        // Run before creating or updating
    }`,
        saved: `public function saved(${modelName} $model): void
    {
        // Run after creating or updating
    }`
    };
    
    return `<?php

namespace ${namespace};

use App\\Models\\${modelName};

class ${modelName}Observer
{
${events.map(e => eventHandlers[e]).filter(Boolean).join('\n\n')}
}`;
}

// ============================================
// MAIL TEMPLATES
// ============================================

/**
 * Generate mailable class template
 */
export function mailTemplate({
    namespace = 'App\\Mail',
    className,
    subject = '',
    view = '',
    properties = []
}) {
    return `<?php

namespace ${namespace};

use Illuminate\\Bus\\Queueable;
use Illuminate\\Mail\\Mailable;
use Illuminate\\Mail\\Mailables\\Content;
use Illuminate\\Mail\\Mailables\\Envelope;
use Illuminate\\Queue\\SerializesModels;

class ${className} extends Mailable
{
    use Queueable, SerializesModels;

${properties.map(p => `    public string $${p.name};`).join('\n')}

    public function __construct(${properties.map(p => `string $${p.name}`).join(', ')})
    {
${properties.map(p => `        $this->${p.name} = $${p.name};`).join('\n')}
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '${subject || className}'
        );
    }

    public function content(): Content
    {
        return new Content(
            view: '${view || 'emails.' + className.toLowerCase()}',
        );
    }
}`;
}

// ============================================
// JOB TEMPLATES
// ============================================

/**
 * Generate queued job template
 */
export function jobTemplate({
    namespace = 'App\\Jobs',
    className,
    properties = [],
    queue = 'default',
    retries = 3
}) {
    return `<?php

namespace ${namespace};

use Illuminate\\Bus\\Queueable;
use Illuminate\\Contracts\\Queue\\ShouldQueue;
use Illuminate\\Contracts\\Queue\\ShouldBeUnique;
use Illuminate\\Foundation\\Bus\\Dispatchable;
use Illuminate\\Queue\\InteractsWithQueue;
use Illuminate\\Queue\\SerializesModels;
use Illuminate\\Queue\\MustQueue;
use Illuminate\\Bus\\Batchable;

class ${className} implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = ${retries};
    public string $queue = '${queue}';

${properties.map(p => `    public $${p.name};`).join('\n')}

    public function __construct(${properties.map(p => `$${p.name}`).join(', ')})
    {
${properties.map(p => `        $this->${p.name} = $${p.name};`).join('\n')}
    }

    public function handle(): void
    {
        // Process the job
    }

    public function failed(\Throwable $exception): void
    {
        // Handle failure
        logger()->error('Job failed', [
            'job' => '${className}',
            'error' => $exception->getMessage()
        ]);
    }
}`;
}

// ============================================
// ENUM TEMPLATES
// ============================================

/**
 * Generate PHP 8.1+ enum template
 */
export function enumTemplate({
    namespace = 'App\\Enums',
    name,
    type = 'string',
    cases = [],
    withLabel = true,
    withColor = false
}) {
    const caseList = cases.map(c => {
        const value = typeof c === 'string' ? c : c.value;
        const label = typeof c === 'string' ? toTitleCase(value) : c.label;
        return { value, label };
    });
    
    return `<?php

namespace ${namespace};

enum ${name}: ${type}
{
${caseList.map(c => `    case ${toPascalCase(c.value)} = '${c.value}';`).join('\n')}

${withLabel ? `    public function label(): string
    {
        return match($this) {
${caseList.map(c => `            self::${toPascalCase(c.value)} => '${c.label}',`).join('\n')}
        };
    }` : ''}

${withColor ? `    public function color(): string
    {
        return match($this) {
            self::Active => 'success',
            self::Inactive => 'danger',
            self::Pending => 'warning',
            self::Draft => 'secondary',
            default => 'primary',
        };
    }` : ''}

    public static function values(): array
    {
        return array_map(fn(self $status) => $status->value, self::cases());
    }
}`;
}

// ============================================
// API RESOURCE TEMPLATES
// ============================================

/**
 * Generate API Resource template
 */
export function apiResourceTemplate({
    namespace = 'App\\Http\\Resources',
    name,
    model,
    fields = [],
    withRelations = false
}) {
    return `<?php

namespace ${namespace};

use Illuminate\\Http\\Request;
use Illuminate\\Http\\Resources\\Json\\JsonResource;

class ${name} extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
${fields.map(f => {
    if (f.transform) {
        return `            '${f.name}' => ${f.transform},`;
    }
    return `            '${f.name}' => $this->${f.name},`;
}).join('\n')}
${withRelations ? `
            // Relations
            // 'comments' => CommentResource::collection($this->comments),` : ''}
        ];
    }
}`;
}


