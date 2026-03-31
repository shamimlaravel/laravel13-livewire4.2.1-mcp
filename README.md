# laravel13-livewire4.2.1-mcp

MCP Server for Livewire v4.2+ / Laravel 13 / PHP 8.4+ — Full-stack AI agent with planning, memory, bug fixing, versioning, GitHub integration, and design conversion.

## Version

2.0.0

## Tools

### Planning & Project Management
| Tool | Description |
|------|-------------|
| `generate_plan` | `/plan {keyword}` — Full stack plan (saas/enterprise/ecommerce/portfolio) |
| `update_task_status` | Update task status with auto-git-sync on completion |
| `get_project_status` | Show progress %, phases, and task status |
| `continue_project` | Resume interrupted session |

### Code Generation
| Tool | Description |
|------|-------------|
| `generate_livewire_component` | Generate SFC/MFC/Class-based Livewire components |
| `generate_crud_component` | Complete CRUD with modal, pagination, search, authorization |
| `generate_data_table` | Data table with sorting, filtering, bulk actions, export |
| `generate_form_component` | Forms with relationships, file uploads, validation |
| `generate_layout` | Blade layouts (base/app/guest/admin/tenant/auth/dashboard/error) |
| `generate_eloquent_model` | Laravel 13 models with PHP attributes, relationships, scopes |
| `generate_routes` | Routes with middleware groups and named routes |
| `generate_test` | Comprehensive Pest tests with auth, validation, assertions |
| `generate_modal_component` | Reusable modals (confirm, delete, form, alert, info) |
| `generate_file_upload_component` | File upload with preview, validation, progress |
| `generate_search_filter_component` | Multi-field search/filter with date range, pagination |
| `generate_chart_widget` | Dashboard charts/widgets (stats, line, bar, pie, activity) |
| `generate_policy` | Policy classes for model authorization |
| `generate_observer` | Model observers for event handling |
| `generate_trait` | Reusable traits (HasSlug, HasTenant, Sortable, etc.) |
| `generate_middleware` | HTTP middleware (Admin, Tenant, RateLimit, etc.) |
| `generate_service_class` | Service classes for business logic |
| `generate_project_structure` | Enterprise/SaaS/API project structure |

### Bug Fixing & Security
| Tool | Description |
|------|-------------|
| `fix_bugs` | `/fix` — Auto-detect and fix bugs |
| `deep_scan_bugs` | Deep scan for bugs in tables, lists, files, validation, types |
| `scan_project_bugs` | Scan entire project directory for common bugs |
| `get_open_bugs` | Get list of all open (unfixed) bugs |
| `get_fixed_bugs` | Get list of all fixed bugs |
| `mark_bug_fixed` | Mark a bug as fixed by ID |
| `security_audit` | Audit code for XSS, SQL injection, mass assignment, CSRF |

### Deep Scan Bug Categories
- **Tables**: wire:key, sort headers, tbody, td click handlers
- **Lists**: UL/OL/LI, grid items, flex items, foreach security
- **Files**: WithFileUploads, MIME validation, store security
- **Validation**: create/update/fill without validate, save methods
- **Authorization**: delete/restore without authorize, Gate usage
- **Security**: XSS, SQL injection, command injection, open redirect
- **Types**: Untyped properties, missing return types
- **Pagination**: Missing resetPage on search/filter
- **Models**: find() vs findOrFail, fillable, timestamps, relationships

### Memory & RAG
| Tool | Description |
|------|-------------|
| `memorize_endpoint` | Memorize API endpoints for RAG |
| `memorize` | Store key-value project memories |
| `recall_context` | Recall memorized endpoints and decisions |

### Version Control
| Tool | Description |
|------|-------------|
| `create_version` | Create version snapshot |
| `list_versions` | List all versions |
| `restore_version` | Restore to previous version |

### GitHub Integration
| Tool | Description |
|------|-------------|
| `gh_auth_status` | Check GitHub CLI authentication |
| `gh_auth_login` | Authenticate with GitHub |
| `gh_repo_create` | Create GitHub repository |
| `git_commit` | Auto-generate conventional commit messages |
| `git_push` | Push to remote |
| `git_pull` | Pull from remote |
| `git_tag_create` | Create annotated version tags |
| `git_tag_list` | List all tags |
| `git_status` | Show git status |
| `git_branch_create` | Create new branch |
| `git_branch_list` | List branches |
| `git_branch_merge` | Merge branch |
| `git_branch_delete` | Delete branch |
| `gh_pr_create` | Create Pull Request |
| `gh_pr_list` | List Pull Requests |
| `gh_pr_merge` | Merge PR |
| `gh_issue_create` | Create GitHub Issue |
| `gh_issue_list` | List Issues |
| `gh_release_create` | Create GitHub Release |
| `gh_ci_setup` | Setup GitHub Actions CI |
| `git_sync` | Manual sync (commit + push) |
| `git_auto_sync_toggle` | Toggle auto-sync on task completion |
| `git_full_setup` | Full workflow: auth→init→create→commit→push→tag |

### Design Conversion
| Tool | Description |
|------|-------------|
| `convert_html_to_livewire` | Convert HTML to Livewire |
| `convert_image_to_livewire` | Image/mockup → Livewire |
| `convert_stitch_to_livewire` | Google Stitch → Livewire |
| `convert_figma_to_livewire` | Figma → Livewire |

### Installation
| Tool | Description |
|------|-------------|
| `install_laravel` | Laravel install + PHP 8.4 upgrade commands |

## Installation

```bash
cd laravel13-livewire4.2.1-mcp
npm install
npm start
```

## Configuration (mcp-config.json)

```json
{
  "mcpServers": {
    "laravel13-livewire4.2.1-mcp": {
      "command": "node",
      "args": ["laravel13-livewire4.2.1-mcp/src/index.js"]
    }
  }
}
```

## Features

- **Planning**: Generate full-stack plans for SaaS, Enterprise, E-Commerce, Portfolio
- **Memory**: Persistent project state, tasks, phases, todos across sessions
- **Auto-Sync**: Every task completion auto-commits and pushes to GitHub
- **100% Auto-Push**: When all tasks complete → auto commit + push + tag v1.0.0 + GitHub Release
- **Bug Fixing**: Auto-detect and fix 10+ bug patterns
- **Version Control**: Snapshots, restore, git tags with descriptions
- **GitHub Integration**: Auth, repo creation, PRs, issues, releases, CI
- **Design Conversion**: HTML, Image, Stitch, Figma → Livewire
- **Security**: Validation, authorization, locked properties, XSS prevention
- **Token Optimization**: No garbage code, no unused imports, PHP 8.4 shorthand

## Auto-Sync Behavior

**On Task Completion**:
```
Task completed → git add . → git commit (auto message) → git push
```

**On Phase Completion**:
```
Phase complete → git add . → git commit → git push → git tag v0.X.0
```

**On 100% Project Completion**:
```
100% complete → git add . → git commit → git push → git tag v1.0.0 → gh release create
```

## Security Features

- Auto-add `#[Locked]` for ID and role properties
- Auto-add `$this->authorize()` for mutations
- CSRF meta tag in all layouts
- Rate limiting attributes on sensitive endpoints
- File upload MIME validation
- XSS prevention with `{{ }}` escaping
- SQL injection prevention with parameter binding
- Mass assignment protection with `#[Fillable]`
