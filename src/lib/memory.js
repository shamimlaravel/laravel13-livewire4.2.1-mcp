import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';

const MEMORY_DIR = join(process.cwd(), '.agent-memory');
const PROJECT_STATE_FILE = join(MEMORY_DIR, 'project-state.json');
const ENDPOINTS_FILE = join(MEMORY_DIR, 'endpoints.json');
const VERSIONS_DIR = join(MEMORY_DIR, 'versions');
const BUGS_FILE = join(MEMORY_DIR, 'bugs.json');

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readJSON(file, fallback = {}) {
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  ensureDir(dirname(file));
  writeFileSync(file, JSON.stringify(data, null, 2));
}

export function initMemory() {
  ensureDir(MEMORY_DIR);
  ensureDir(VERSIONS_DIR);
  if (!existsSync(PROJECT_STATE_FILE)) {
    writeJSON(PROJECT_STATE_FILE, {
      projectName: '',
      type: '',
      phases: [],
      currentPhase: 0,
      tasks: [],
      todos: [],
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      interrupted: false,
      lastAction: '',
      autoSync: true,
      completed: false,
    });
  }
  if (!existsSync(ENDPOINTS_FILE)) {
    writeJSON(ENDPOINTS_FILE, { endpoints: [], memories: [] });
  }
  if (!existsSync(BUGS_FILE)) {
    writeJSON(BUGS_FILE, { bugs: [], fixed: [] });
  }
}

export function getProjectState() {
  return readJSON(PROJECT_STATE_FILE);
}

export function saveProjectState(state) {
  state.lastUpdated = new Date().toISOString();
  writeJSON(PROJECT_STATE_FILE, state);
}

export function updatePhaseStatus(phaseIndex, taskIndex, status) {
  const state = getProjectState();
  if (state.phases[phaseIndex]?.tasks?.[taskIndex]) {
    state.phases[phaseIndex].tasks[taskIndex].status = status;
    saveProjectState(state);
    return calculateProgress(state);
  }
  return null;
}

export function calculateProgress(state) {
  if (!state.phases?.length) return { complete: 0, incomplete: 100, total: 0, done: 0 };
  let total = 0, done = 0;
  for (const phase of state.phases) {
    for (const task of phase.tasks || []) {
      total++;
      if (task.status === 'complete') done++;
    }
  }
  return {
    complete: total ? Math.round((done / total) * 100) : 0,
    incomplete: total ? Math.round(((total - done) / total) * 100) : 100,
    total,
    done,
  };
}

export function saveEndpoint(endpoint) {
  const data = readJSON(ENDPOINTS_FILE, { endpoints: [], memories: [] });
  const existing = data.endpoints.findIndex(e => e.path === endpoint.path && e.method === endpoint.method);
  if (existing >= 0) {
    data.endpoints[existing] = { ...data.endpoints[existing], ...endpoint, updatedAt: new Date().toISOString() };
  } else {
    data.endpoints.push({ ...endpoint, createdAt: new Date().toISOString() });
  }
  writeJSON(ENDPOINTS_FILE, data);
}

export function saveMemory(key, value) {
  const data = readJSON(ENDPOINTS_FILE, { endpoints: [], memories: [] });
  const existing = data.memories.findIndex(m => m.key === key);
  if (existing >= 0) {
    data.memories[existing].value = value;
    data.memories[existing].updatedAt = new Date().toISOString();
  } else {
    data.memories.push({ key, value, createdAt: new Date().toISOString() });
  }
  writeJSON(ENDPOINTS_FILE, data);
}

export function getMemory(key) {
  const data = readJSON(ENDPOINTS_FILE, { endpoints: [], memories: [] });
  return data.memories.find(m => m.key === key)?.value || null;
}

export function getAllMemories() {
  return readJSON(ENDPOINTS_FILE, { endpoints: [], memories: [] });
}

export function saveVersion(versionData) {
  ensureDir(VERSIONS_DIR);
  const version = versionData.version || `v${Date.now()}`;
  writeJSON(join(VERSIONS_DIR, `${version}.json`), {
    ...versionData,
    version,
    createdAt: new Date().toISOString(),
  });
  return version;
}

