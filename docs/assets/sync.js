/**
 * Auto-Sync Flow Diagram
 * Visualizes git operations triggered automatically
 */

class AutoSyncDiagram {
    constructor() {
        // DOM Elements
        this.autoSyncToggle = document.getElementById('auto-sync-toggle');
        this.simulateSyncBtn = document.getElementById('simulate-sync');
        this.syncCount = document.getElementById('sync-count');
        this.branchName = document.getElementById('branch-name');
        this.lastSync = document.getElementById('last-sync');
        this.branchYes = document.getElementById('branch-yes');
        this.phaseCheck = document.getElementById('phase-check');
        
        // Sync operation elements
        this.operations = {
            add: document.getElementById('sync-add'),
            commit: document.getElementById('sync-commit'),
            push: document.getElementById('sync-push'),
            tag: document.getElementById('sync-tag')
        };
        
        // State
        this.autoSyncEnabled = true;
        this.syncCountValue = 0;
        this.isSimulating = false;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.updateStats();
    }
    
    bindEvents() {
        this.autoSyncToggle?.addEventListener('change', (e) => {
            this.autoSyncEnabled = e.target.checked;
        });
        
        this.simulateSyncBtn?.addEventListener('click', () => this.simulateSync());
    }
    
    async simulateSync() {
        if (this.isSimulating) return;
        
        this.isSimulating = true;
        this.simulateSyncBtn.disabled = true;
        
        // Reset all operations
        this.resetOperations();
        
        // Show phase check
        if (this.phaseCheck) {
            this.phaseCheck.style.opacity = '1';
        }
        
        // Simulate task sync
        await this.animateOperation('add', 'git add .', 500);
        await this.animateOperation('commit', 'git commit -m "feat: complete task"', 800);
        await this.animateOperation('push', 'git push origin main', 1000);
        
        // Show conditional branch
        await Utils.delay(300);
        
        // Randomly decide if phase is complete (for demo)
        const phaseComplete = Math.random() > 0.5;
        
        if (phaseComplete && this.branchYes) {
            this.branchYes.classList.remove('hidden');
            await this.animateOperation('tag', 'git tag v0.2.0', 600);
        }
        
        // Update stats
        this.syncCountValue++;
        this.updateStats();
        
        this.isSimulating = false;
        this.simulateSyncBtn.disabled = false;
    }
    
    async animateOperation(opId, command, duration) {
        const op = this.operations[opId];
        if (!op) return;
        
        const progressBar = op.querySelector('.op-progress-bar');
        const statusEl = op.querySelector('.op-status');
        
        // Mark as active
        op.classList.add('active');
        
        // Animate progress
        if (progressBar) {
            progressBar.style.transition = `width ${duration}ms ease`;
            progressBar.style.width = '100%';
        }
        
        if (statusEl) {
            statusEl.textContent = 'Executing...';
        }
        
        await Utils.delay(duration);
        
        // Mark as complete
        op.classList.remove('active');
        op.classList.add('complete');
        
        if (progressBar) {
            progressBar.style.width = '100%';
            progressBar.style.background = 'var(--success)';
        }
        
        if (statusEl) {
            statusEl.textContent = '✓ Complete';
        }
    }
    
    resetOperations() {
        Object.values(this.operations).forEach(op => {
            if (op) {
                op.classList.remove('active', 'complete');
                const progressBar = op.querySelector('.op-progress-bar');
                const statusEl = op.querySelector('.op-status');
                
                if (progressBar) {
                    progressBar.style.transition = 'none';
                    progressBar.style.width = '0%';
                    progressBar.style.background = 'var(--accent)';
                }
                
                if (statusEl) {
                    statusEl.textContent = 'Waiting...';
                }
            }
        });
        
        if (this.branchYes) {
            this.branchYes.classList.add('hidden');
        }
    }
    
    updateStats() {
        if (this.syncCount) {
            this.syncCount.textContent = this.syncCountValue;
        }
        
        if (this.lastSync) {
            this.lastSync.textContent = this.syncCountValue > 0 ? 'just now' : 'Never';
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const autoSync = new AutoSyncDiagram();
    window.autoSync = autoSync;
});
