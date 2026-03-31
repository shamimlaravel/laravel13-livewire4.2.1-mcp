import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { getProjectState, saveProjectState, calculateProgress } from './memory.js';

export function checkGHInstalled() {
  try {
    execSync('gh --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function checkGHAuth() {
  try {
    const output = execSync('gh auth status', { stdio: 'pipe', encoding: 'utf-8' });
    return { authenticated: true, status: output };
  } catch (error) {
    return { authenticated: false, error: error.stderr?.toString() || error.message };
  }
}

export function ensureGHAuth() {
  const status = checkGHAuth();
  if (!status.authenticated) {
    return {
      needsLogin: true,
      command: 'gh auth login',
      message: 'Not authenticated with GitHub. Run: gh auth login\n\nOptions:\n- gh auth login --web (recommended)\n- gh auth login --with-token\n- gh auth login --git-protocol https',
    };
  }
  return { needsLogin: false, status };
}

export function initGitRepo(projectDir) {
  try {
    if (!existsSync(join(projectDir, '.git'))) {
      execSync('git init', { cwd: projectDir, stdio: 'pipe' });
      return { success: true, message: 'Git repository initialized' };
    }
    return { success: true, message: 'Git repository already exists' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function createGitHubRepo(name, options = {}) {
  const { description = '', visibility = 'private', team = '', remote = 'origin' } = options;
  try {
    const authCheck = ensureGHAuth();
    if (authCheck.needsLogin) return authCheck;
    const visibilityFlag = visibility === 'public' ? '--public' : '--private';
    const descFlag = description ? `--description "${description}"` : '';
    const teamFlag = team ? `--team "${team}"` : '';
    const cmd = `gh repo create ${name} ${visibilityFlag} ${descFlag} ${teamFlag} --source=. --remote=${remote} --push`;
    execSync(cmd, { stdio: 'pipe', encoding: 'utf-8' });
    return { success: true, repo: `https://github.com/${name}`, message: `Repository created: ${name}` };
  } catch (error) {
    return { success: false, error: error.stderr?.toString() || error.message };
  }
}

function generateCommitBody(projectState, progress) {
  const phase = projectState.phases?.[projectState.currentPhase];
  const completedTasks = phase?.tasks?.filter(t => t.status === 'complete') || [];
  const inProgressTasks = phase?.tasks?.filter(t => t.status === 'in_progress') || [];
  let body = '';
  if (completedTasks.length) {
    body += '\nCompleted tasks:\n';
    completedTasks.forEach(t => body += `- ${t.name}\n`);
  }
  if (inProgressTasks.length) {
    body += '\nIn progress:\n';
    inProgressTasks.forEach(t => body += `- ${t.name}\n`);
  }
  body += `\nProgress: ${progress.complete}% complete (${progress.done}/${progress.total} tasks)`;
  return body.trim();
}

export function generateCommitMessage(projectState, files = []) {
  const progress = calculateProgress(projectState);
  const phase = projectState.phases?.[projectState.currentPhase];
  const completedTasks = phase?.tasks?.filter(t => t.status === 'complete') || [];
  const lastCompleted = completedTasks[completedTasks.length - 1];
  const type = lastCompleted?.type || 'feature';
  const typeMap = {
    setup: 'chore', feature: 'feat', ui: 'feat', architecture: 'refactor',
    test: 'test', security: 'security', optimization: 'perf', devops: 'ci',
    docs: 'docs', fix: 'fix', custom: 'feat',
  };
  const scope = phase?.name?.split(':')[1]?.trim() || 'project';
  const description = lastCompleted?.name || 'update project';
  const header = `${typeMap[type] || 'feat'}(${scope.toLowerCase().replace(/\s+/g, '-')}): ${description.toLowerCase()}`;
  const body = generateCommitBody(projectState, progress);
  return { type: typeMap[type] || 'feat', scope: scope.toLowerCase().replace(/\s+/g, '-'), description: description.toLowerCase(), body, formatted: `${header}\n\n${body}` };
}

export function gitCommit(files = [], message = '', projectState = null) {
  try {
    let commitMessage = message;
    if (!commitMessage && projectState) {
      commitMessage = generateCommitMessage(projectState, files).formatted;
    }
    if (!commitMessage) commitMessage = 'chore(project): update files';
    if (files.length) {
      execSync(`git add ${files.join(' ')}`, { stdio: 'pipe' });
    } else {
      execSync('git add .', { stdio: 'pipe' });
    }
    execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
    return { success: true, message: 'Committed successfully', commitMessage };
  } catch (error) {
    return { success: false, error: error.stderr?.toString() || error.message };
  }
}

export function gitPush(remote = 'origin', branch = '') {
  try {
    if (!branch) branch = execSync('git branch --show-current', { stdio: 'pipe', encoding: 'utf-8' }).trim();
    execSync(`git push -u ${remote} ${branch}`, { stdio: 'pipe' });
    return { success: true, message: `Pushed to ${remote}/${branch}` };
  } catch (error) {
    return { success: false, error: error.stderr?.toString() || error.message };
  }
}

export function gitPull(remote = 'origin', branch = '') {
  try {
    if (!branch) branch = execSync('git branch --show-current', { stdio: 'pipe', encoding: 'utf-8' }).trim();
    execSync(`git pull ${remote} ${branch}`, { stdio: 'pipe' });
    return { success: true, message: `Pulled from ${remote}/${branch}` };
  } catch (error) {
    return { success: false, error: error.stderr?.toString() || error.message };
  }
}

export function createVersionTag(version, description = '', projectState = null) {
  try {
    const tag = version.startsWith('v') ? version : `v${version}`;
    const progress = projectState ? calculateProgress(projectState) : null;
    const message = description || (projectState ? `Phase ${projectState.currentPhase + 1}: ${projectState.phases?.[projectState.currentPhase]?.name || 'update'} - ${progress?.complete || 0}% complete` : 'Version release');
    execSync(`git tag -a ${tag} -m "${message.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
    try { execSync(`git push origin ${tag}`, { stdio: 'pipe' }); } catch {}
    return { success: true, tag, message: `Tag ${tag} created: ${message}` };
  } catch (error) {
    return { success: false, error: error.stderr?.toString() || error.message };
  }
}

export function listTags() {
  try {
    const output = execSync('git tag -l -n1 --sort=-v:refname', { stdio: 'pipe', encoding: 'utf-8' });
    return { success: true, tags: output.trim().split('\n').filter(Boolean) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function gitStatus() {
  try {
    const branch = execSync('git branch --show-current', { stdio: 'pipe', encoding: 'utf-8' }).trim();
    const status = execSync('git status --short', { stdio: 'pipe', encoding: 'utf-8' }).trim();
    const remote = execSync('git remote -v', { stdio: 'pipe', encoding: 'utf-8' }).trim();
    return { branch, hasChanges: status.length > 0, changes: status, remotes: remote };
  } catch (error) {
    return { error: error.message };
  }
}

export function gitCreateBranch(name, from = '') {
  try {
    const base = from || execSync('git branch --show-current', { stdio: 'pipe', encoding: 'utf-8' }).trim();
    execSync(`git checkout -b ${name}${from ? ' ' + base : ''}`, { stdio: 'pipe' });
    return { success: true, message: `Branch ${name} created from ${base}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function gitListBranches() {
  try {
    const output = execSync('git branch -a', { stdio: 'pipe', encoding: 'utf-8' });
    return { success: true, branches: output.trim().split('\n').map(b => b.trim()) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function gitMergeBranch(branch) {
  try {
    execSync(`git merge ${branch}`, { stdio: 'pipe' });
    return { success: true, message: `Merged ${branch}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function gitDeleteBranch(branch, force = false) {
  try {
    execSync(`git branch ${force ? '-D' : '-d'} ${branch}`, { stdio: 'pipe' });
    return { success: true, message: `Deleted branch ${branch}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function createPullRequest(options = {}) {
  const { title = '', body = '', base = 'main', head = '', draft = false, labels = [] } = options;
  try {
    if (!head) head = execSync('git branch --show-current', { stdio: 'pipe', encoding: 'utf-8' }).trim();
    if (!title) {
      const state = getProjectState();
      const progress = calculateProgress(state);
      title = `${state.type}: ${progress.complete}% complete - ${state.projectName}`;
    }
    if (!body) {
      const state = getProjectState();
      const progress = calculateProgress(state);
      body = `## Summary\n- Project: ${state.projectName}\n- Type: ${state.type}\n- Progress: ${progress.complete}%\n- Tasks: ${progress.done}/${progress.total}\n\n## Phases\n${state.phases.map(p => `- ${p.name}: ${p.tasks.filter(t => t.status === 'complete').length}/${p.tasks.length}`).join('\n')}`;
    }
    const draftFlag = draft ? '--draft' : '';
    const labelFlag = labels.length ? `--label "${labels.join(',')}"` : '';
    const cmd = `gh pr create --base ${base} --head ${head} --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" ${draftFlag} ${labelFlag}`;
    execSync(cmd, { stdio: 'pipe', encoding: 'utf-8' });
    return { success: true, message: `PR created: ${title}` };
  } catch (error) {
    return { success: false, error: error.stderr?.toString() || error.message };
  }
}

export function listPullRequests(state = 'open') {
  try {
    const output = execSync(`gh pr list --state ${state} --json number,title,headRefName,createdAt`, { stdio: 'pipe', encoding: 'utf-8' });
    return { success: true, prs: JSON.parse(output) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function mergePullRequest(prNumber, method = 'merge') {
  try {
    execSync(`gh pr merge ${prNumber} --${method} --delete-branch`, { stdio: 'pipe' });
    return { success: true, message: `PR #${prNumber} merged` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function createGitHubRelease(tag, notes, projectState) {
  try {
    const cmd = `gh release create ${tag} --title "v1.0.0 - ${projectState?.projectName || 'Project'} Complete" --notes "${notes.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    execSync(cmd, { stdio: 'pipe' });
    return { success: true, message: `GitHub Release ${tag} created` };
  } catch (error) {
    return { success: false, error: error.stderr?.toString() || error.message };
  }
}

export function createIssueFromBug(bug) {
  try {
    const title = `Bug: ${bug.description}`;
    const body = `## Bug Report\n\n**Description**: ${bug.description}\n**Reported**: ${bug.reportedAt}\n**Status**: ${bug.status}\n\n### Issues Found\n${bug.issues?.map(i => `- [${i.severity}] ${i.type}: ${i.message}`).join('\n') || 'N/A'}`;
    const cmd = `gh issue create --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" --label "bug"`;
    execSync(cmd, { stdio: 'pipe' });
    return { success: true, message: 'Issue created for bug' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function listIssues(state = 'open') {
  try {
    const output = execSync(`gh issue list --state ${state} --json number,title,labels,createdAt`, { stdio: 'pipe', encoding: 'utf-8' });
    return { success: true, issues: JSON.parse(output) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export function createGitHubActions() {
  const workflow = `name: Laravel CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  laravel-tests:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: password
          MYSQL_DATABASE: testing
        ports:
          - 3306:3306
        options: --health-cmd="mysqladmin ping" --health-interval=10s --health-timeout=5s --health-retries=3
    steps:
    - uses: actions/checkout@v4
    - name: Setup PHP
      uses: shivammathur/setup-php@v2
      with:
        php-version: '8.4'
        extensions: mbstring, dom, fileinfo, mysql
        coverage: xdebug
    - name: Copy .env
      run: cp .env.example .env
    - name: Install Dependencies
      run: composer install -q --no-ansi --no-interaction --no-scripts --no-progress --prefer-dist
    - name: Generate key
      run: php artisan key:generate
    - name: Directory Permissions
      run: chmod -R 777 storage bootstrap/cache
    - name: Execute Tests
      run: vendor/bin/pest
      env:
        DB_CONNECTION: mysql
        DB_HOST: 127.0.0.1
        DB_PORT: 3306
        DB_DATABASE: testing
        DB_USERNAME: root
        DB_PASSWORD: password`;
  return { success: true, path: '.github/workflows/laravel-ci.yml', content: workflow, message: 'GitHub Actions workflow created' };
}

export function autoPushOnComplete(projectState) {
  const progress = calculateProgress(projectState);
  if (progress.complete !== 100) return { skipped: true, reason: `Not complete: ${progress.complete}%` };
  const results = [];
  if (!existsSync('.git')) {
    initGitRepo(process.cwd());
    results.push({ step: 'init', message: 'Git initialized' });
  }
  const status = gitStatus();
  if (!status.remotes) return { error: 'No remote configured. Run: /git create <repo-name>' };
  execSync('git add .', { stdio: 'pipe' });
  results.push({ step: 'stage', message: 'All changes staged' });
  const commitMsg = `feat(project): 100% complete - ${projectState.projectName}\n\nAll phases completed successfully!\n\nProject: ${projectState.projectName}\nType: ${projectState.type}\nPhases: ${projectState.phases.length}\nTotal Tasks: ${progress.total}\nCompleted: ${progress.done}/${progress.total}\n\nPhases Summary:\n${projectState.phases.map(p => `- ${p.name}: ${p.tasks.filter(t => t.status === 'complete').length}/${p.tasks.length} tasks`).join('\n')}`;
  execSync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { stdio: 'pipe' });
  results.push({ step: 'commit', message: 'Committed: 100% complete' });
  const pushResult = gitPush();
  results.push({ step: 'push', ...pushResult });
  const tag = createVersionTag('v1.0.0', `Production release - ${projectState.projectName} 100% complete`, projectState);
  results.push({ step: 'tag', ...tag });
  const releaseResult = createGitHubRelease('v1.0.0', commitMsg, projectState);
  results.push({ step: 'release', ...releaseResult });
  projectState.completed = true;
  projectState.completedAt = new Date().toISOString();
  saveProjectState(projectState);
  return { success: true, results, message: `Project 100% complete! Auto-pushed to GitHub with release.` };
}

export function autoSyncOnTaskComplete(projectState, taskName) {
  const progress = calculateProgress(projectState);
  const commitResult = gitCommit([], null, projectState);
  const status = gitStatus();
  let pushResult = null;
  if (status.remotes) pushResult = gitPush();
  let tagResult = null;
  const phase = projectState.phases?.[projectState.currentPhase];
  const phaseComplete = phase?.tasks?.every(t => t.status === 'complete');
  if (phaseComplete) {
    const phaseNum = projectState.currentPhase + 1;
    tagResult = createVersionTag(`0.${phaseNum}.0`, `Phase ${phaseNum}: ${phase.name} complete - ${progress.complete}% total`, projectState);
  }
  let completeResult = null;
  if (progress.complete === 100) completeResult = autoPushOnComplete(projectState);
  return { synced: true, progress: `${progress.complete}%`, committed: commitResult.success, pushed: !!status.remotes, tagged: phaseComplete, onComplete: completeResult };
}

export function fullGitWorkflow(projectName, options = {}) {
  const { description = '', visibility = 'private', autoCommit = true, autoTag = true, projectState = null } = options;
  const results = [];
  const auth = ensureGHAuth();
  if (auth.needsLogin) return { step: 'auth', ...auth };
  results.push({ step: 'auth', status: 'Authenticated' });
  const init = initGitRepo(process.cwd());
  results.push({ step: 'init', ...init });
  const repo = createGitHubRepo(projectName, { description, visibility });
  results.push({ step: 'repo', ...repo });
  if (autoCommit) {
    const commit = gitCommit([], null, projectState);
    results.push({ step: 'commit', ...commit });
  }
  const push = gitPush();
  results.push({ step: 'push', ...push });
  if (autoTag && projectState) {
    const progress = calculateProgress(projectState);
    const tag = createVersionTag('0.1.0', `Initial setup - ${progress.complete}% complete`, projectState);
    results.push({ step: 'tag', ...tag });
  }
  return { success: true, results };
}