export function getVersions() {
  ensureDir(VERSIONS_DIR);
  if (!existsSync(VERSIONS_DIR)) return [];
  return readdirSync(VERSIONS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const data = readJSON(join(VERSIONS_DIR, f));
      return { version: data.version, description: data.description, createdAt: data.createdAt };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function restoreVersion(version) {
  const file = join(VERSIONS_DIR, `${version}.json`);
  if (!existsSync(file)) return null;
  return readJSON(file);
}

export function reportBug(bug) {
  const data = readJSON(BUGS_FILE, { bugs: [], fixed: [] });
  data.bugs.push({ ...bug, reportedAt: new Date().toISOString(), status: 'open' });
  writeJSON(BUGS_FILE, data);
}

export function markBugFixed(bugId) {
  const data = readJSON(BUGS_FILE, { bugs: [], fixed: [] });
  const idx = data.bugs.findIndex(b => b.id === bugId || b.description === bugId);
  if (idx >= 0) {
    const [bug] = data.bugs.splice(idx, 1);
    bug.fixedAt = new Date().toISOString();
    data.fixed.push(bug);
    writeJSON(BUGS_FILE, data);
    return bug;
  }
  return null;
}

export function getOpenBugs() {
  return readJSON(BUGS_FILE, { bugs: [], fixed: [] }).bugs;
}

export function setInterrupted(interrupted, lastAction = '') {
  const state = getProjectState();
  state.interrupted = interrupted;
  state.lastAction = lastAction;
  saveProjectState(state);
}

export function checkInterrupted() {
  const state = getProjectState();
  return state.interrupted ? state : null;
}

/**
 * @deprecated This function is not used by any tool
 */
export function addTask(task) {
  const state = getProjectState();
  state.tasks = state.tasks || [];
  state.tasks.push({ ...task, status: 'pending', createdAt: new Date().toISOString() });
  saveProjectState(state);
}

/**
 * @deprecated This function is not used by any tool
 */
export function addTodo(todo) {
  const state = getProjectState();
  state.todos = state.todos || [];
  state.todos.push({ ...todo, done: false, createdAt: new Date().toISOString() });
  saveProjectState(state);
}



export function getPlanTemplates() {
  return {
    saas: {
      name: 'SaaS Application',
      phases: [
        {
          name: 'Phase 1: Foundation',
          description: 'Project setup, authentication, base architecture',
          tasks: [
            { name: 'Install Laravel 13 + PHP 8.4', status: 'pending', type: 'setup' },
            { name: 'Configure Livewire v4.2', status: 'pending', type: 'setup' },
            { name: 'Set up multi-tenant architecture', status: 'pending', type: 'architecture' },
            { name: 'Implement authentication (login/register)', status: 'pending', type: 'feature' },
            { name: 'Create base layouts (guest/app/tenant)', status: 'pending', type: 'ui' },
          ],
        },
        {
          name: 'Phase 2: Core Features',
          description: 'Tenant management, billing, core business logic',
          tasks: [
            { name: 'Tenant CRUD and isolation', status: 'pending', type: 'feature' },
            { name: 'Subscription/billing system', status: 'pending', type: 'feature' },
            { name: 'User roles and permissions', status: 'pending', type: 'feature' },
            { name: 'Dashboard with analytics', status: 'pending', type: 'ui' },
            { name: 'Settings management', status: 'pending', type: 'feature' },
          ],
        },
        {
          name: 'Phase 3: Advanced Features',
          description: 'Notifications, API, integrations',
          tasks: [
            { name: 'Email notification system', status: 'pending', type: 'feature' },
            { name: 'REST API endpoints', status: 'pending', type: 'feature' },
            { name: 'File upload and storage', status: 'pending', type: 'feature' },
            { name: 'Search and filtering', status: 'pending', type: 'feature' },
            { name: 'Export/import functionality', status: 'pending', type: 'feature' },
          ],
        },
        {
          name: 'Phase 4: Polish & Deploy',
          description: 'Testing, optimization, deployment',
          tasks: [
            { name: 'Write Pest tests', status: 'pending', type: 'test' },
            { name: 'Security audit', status: 'pending', type: 'security' },
            { name: 'Performance optimization', status: 'pending', type: 'optimization' },
            { name: 'CI/CD pipeline', status: 'pending', type: 'devops' },
            { name: 'Production deployment', status: 'pending', type: 'devops' },
          ],
        },
      ],
    },
    enterprise: {
      name: 'Enterprise Application',
      phases: [
        {
          name: 'Phase 1: Foundation',
          description: 'Project setup, authentication, admin panel',
          tasks: [
            { name: 'Install Laravel 13 + PHP 8.4', status: 'pending', type: 'setup' },
            { name: 'Configure Livewire v4.2', status: 'pending', type: 'setup' },
            { name: 'Set up enterprise project structure', status: 'pending', type: 'architecture' },
            { name: 'Implement authentication + 2FA', status: 'pending', type: 'feature' },
            { name: 'Create admin panel layout', status: 'pending', type: 'ui' },
            { name: 'Set up RBAC (Role-Based Access Control)', status: 'pending', type: 'feature' },
          ],
        },
        {
          name: 'Phase 2: Core Modules',
          description: 'User management, content management, reporting',
          tasks: [
            { name: 'User management CRUD', status: 'pending', type: 'feature' },
            { name: 'Content management system', status: 'pending', type: 'feature' },
            { name: 'Audit logging system', status: 'pending', type: 'feature' },
            { name: 'Reporting and analytics', status: 'pending', type: 'feature' },
            { name: 'Data tables with pagination/search', status: 'pending', type: 'ui' },
          ],
        },
        {
          name: 'Phase 3: Integrations',
          description: 'Third-party services, API, webhooks',
          tasks: [
            { name: 'Email service integration', status: 'pending', type: 'feature' },
            { name: 'Payment gateway integration', status: 'pending', type: 'feature' },
            { name: 'Webhook system', status: 'pending', type: 'feature' },
            { name: 'API versioning', status: 'pending', type: 'feature' },
            { name: 'Third-party OAuth', status: 'pending', type: 'feature' },
          ],
        },
        {
          name: 'Phase 4: Enterprise Features',
          description: 'Multi-language, caching, queue workers',
          tasks: [
            { name: 'Localization/i18n', status: 'pending', type: 'feature' },
            { name: 'Cache optimization', status: 'pending', type: 'optimization' },
            { name: 'Queue workers and jobs', status: 'pending', type: 'feature' },
            { name: 'Real-time notifications', status: 'pending', type: 'feature' },
            { name: 'Backup and restore system', status: 'pending', type: 'feature' },
          ],
        },
        {
          name: 'Phase 5: Polish & Deploy',
          description: 'Testing, security, deployment',
          tasks: [
            { name: 'Comprehensive Pest tests', status: 'pending', type: 'test' },
            { name: 'Security audit and hardening', status: 'pending', type: 'security' },
            { name: 'Load testing', status: 'pending', type: 'test' },
            { name: 'Documentation', status: 'pending', type: 'docs' },
            { name: 'Production deployment', status: 'pending', type: 'devops' },
          ],
        },
      ],
    },
    ecommerce: {
      name: 'E-Commerce Application',
      phases: [
        {
          name: 'Phase 1: Foundation',
          description: 'Project setup, product catalog, cart',
          tasks: [
            { name: 'Install Laravel 13 + PHP 8.4', status: 'pending', type: 'setup' },
            { name: 'Configure Livewire v4.2', status: 'pending', type: 'setup' },
            { name: 'Set up e-commerce structure', status: 'pending', type: 'architecture' },
            { name: 'Product catalog (CRUD)', status: 'pending', type: 'feature' },
            { name: 'Shopping cart system', status: 'pending', type: 'feature' },
            { name: 'Guest/registered user flows', status: 'pending', type: 'feature' },
          ],
        },
        {
          name: 'Phase 2: Checkout & Payments',
          description: 'Checkout flow, payment processing, orders',
          tasks: [
            { name: 'Checkout flow (multi-step)', status: 'pending', type: 'feature' },
            { name: 'Payment gateway (Stripe/PayPal)', status: 'pending', type: 'feature' },
            { name: 'Order management', status: 'pending', type: 'feature' },
            { name: 'Shipping and tax calculation', status: 'pending', type: 'feature' },
            { name: 'Invoice generation', status: 'pending', type: 'feature' },
          ],
        },
        {
          name: 'Phase 3: User Experience',
          description: 'Search, reviews, wishlist, recommendations',
          tasks: [
            { name: 'Product search and filtering', status: 'pending', type: 'feature' },
            { name: 'Product reviews and ratings', status: 'pending', type: 'feature' },
            { name: 'Wishlist functionality', status: 'pending', type: 'feature' },
            { name: 'Category and brand pages', status: 'pending', type: 'ui' },
            { name: 'Related products/recommendations', status: 'pending', type: 'feature' },
          ],
        },
        {
          name: 'Phase 4: Admin Panel',
          description: 'Admin dashboard, inventory, analytics',
          tasks: [
            { name: 'Admin dashboard', status: 'pending', type: 'ui' },
            { name: 'Inventory management', status: 'pending', type: 'feature' },
            { name: 'Order fulfillment workflow', status: 'pending', type: 'feature' },
            { name: 'Sales analytics and reports', status: 'pending', type: 'feature' },
            { name: 'Customer management', status: 'pending', type: 'feature' },
          ],
        },
        {
          name: 'Phase 5: Polish & Deploy',
          description: 'Testing, SEO, deployment',
          tasks: [
            { name: 'SEO optimization', status: 'pending', type: 'optimization' },
            { name: 'Performance optimization', status: 'pending', type: 'optimization' },
            { name: 'Security audit', status: 'pending', type: 'security' },
            { name: 'Write tests', status: 'pending', type: 'test' },
            { name: 'Production deployment', status: 'pending', type: 'devops' },
          ],
        },
      ],
    },
    portfolio: {
      name: 'Portfolio Application',
      phases: [
        {
          name: 'Phase 1: Foundation',
          description: 'Project setup, layouts, design system',
          tasks: [
            { name: 'Install Laravel 13 + PHP 8.4', status: 'pending', type: 'setup' },
            { name: 'Configure Livewire v4.2', status: 'pending', type: 'setup' },
            { name: 'Set up portfolio structure', status: 'pending', type: 'architecture' },
            { name: 'Create responsive layouts', status: 'pending', type: 'ui' },
            { name: 'Design system and components', status: 'pending', type: 'ui' },
          ],
        },
        {
          name: 'Phase 2: Core Pages',
          description: 'Home, about, projects, contact',
          tasks: [
            { name: 'Hero/landing page', status: 'pending', type: 'ui' },
            { name: 'About page', status: 'pending', type: 'ui' },
            { name: 'Projects/portfolio gallery', status: 'pending', type: 'ui' },
            { name: 'Project detail pages', status: 'pending', type: 'ui' },
            { name: 'Contact form', status: 'pending', type: 'feature' },
          ],
        },
        {
          name: 'Phase 3: Features',
          description: 'Blog, testimonials, animations',
          tasks: [
            { name: 'Blog system', status: 'pending', type: 'feature' },
            { name: 'Testimonials section', status: 'pending', type: 'ui' },
            { name: 'Smooth animations/transitions', status: 'pending', type: 'ui' },
            { name: 'Dark/light mode toggle', status: 'pending', type: 'feature' },
            { name: 'Admin CMS for content', status: 'pending', type: 'feature' },
          ],
        },
        {
          name: 'Phase 4: Polish & Deploy',
          description: 'SEO, performance, deployment',
          tasks: [
            { name: 'SEO optimization', status: 'pending', type: 'optimization' },
            { name: 'Performance optimization', status: 'pending', type: 'optimization' },
            { name: 'Accessibility audit', status: 'pending', type: 'security' },
            { name: 'Production deployment', status: 'pending', type: 'devops' },
          ],
        },
      ],
    },
  };
}
