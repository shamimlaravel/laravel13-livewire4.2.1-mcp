/**
 * Planning Simulator
 * Interactive project planning with phases and tasks
 */

class PlanningSimulator {
    constructor() {
        // DOM Elements
        this.phasesContainer = document.getElementById('phases-container');
        this.overallProgressFill = document.getElementById('overall-progress-fill');
        this.overallProgressText = document.getElementById('overall-progress-text');
        this.simulateProjectBtn = document.getElementById('simulate-project');
        this.resetPlannerBtn = document.getElementById('reset-planner');
        this.syncVisualization = document.getElementById('sync-visualization');
        this.syncSteps = document.getElementById('sync-steps');
        
        // State
        this.project = null;
        this.isSimulating = false;
        this.isPaused = false;
        
        // Demo project data
        this.demoProject = {
            name: 'SaaS Dashboard',
            type: 'saas',
            phases: [
                {
                    name: 'Foundation',
                    tasks: [
                        { name: 'Setup Laravel project', gitSync: true },
                        { name: 'Configure Livewire v4.2', gitSync: true },
                        { name: 'Create database schema', gitSync: true },
                        { name: 'Write migrations', gitSync: true }
                    ]
                },
                {
                    name: 'Core Features',
                    tasks: [
                        { name: 'User authentication', gitSync: true },
                        { name: 'Dashboard layout', gitSync: true },
                        { name: 'CRUD components', gitSync: true },
                        { name: 'Search & filter', gitSync: true }
                    ]
                },
                {
                    name: 'Advanced Features',
                    tasks: [
                        { name: 'GitHub integration', gitSync: true },
                        { name: 'Auto-sync setup', gitSync: true },
                        { name: 'Security audit', gitSync: true },
                        { name: 'Deploy to production', gitSync: true }
                    ]
                }
            ]
        };
        
        this.init();
    }
    
    init() {
        this.loadProject(this.demoProject);
        this.bindEvents();
    }
    
    bindEvents() {
        this.simulateProjectBtn?.addEventListener('click', () => this.simulateProject());
        this.resetPlannerBtn?.addEventListener('click', () => this.reset());
    }
    
    loadProject(projectData) {
        this.project = JSON.parse(JSON.stringify(projectData)); // Deep clone
        
        // Initialize task states
        this.project.phases.forEach((phase, pi) => {
            phase.id = `phase-${pi}`;
            phase.status = 'pending';
            phase.progress = 0;
            
            phase.tasks.forEach((task, ti) => {
                task.id = `task-${pi}-${ti}`;
                task.status = 'pending';
                task.progress = 0;
            });
        });
        
        this.render();
    }
    
    render() {
        if (!this.phasesContainer || !this.project) return;
        
        this.phasesContainer.innerHTML = this.project.phases.map((phase, pi) => `
            <div class="phase-card ${phase.status}" id="${phase.id}">
                <div class="phase-header" data-phase="${pi}">
                    <span class="phase-icon">${this.getPhaseIcon(phase.status)}</span>
                    <h4>Phase ${pi + 1}: ${phase.name}</h4>
                    <span class="phase-progress">${this.getPhaseProgress(pi)}%</span>
                    <span class="expand-icon">▼</span>
                </div>
                
                <div class="phase-tasks">
                    ${phase.tasks.map((task, ti) => this.renderTask(task, pi, ti)).join('')}
                </div>
                
                <div class="phase-actions">
                    <button class="btn btn-sm btn-primary" onclick="planner.simulatePhase(${pi})">
                        ▶ Simulate Phase
                    </button>
                </div>
            </div>
            
            ${pi < this.project.phases.length - 1 ? '<div class="phase-connector">↓</div>' : ''}
        `).join('');
        
        this.updateOverallProgress();
        this.attachPhaseListeners();
    }
    
    renderTask(task, phaseIndex, taskIndex) {
        return `
            <div class="task-item ${task.status}" id="${task.id}" 
                 data-phase="${phaseIndex}" data-task="${taskIndex}">
                <span class="task-icon">${this.getTaskIcon(task.status)}</span>
                <span class="task-name">${task.name}</span>
                <div class="task-progress-bar">
                    <div class="task-progress-fill" style="width: ${task.progress}%"></div>
                </div>
                <span class="task-status">${this.formatStatus(task.status)}</span>
            </div>
        `;
    }
    
    attachPhaseListeners() {
        document.querySelectorAll('.phase-header').forEach(header => {
            header.addEventListener('click', () => {
                const card = header.closest('.phase-card');
                card.classList.toggle('expanded');
            });
        });
    }
    
    getPhaseIcon(status) {
        const icons = {
            pending: '○',
            'in-progress': '◐',
            complete: '●'
        };
        return icons[status] || '○';
    }
    
    getTaskIcon(status) {
        const icons = {
            pending: '○',
            'in-progress': '◐',
            complete: '✓'
        };
        return icons[status] || '○';
    }
    
    formatStatus(status) {
        const labels = {
            pending: 'Pending',
            'in-progress': 'In Progress',
            complete: 'Complete'
        };
        return labels[status] || 'Pending';
    }
    
    getPhaseProgress(phaseIndex) {
        const phase = this.project.phases[phaseIndex];
        const completed = phase.tasks.filter(t => t.status === 'complete').length;
        return Math.round((completed / phase.tasks.length) * 100);
    }
    
    getOverallProgress() {
        if (!this.project) return 0;
        
        const totalTasks = this.project.phases.reduce((sum, p) => sum + p.tasks.length, 0);
        const completedTasks = this.project.phases.reduce(
            (sum, p) => sum + p.tasks.filter(t => t.status === 'complete').length, 
            0
        );
        
        return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    }
    
