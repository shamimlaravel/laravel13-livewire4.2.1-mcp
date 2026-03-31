/**
 * Status Dashboard
 * Real-time project status monitoring
 */

class StatusDashboard {
    constructor() {
        // DOM Elements
        this.tasksCompleted = document.getElementById('tasks-completed');
        this.tasksTotal = document.getElementById('tasks-total');
        this.tasksProgressFill = document.getElementById('tasks-progress-fill');
        this.bugsOpen = document.getElementById('bugs-open');
        this.bugsFixed = document.getElementById('bugs-fixed');
        this.syncTotal = document.getElementById('sync-total');
        this.currentVersion = document.getElementById('current-version');
        this.activityList = document.getElementById('activity-list');
        this.endpointsCount = document.getElementById('endpoints-count');
        this.decisionsCount = document.getElementById('decisions-count');
        this.versionsList = document.getElementById('versions-list');
        this.simulateActivityBtn = document.getElementById('simulate-activity');
        this.resetDashboardBtn = document.getElementById('reset-dashboard');
        
        // State
        this.state = {
            tasks: { completed: 0, total: 32 },
            bugs: { open: 3, fixed: 0 },
            syncs: 0,
            version: 'v0.0.0',
            memory: { endpoints: 45, decisions: 23 },
            activity: [],
            versions: []
        };
        
        this.isSimulating = false;
        
        // Sample activities
        this.sampleActivities = [
            { icon: '✓', text: 'Complete task: User authentication', type: 'task' },
            { icon: '🐛', text: 'Fix bug: Missing wire:key', type: 'bug' },
            { icon: '🧩', text: 'Generate component: PostList', type: 'generate' },
            { icon: '🔒', text: 'Security audit passed', type: 'security' },
            { icon: '💾', text: 'Git commit: feat: add dashboard', type: 'git' },
            { icon: '⬆️', text: 'Git push: origin/main', type: 'git' },
            { icon: '🏷️', text: 'Git tag: v1.2.3', type: 'git' },
            { icon: '🔀', text: 'Pull request created: #42', type: 'github' }
        ];
        
        // Sample versions
        this.sampleVersions = [
            { version: 'v0.1.0', description: 'Initial setup', time: '1 day ago' },
            { version: 'v0.2.0', description: 'Foundation complete', time: '12 hours ago' },
            { version: 'v0.3.0', description: 'Core features', time: '6 hours ago' }
        ];
        
        this.init();
    }
    
    init() {
        this.render();
        this.bindEvents();
    }
    
    bindEvents() {
        this.simulateActivityBtn?.addEventListener('click', () => this.simulateActivity());
        this.resetDashboardBtn?.addEventListener('click', () => this.reset());
    }
    
    render() {
        this.updateStats();
        this.renderActivity();
        this.renderVersions();
    }
    
    updateStats() {
        // Tasks
        if (this.tasksCompleted) {
            this.tasksCompleted.textContent = this.state.tasks.completed;
        }
        if (this.tasksTotal) {
            this.tasksTotal.textContent = this.state.tasks.total;
        }
        if (this.tasksProgressFill) {
            const progress = (this.state.tasks.completed / this.state.tasks.total) * 100;
            this.tasksProgressFill.style.width = `${progress}%`;
        }
        
        // Bugs
        if (this.bugsOpen) {
            this.bugsOpen.textContent = this.state.bugs.open;
        }
        if (this.bugsFixed) {
            this.bugsFixed.textContent = this.state.bugs.fixed;
        }
        
        // Syncs
        if (this.syncTotal) {
            this.syncTotal.textContent = this.state.syncs;
        }
        
        // Version
        if (this.currentVersion) {
            this.currentVersion.textContent = this.state.version;
        }
        
        // Memory
        if (this.endpointsCount) {
            this.endpointsCount.textContent = this.state.memory.endpoints;
        }
        if (this.decisionsCount) {
            this.decisionsCount.textContent = this.state.memory.decisions;
        }
    }
    
    renderActivity() {
        if (!this.activityList) return;
        
        if (this.state.activity.length === 0) {
            this.activityList.innerHTML = `
                <div class="activity-item">
                    <span class="activity-text" style="color: var(--text-muted)">No recent activity</span>
                </div>
            `;
            return;
        }
        
        this.activityList.innerHTML = this.state.activity.slice(0, 10).map(item => `
            <div class="activity-item">
                <span class="activity-time">${item.time}</span>
                <span class="activity-icon">${item.icon}</span>
                <span class="activity-text">${item.text}</span>
                <span class="activity-badge ${item.synced ? 'synced' : ''}">
                    ${item.synced ? '✓ Synced' : '⏳ Pending'}
                </span>
            </div>
        `).join('');
    }
    
    renderVersions() {
        if (!this.versionsList) return;
        
        this.versionsList.innerHTML = this.state.versions.map((version, index) => `
            <div class="version-item ${index === 0 ? 'current' : ''}">
                <span class="version-name">${version.version}</span>
                <span class="version-desc">${version.description}</span>
                <span class="version-time">${version.time}</span>
            </div>
        `).join('');
    }
    
    addActivity(icon, text, type) {
        const activity = {
            icon,
            text,
            type,
            time: 'just now',
            synced: Math.random() > 0.3
        };
        
        this.state.activity.unshift(activity);
        this.renderActivity();
    }
    
    async simulateActivity() {
        if (this.isSimulating) return;
        
        this.isSimulating = true;
        this.simulateActivityBtn.disabled = true;
        
        // Load sample data
        this.state.versions = [...this.sampleVersions];
        
        // Simulate multiple activities
        for (let i = 0; i < 5; i++) {
            await this.simulateOneActivity();
            await Utils.delay(500);
        }
        
        this.isSimulating = false;
        this.simulateActivityBtn.disabled = false;
    }
    
    async simulateOneActivity() {
        const sample = this.sampleActivities[Math.floor(Math.random() * this.sampleActivities.length)];
        
        // Update state based on activity type
        switch (sample.type) {
            case 'task':
                this.state.tasks.completed = Math.min(
                    this.state.tasks.completed + 1,
                    this.state.tasks.total
                );
                break;
            case 'bug':
                if (this.state.bugs.open > 0) {
                    this.state.bugs.open--;
                    this.state.bugs.fixed++;
                }
                break;
            case 'git':
            case 'github':
                this.state.syncs++;
                break;
        }
        
        // Update version occasionally
        if (sample.type === 'git' && Math.random() > 0.7) {
            const minor = parseInt(this.state.version.split('.')[2]) + 1;
            this.state.version = `v0.${minor}.0`;
        }
        
        // Update memory occasionally
        if (Math.random() > 0.8) {
            this.state.memory.endpoints += Math.floor(Math.random() * 3);
            this.state.memory.decisions += Math.floor(Math.random() * 2);
        }
        
        // Add activity
        this.addActivity(sample.icon, sample.text, sample.type);
        
        // Update display
        this.updateStats();
    }
    
    reset() {
        this.state = {
            tasks: { completed: 0, total: 32 },
            bugs: { open: 3, fixed: 0 },
            syncs: 0,
            version: 'v0.0.0',
            memory: { endpoints: 45, decisions: 23 },
            activity: [],
            versions: []
        };
        
        this.render();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new StatusDashboard();
    window.dashboard = dashboard;
});
