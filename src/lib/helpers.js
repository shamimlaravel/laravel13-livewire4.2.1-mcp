/**
 * Helper functions for clean, DRY code generation
 * Laravel 13 + Livewire 4.2 MCP Server
 * 
 * These utilities eliminate code duplication across all 23+ code generation tools
 */

// ============================================
// STRING UTILITIES
// ============================================

/**
 * Convert string to PascalCase
 * @param {string} str - Input string (e.g., "post.create")
 * @returns {string} PascalCase string (e.g., "PostCreate")
 */
export function toPascalCase(str) {
    if (!str) return '';
    return str
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}

/**
 * Convert string to camelCase
 * @param {string} str - Input string
 * @returns {string} camelCase string
 */
export function toCamelCase(str) {
    const pascal = toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Convert string to snake_case
 * @param {string} str - Input string
 * @returns {string} snake_case string
 */
export function toSnakeCase(str) {
    if (!str) return '';
    return str
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase();
}

/**
 * Convert string to Title Case
 * @param {string} str - Input string
 * @returns {string} Title Case string
 */
export function toTitleCase(str) {
    if (!str) return '';
    return str
        .replace(/[-_]/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

/**
 * Convert dot notation to path (e.g., "post.create" -> "post/create")
 */
export function toPath(str) {
    return str.replace(/\./g, '/');
}

// ============================================
// MODEL UTILITIES
// ============================================

/**
 * Extract model information from class name
 * Eliminates 12+ duplicate patterns in current code
 * 
 * @param {string} modelClass - Full model class (e.g., "App\\Models\\Post")
 * @returns {{ name: string, variable: string, namespace: string, fullName: string }}
 */
export function extractModelInfo(modelClass) {
    if (!modelClass) {
        return { 
            name: 'Model', 
            variable: 'model', 
            namespace: 'App\\Models',
            fullName: 'App\\Models\\Model'
        };
    }
    
    const parts = modelClass.split('\\').filter(Boolean);
    const name = parts[parts.length - 1];
    const variable = name.charAt(0).toLowerCase() + name.slice(1);
    const namespace = parts.length > 1 
        ? parts.slice(0, -1).join('\\') 
        : 'App\\Models';
    
    return { 
        name, 
        variable, 
        namespace,
        fullName: modelClass 
    };
}

/**
 * Generate namespace from component name
 * @param {string} componentName - Component name (e.g., "Post.Create")
 * @returns {string} Namespace (e.g., "Post")
 */
export function extractNamespace(componentName) {
    const parts = componentName.split('.');
    return parts.length > 1 ? toPascalCase(parts.slice(0, -1).join(' ')) : '';
}

/**
 * Generate class name from component name
 * @param {string} componentName - Component name (e.g., "Post.Create")
 * @returns {string} Class name (e.g., "Create")
 */
export function extractClassName(componentName) {
    const parts = componentName.split('.');
    return toPascalCase(parts[parts.length - 1]);
}

// ============================================
// VALIDATION UTILITIES
// ============================================

/**
 * Generate PHP validation rules from fields
 * Eliminates 5+ duplicate patterns in current code
 * 
 * @param {Array} fields - Array of field objects with name and rules
 * @param {Object} options - Configuration options
 * @returns {string} Formatted PHP rules array
 */
export function generateValidationRules(fields, options = {}) {
    const { 
        indent = '            ', 
        requiredByDefault = true,
        includeNullable = false
    } = options;
    
    const rules = fields
        .filter(f => f.rules && !f.isFile)
        .map(f => `${indent}'${f.name}' => '${f.rules}',`);
    
    if (includeNullable) {
        rules.push(`${indent}'nullable' => 'nullable',`);
    }
    
    return rules.join('\n');
}

/**
 * Generate #[Validate] attribute for Livewire 4.2+
 * @param {Array} fields - Array of field objects
 * @returns {string} Validate attribute or empty string
 */
export function generateValidateAttribute(fields) {
    const validFields = fields.filter(f => f.rules && !f.isFile);
    if (validFields.length === 0) return '';
    
    const rules = validFields
        .map(f => `'${f.name}' => '${f.rules}'`)
        .join(', ');
    
    return `#[Validate([${rules}])]`;
}

/**
 * Generate validation rules method
 * @param {Array} fields - Array of field objects
 * @returns {string} Complete rules() method
 */
export function generateRulesMethod(fields) {
    const rules = generateValidationRules(fields);
    
    return `public function rules(): array
    {
        return [
${rules}
        ];
    }`;
}

// ============================================
// AUTHORIZATION UTILITIES
// ============================================

/**
 * Generate authorization checks for CRUD operations
 * Eliminates 6+ duplicate patterns in current code
 * 
 * @param {Object} options - Configuration
 * @returns {Object} Auth check strings for each operation
 */
export function generateAuthChecks(options) {
    const { 
        authorize, 
        modelName, 
        modelVar,
        useAttributes = true
    } = options;
    
    if (!authorize) {
        return {
            create: '',
            update: '',
            delete: '',
            attribute: ''
        };
    }
    
    if (useAttributes) {
        return {
            create: `$this->authorize('create', ${modelName}::class);`,
            update: `$this->authorize('update', $${modelVar});`,
            delete: `$this->authorize('delete', $${modelVar});`,
            attribute: `#[Authorize('update', ${modelName}::class)]`
        };
    }
    
    return {
        create: `$this->authorize('create', ${modelName}::class);`,
        update: `$this->authorize('update', $${modelVar});`,
        delete: `$this->authorize('delete', $${modelVar});`,
        attribute: ''
    };
}

// ============================================
// PROPERTY UTILITIES
// ============================================

/**
 * Generate PHP property declaration
 * @param {Object} field - Field object
 * @param {Object} options - Configuration
 * @returns {string} Property declaration
 */
export function generateProperty(field, options = {}) {
    const { 
        visibility = 'public',
        includeType = true,
        includeDefault = true,
        readonly = false 
    } = options;
    
    const type = includeType ? (field.type || 'string') : '';
    const readonlyStr = readonly ? 'readonly ' : '';
    const defaultVal = includeDefault ? getDefaultForType(field.type) : '';
    
    return `${visibility} ${readonlyStr}${type} $${field.name}${defaultVal};`;
}

/**
 * Generate multiple properties with proper indentation
 * @param {Array} fields - Array of field objects
 * @param {Object} options - Configuration
 * @returns {string} Formatted properties
 */
export function generateProperties(fields, options = {}) {
    return fields
        .map(f => `    ${generateProperty(f, options)}`)
        .join('\n');
}

/**
 * Get default value for PHP type
 * @param {string} type - PHP type
 * @returns {string} Default value assignment
 */
export function getDefaultForType(type) {
    const defaults = {
        'string': " = ''",
        'int': ' = 0',
        'float': ' = 0.0',
        'bool': ' = false',
        'array': ' = []',
        'Collection': ' = collect()',
        '?string': ' = null',
        '?int': ' = null',
        '?float': ' = null',
        '?bool': ' = null',
        '?array': ' = null',
        'null': '',
        'mixed': '',
        '': ''
    };
    return defaults[type] || '';
}

/**
 * Generate fillable array for Eloquent model
 * @param {Array} fields - Array of field objects
 * @returns {string} Formatted fillable array
 */
export function generateFillableArray(fields) {
    const fillable = fields
        .filter(f => !f.isFile && f.fillable !== false)
        .map(f => `        '${f.name}'`)
        .join(',\n');
    
    return `protected array $fillable = [
${fillable}
    ];`;
}

/**
 * Generate casts array for Eloquent model
 * @param {Array} fields - Array of field objects
 * @returns {string} Formatted casts array or empty string
 */
export function generateCastsArray(fields) {
    const castable = fields.filter(f => f.cast);
    if (castable.length === 0) return '';
    
    const casts = castable
        .map(f => `        '${f.name}' => ${f.cast},`)
        .join('\n');
    
    return `protected array $casts = [
${casts}
    ];`;
}

// ============================================
// PHP CODE GENERATION
// ============================================

/**
 * Generate PHP use statements
 * @param {Array} imports - Array of import strings
 * @returns {string} Formatted use statements
 */
export function generateUseStatements(imports) {
    if (!imports || imports.length === 0) return '';
    
    return imports
        .filter(imp => imp && imp.trim())
        .map(imp => `use ${imp};`)
        .join('\n');
}

/**
 * Generate PHP class header with namespace, imports, and attributes
 * Eliminates 15+ duplicate patterns in current code
 * 
 * @param {Object} options - Configuration
 * @returns {string} Class header
 */
export function generateClassHeader(options) {
    const { 
        namespace, 
        imports = [], 
        layout, 
        title,
        attributes = []
    } = options;
    
    let header = '<?php\n\n';
    
    if (namespace) {
        header += `namespace ${namespace};\n\n`;
    }
    
    // Add standard imports
    const allImports = [...imports];
    
    // Add Livewire imports if needed
    if (layout || title || attributes.length > 0) {
        allImports.push('Livewire\\Component');
        
        const attributeImports = [];
        if (layout) attributeImports.push('Layout');
        if (title) attributeImports.push('Title');
        attributes.forEach(attr => {
            if (!attributeImports.includes(attr)) attributeImports.push(attr);
        });
        
        if (attributeImports.length > 0) {
            allImports.push(`Livewire\\Attributes\\{${attributeImports.join(', ')}}`);
        }
    }
    
    if (allImports.length > 0) {
        header += allImports.map(i => `use ${i};`).join('\n') + '\n\n';
    }
    
    // Add PHP attributes
    if (layout) {
        header += `#[Layout('${layout}')]\n`;
    }
    if (title) {
        header += `#[Title('${title}')]\n`;
    }
    
    return header;
}

/**
 * Generate Blade component slot
 * @param {string} name - Slot name
 * @param {string} content - Slot content
 * @returns {string} Blade slot markup
 */
export function generateSlot(name, content = '') {
    if (!content) {
        return `<x-slot name="${name}"></x-slot>`;
    }
    return `<x-slot name="${name}">\n    ${content}\n</x-slot>`;
}

/**
 * Generate Blade component
 * @param {string} name - Component name
 * @param {Object} props - Component props
 * @param {string} content - Component content
 * @returns {string} Blade component markup
 */
export function generateBladeComponent(name, props = {}, content = '') {
    const propsStr = Object.entries(props)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ');
    
    if (content) {
        return `<x-${name} ${propsStr}>\n    ${content}\n</x-${name}>`;
    }
    return `<x-${name} ${propsStr} />`;
}

// ============================================
// FIELD UTILITIES
// ============================================

/**
 * Parse field definition from string or object
 * @param {string|Object} field - Field definition
 * @returns {Object} Normalized field object
 */
export function parseField(field) {
    if (typeof field === 'string') {
        const [name, type = 'string', rules = ''] = field.split(':');
        return { name, type, rules };
    }
    
    return {
        name: field.name,
        type: field.type || 'string',
        rules: field.rules || '',
        default: field.default,
        cast: field.cast,
        fillable: field.fillable !== false,
        isFile: field.isFile || false
    };
}

/**
 * Parse array of fields
 * @param {Array} fields - Array of field definitions
 * @returns {Array} Normalized field objects
 */
export function parseFields(fields) {
    if (!fields || fields.length === 0) return [];
    return fields.map(parseField);
}

/**
 * Get column definition for migration
 * @param {Object} field - Field object
 * @returns {string} Migration column definition
 */
export function generateMigrationColumn(field) {
    const { name, type, rules } = field;
    
    // Map types to migration methods
    const typeMap = {
        'string': `$table->string('${name}')`,
        'int': `$table->integer('${name}')`,
        'integer': `$table->integer('${name}')`,
        'float': `$table->float('${name}')`,
        'double': `$table->double('${name}')`,
        'decimal': `$table->decimal('${name}')`,
        'boolean': `$table->boolean('${name}')`,
        'bool': `$table->boolean('${name}')`,
        'text': `$table->text('${name}')`,
        'longText': `$table->longText('${name}')`,
        'json': `$table->json('${name}')`,
        'date': `$table->date('${name}')`,
        'datetime': `$table->dateTime('${name}')`,
        'timestamp': `$table->timestamp('${name}')`,
        'time': `$table->time('${name}')`,
        'year': `$table->year('${name}')`,
        'enum': `$table->enum('${name}', [])`,
        'uuid': `$table->uuid('${name}')`,
        'foreignId': `$table->foreignId('${name}')`,
        'unsignedBigInteger': `$table->unsignedBigInteger('${name}')`
    };
    
    let column = typeMap[type] || `$table->string('${name}')`;
    
    // Add modifiers based on rules
    if (rules) {
        if (rules.includes('required') && !rules.includes('nullable')) {
            column += '->required()';
        }
        if (rules.includes('nullable')) {
            column += '->nullable()';
        }
        if (rules.includes('unique')) {
            column += '->unique()';
        }
        if (rules.includes('email')) {
            column += '->email()';
        }
        if (rules.includes('url')) {
            column += '->url()';
        }
    }
    
    return `${column};`;
}

// ============================================
// VALIDATION & SANITIZATION
// ============================================

/**
 * Sanitize user input for code generation
 * @param {string} input - User input
 * @returns {string} Sanitized input
 */
export function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input
        .replace(/[^a-zA-Z0-9_\-\.\/\\]/g, '')
        .substring(0, 200);
}

/**
 * Validate field definition
 * @param {Object} field - Field to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateField(field) {
    const errors = [];
    
    if (!field.name || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.name)) {
        errors.push(`Invalid field name: ${field.name}`);
    }
    
    if (field.type && !isValidPhpType(field.type)) {
        errors.push(`Invalid type: ${field.type}`);
    }
    
    return { valid: errors.length === 0, errors };
}

/**
 * Check if a string is a valid PHP type
 * @param {string} type - Type to check
 * @returns {boolean}
 */
export function isValidPhpType(type) {
    const validTypes = [
        'string', 'int', 'integer', 'float', 'double', 'bool', 'boolean',
        'array', 'object', 'mixed', 'null', 'void', 'never',
        'Collection', 'DateTime', 'Carbon',
        '?string', '?int', '?float', '?bool', '?array', '?object'
    ];
    return validTypes.includes(type) || type.endsWith('::class');
}

/**
 * Validate component name
 * @param {string} name - Component name
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateComponentName(name) {
    if (!name) {
        return { valid: false, error: 'Component name is required' };
    }
    
    const pattern = /^[a-zA-Z][a-zA-Z0-9\-\.]*[a-zA-Z0-9]$/;
    if (!pattern.test(name)) {
        return { valid: false, error: 'Invalid component name format' };
    }
    
    return { valid: true, error: null };
}

// ============================================
// TEMPLATE UTILITIES
// ============================================

/**
 * Format PHP code with consistent indentation
 * @param {string} code - Raw PHP code
 * @returns {string} Formatted PHP code
 */
export function formatPhpCode(code) {
    return code
        .replace(/\n{3,}/g, '\n\n')  // Remove multiple blank lines
        .replace(/\t/g, '    ')      // Tabs to spaces
        .trim();
}

/**
 * Join array items with newlines and indentation
 * @param {Array} items - Items to join
 * @param {string} indent - Indentation string
 * @returns {string} Joined string
 */
export function indentJoin(items, indent = '    ') {
    return items
        .filter(item => item && item.trim())
        .map(item => item.startsWith(indent) ? item : `${indent}${item}`)
        .join('\n');
}

/**
 * Generate array format for PHP
 * @param {Array} items - Array items
 * @param {string} indent - Indentation
 * @returns {string} PHP array format
 */
export function generatePhpArray(items, indent = '    ') {
    if (!items || items.length === 0) return '[]';
    
    const formatted = items
        .map((item, i) => `${indent}'${item}'${i < items.length - 1 ? ',' : ','}`)
        .join('\n');
    
    return `[\n${formatted}\n${indent.slice(4)}]`;
}

// ============================================
// FILE PATH UTILITIES
// ============================================

/**
 * Convert component name to file path
 * @param {string} componentName - Component name (e.g., "Post.Create")
 * @param {string} type - File type ('livewire', 'blade', 'model')
 * @returns {string} File path
 */
export function componentToFilePath(componentName, type = 'livewire') {
    const path = toPath(componentName);
    
    switch (type) {
        case 'livewire':
            return `app/Livewire/${path}.php`;
        case 'blade':
            return `resources/views/livewire/${path}.blade.php`;
        default:
            return path;
    }
}

/**
 * Convert model class to file path
 * @param {string} modelClass - Model class (e.g., "App\\Models\\Post")
 * @returns {string} File path
 */
export function modelToFilePath(modelClass) {
    const parts = modelClass.split('\\');
    const name = parts[parts.length - 1];
    return `app/Models/${name}.php`;
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Common PHP imports for Livewire components
 */
export const LIVEWIRE_IMPORTS = {
    component: 'Livewire\\Component',
    attributes: {
        layout: 'Livewire\\Attributes\\Layout',
        title: 'Livewire\\Attributes\\Title',
        validate: 'Livewire\\Attributes\\Validate',
        authorize: 'Livewire\\Attributes\\Authorize',
        computed: 'Livewire\\Attributes\\Computed',
        locked: 'Livewire\\Attributes\\Locked',
        url: 'Livewire\\Attributes\\Url',
        on: 'Livewire\\Attributes\\On',
        defer: 'Livewire\\Attributes\\Defer'
    },
    traits: {
        pagination: 'Livewire\\WithPagination',
        fileUploads: 'Livewire\\WithFileUploads',
        validates: 'Livewire\\ValidatesInput'
    }
};

/**
 * Common PHP imports for Laravel
 */
export const LARAVEL_IMPORTS = {
    validation: 'Illuminate\\Support\\Facades\\Validator',
    auth: 'Illuminate\\Support\\Facades\\Auth',
    gate: 'Illuminate\\Support\\Facades\\Gate',
    db: 'Illuminate\\Support\\Facades\\DB',
    cache: 'Illuminate\\Support\\Facades\\Cache',
    mail: 'Illuminate\\Support\\Facades\\Mail',
    notification: 'Illuminate\\Support\\Facades\\Notification',
    storage: 'Illuminate\\Support\\Facades\\Storage',
    event: 'Illuminate\\Support\\Facades\\Event',
    queue: 'Illuminate\\Support\\Facades\\Queue'
};

/**
 * Default layout paths
 */
export const DEFAULT_LAYOUTS = {
    app: 'layouts.app',
    guest: 'layouts.guest',
    admin: 'layouts.admin',
    auth: 'layouts.auth',
    dashboard: 'layouts.dashboard'
};

/**
 * Default validation messages
 */
export const VALIDATION_MESSAGES = {
    required: 'The :attribute field is required.',
    email: 'The :attribute must be a valid email address.',
    max: 'The :attribute may not be greater than :max characters.',
    min: 'The :attribute must be at least :min characters.',
    unique: 'The :attribute has already been taken.',
    exists: 'The selected :attribute is invalid.',
    array: 'The :attribute must be an array.',
    file: 'The :attribute must be a file.',
    mimes: 'The :attribute must be a file of type: :values.',
    max_file: 'The :attribute may not be greater than :max kilobytes.'
};