    updateOverallProgress() {
        const progress = this.getOverallProgress();
        
        if (this.overallProgressFill) {
            this.overallProgressFill.style.width = `${progress}%`;
        }
        if (this.overallProgressText) {
            this.overallProgressText.textContent = `${progress}%`;
        }
    }
    
    async simulateProject() {
        if (this.isSimulating) return;
        
        this.isSimulating = true;
        this.isPaused = false;
        this.simulateProjectBtn.disabled = true;
        
        for (let pi = 0; pi < this.project.phases.length; pi++) {
            if (!this.isSimulating || this.isPaused) break;
            await this.simulatePhase(pi);
        }
        
        this.isSimulating = false;
        this.simulateProjectBtn.disabled = false;
    }
    
    async simulatePhase(phaseIndex) {
        const phase = this.project.phases[phaseIndex];
        
        // Mark phase as in-progress
        phase.status = 'in-progress';
        this.updatePhaseUI(phaseIndex);
        
        // Simulate each task
        for (let ti = 0; ti < phase.tasks.length; ti++) {
            if (!this.isSimulating || this.isPaused) break;
            await this.simulateTask(phaseIndex, ti);
        }
        
        // Complete phase if all tasks done
        if (phase.tasks.every(t => t.status === 'complete')) {
            phase.status = 'complete';
            this.updatePhaseUI(phaseIndex);
            
            // Show sync visualization for phase completion
            await this.showPhaseSync(phaseIndex);
        }
    }
    
    async simulateTask(phaseIndex, taskIndex) {
        const phase = this.project.phases[phaseIndex];
        const task = phase.tasks[taskIndex];
        
        // Update task to in-progress
        task.status = 'in-progress';
        this.updateTaskUI(task);
        
        // Animate progress
        for (let p = 0; p <= 100; p += 20) {
            if (!this.isSimulating || this.isPaused) break;
            
            task.progress = p;
            this.updateTaskProgress(task);
            await Utils.delay(150);
        }
        
        // Complete task
        task.status = 'complete';
        task.progress = 100;
        this.updateTaskUI(task);
        this.updateOverallProgress();
        
        // Update phase progress
        this.updatePhaseProgress(phaseIndex);
        
        // Show task sync
        await this.showTaskSync(task.name);
        
        await Utils.delay(300);
    }
    
    updatePhaseUI(phaseIndex) {
        const phase = this.project.phases[phaseIndex];
        const card = document.getElementById(phase.id);
        
        if (card) {
            card.className = `phase-card ${phase.status}`;
            
            const icon = card.querySelector('.phase-icon');
            if (icon) {
                icon.textContent = this.getPhaseIcon(phase.status);
            }
        }
    }
    
    updatePhaseProgress(phaseIndex) {
        const card = document.getElementById(this.project.phases[phaseIndex].id);
        if (card) {
            const progressEl = card.querySelector('.phase-progress');
            if (progressEl) {
                progressEl.textContent = `${this.getPhaseProgress(phaseIndex)}%`;
            }
        }
    }
    
    updateTaskUI(task) {
        const taskEl = document.getElementById(task.id);
        if (taskEl) {
            taskEl.className = `task-item ${task.status}`;
            
            const icon = taskEl.querySelector('.task-icon');
            if (icon) {
                icon.textContent = this.getTaskIcon(task.status);
            }
            
            const status = taskEl.querySelector('.task-status');
            if (status) {
                status.textContent = this.formatStatus(task.status);
            }
        }
    }
    
    updateTaskProgress(task) {
        const taskEl = document.getElementById(task.id);
        if (taskEl) {
            const fill = taskEl.querySelector('.task-progress-fill');
            if (fill) {
                fill.style.width = `${task.progress}%`;
            }
        }
    }
    
    async showTaskSync(taskName) {
        // Show brief sync indicator
        if (!this.syncVisualization) return;
        
        this.syncVisualization.classList.remove('hidden');
        this.syncSteps.innerHTML = `
            <div class="sync-step active">
                <span>📁</span> git add .
            </div>
            <div class="sync-step">
                <span>💾</span> git commit
            </div>
            <div class="sync-step">
                <span>⬆️</span> git push
            </div>
        `;
        
        // Animate steps
        const steps = this.syncSteps.querySelectorAll('.sync-step');
        for (let i = 0; i < steps.length; i++) {
            steps[i].classList.remove('active');
            steps[i].classList.add('complete');
            if (steps[i + 1]) {
                steps[i + 1].classList.add('active');
            }
            await Utils.delay(200);
        }
        
        // Hide after completion
        await Utils.delay(500);
        this.syncVisualization.classList.add('hidden');
    }
    
    async showPhaseSync(phaseIndex) {
        if (!this.syncVisualization) return;
        
        const version = `v0.${phaseIndex + 1}.0`;
        
        this.syncVisualization.classList.remove('hidden');
        this.syncSteps.innerHTML = `
            <div class="sync-step active">
                <span>📁</span> git add .
            </div>
            <div class="sync-step">
                <span>💾</span> git commit
            </div>
            <div class="sync-step">
                <span>⬆️</span> git push
            </div>
            <div class="sync-step">
                <span>🏷️</span> git tag ${version}
            </div>
        `;
        
        // Animate steps
        const steps = this.syncSteps.querySelectorAll('.sync-step');
        for (let i = 0; i < steps.length; i++) {
            steps[i].classList.remove('active');
            steps[i].classList.add('complete');
            if (steps[i + 1]) {
                steps[i + 1].classList.add('active');
            }
            await Utils.delay(300);
        }
        
        await Utils.delay(800);
        this.syncVisualization.classList.add('hidden');
    }
    
    reset() {
        this.isSimulating = false;
        this.isPaused = false;
        this.loadProject(this.demoProject);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const planner = new PlanningSimulator();
    window.planner = planner;
});
