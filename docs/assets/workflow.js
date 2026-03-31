/**
 * Workflow Animation System
 * Animates MCP tool execution flows
 */

class WorkflowAnimation {
    constructor() {
        // DOM Elements
        this.playBtn = document.getElementById('play-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.speedSlider = document.getElementById('speed-slider');
        this.speedValue = document.getElementById('speed-value');
        this.workflowSelect = document.getElementById('workflow-select');
        this.logEntries = document.getElementById('log-entries');
        this.currentStepEl = document.getElementById('current-step');
        this.progressFill = document.getElementById('progress-fill');
        this.progressText = document.getElementById('progress-text');
        this.statusBadge = document.getElementById('status-badge');
        
        // SVG Elements
        this.svg = document.getElementById('workflow-svg');
        this.nodes = {
            user: document.getElementById('node-user'),
            server: document.getElementById('node-server'),
            select: document.getElementById('node-select'),
            generate: document.getElementById('node-generate'),
            fix: document.getElementById('node-fix'),
            git: document.getElementById('node-git'),
            convert: document.getElementById('node-convert'),
            response: document.getElementById('node-response')
        };
        this.connections = {
            conn1: document.getElementById('conn-1'),
            conn2: document.getElementById('conn-2'),
            conn3: document.getElementById('conn-3'),
            conn4: document.getElementById('conn-4')
        };
        this.dataPacket = document.getElementById('data-packet');
        
        // State
        this.isPlaying = false;
        this.isPaused = false;
        this.speed = 1;
        this.currentStep = 0;
        this.totalSteps = 0;
        this.currentWorkflow = null;
        
        // Workflow definitions
        this.workflows = {
            generate: {
                name: 'Generate Livewire Component',
                steps: [
                    { node: 'user', action: 'User sends request', duration: 800 },
                    { connection: 'conn1', action: 'Request to MCP Server', duration: 600 },
                    { node: 'server', action: 'MCP Server processes request', duration: 1000 },
                    { connection: 'conn2', action: 'Tool selection', duration: 500 },
                    { node: 'select', action: 'Selecting appropriate tool', duration: 600 },
                    { connection: 'conn3', action: 'Route to generate tool', duration: 500 },
                    { node: 'generate', action: 'Generate Livewire component', duration: 1500 },
                    { connection: 'conn4', action: 'Return response', duration: 500 },
                    { node: 'response', action: 'Component generated successfully!', duration: 800 }
                ]
            },
            fixbugs: {
                name: 'Fix Bugs Workflow',
                steps: [
                    { node: 'user', action: 'User requests bug fix', duration: 800 },
                    { connection: 'conn1', action: 'Request to MCP Server', duration: 600 },
                    { node: 'server', action: 'MCP Server analyzes request', duration: 1000 },
                    { connection: 'conn2', action: 'Tool selection', duration: 500 },
                    { node: 'select', action: 'Selecting fix_bugs tool', duration: 600 },
                    { connection: 'conn3', action: 'Route to fix_bugs tool', duration: 500 },
                    { node: 'fix', action: 'Scanning and fixing bugs', duration: 2000 },
                    { connection: 'conn4', action: 'Return fixes', duration: 500 },
                    { node: 'response', action: 'Bugs fixed successfully!', duration: 800 }
                ]
            },
            fullproject: {
                name: 'Full Project Workflow',
                steps: [
                    { node: 'user', action: 'User requests full project', duration: 800 },
                    { connection: 'conn1', action: 'Request to MCP Server', duration: 600 },
                    { node: 'server', action: 'MCP Server initializes', duration: 1000 },
                    { connection: 'conn2', action: 'Tool selection', duration: 500 },
                    { node: 'select', action: 'Planning workflow', duration: 800 },
                    { node: 'generate', action: 'Generate project structure', duration: 1500 },
                    { node: 'generate', action: 'Generate components', duration: 2000 },
                    { node: 'fix', action: 'Run security audit', duration: 1200 },
                    { node: 'git', action: 'Initialize git repository', duration: 1000 },
                    { node: 'git', action: 'Commit and push', duration: 800 },
                    { connection: 'conn4', action: 'Return project', duration: 500 },
                    { node: 'response', action: 'Project created successfully!', duration: 800 }
                ]
            }
        };
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadWorkflow('generate');
    }
    
    bindEvents() {
        this.playBtn?.addEventListener('click', () => this.play());
        this.pauseBtn?.addEventListener('click', () => this.pause());
        this.resetBtn?.addEventListener('click', () => this.reset());
        this.speedSlider?.addEventListener('input', (e) => this.setSpeed(parseFloat(e.target.value)));
        this.workflowSelect?.addEventListener('change', (e) => this.loadWorkflow(e.target.value));
    }
    
    loadWorkflow(workflowId) {
        this.reset();
        this.currentWorkflow = this.workflows[workflowId];
        this.totalSteps = this.currentWorkflow.steps.length;
        this.updateLog(`Loaded: ${this.currentWorkflow.name}`, 'waiting');
    }
    
    setSpeed(speed) {
        this.speed = speed;
        this.speedValue.textContent = `${speed.toFixed(1)}x`;
    }
    
    async play() {
        if (this.isPaused) {
            this.isPaused = false;
            this.updateStatus('running');
            this.continueExecution();
            return;
        }
        
        this.isPlaying = true;
        this.isPaused = false;
        this.playBtn.disabled = true;
        this.pauseBtn.disabled = false;
        this.updateStatus('running');
        
        await this.executeWorkflow();
    }
    
    pause() {
        this.isPaused = true;
        this.playBtn.disabled = false;
        this.pauseBtn.disabled = true;
        this.updateStatus('idle');
        this.updateLog('Paused', 'waiting');
    }
    
    reset() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentStep = 0;
        
        // Reset UI
        this.playBtn.disabled = false;
        this.pauseBtn.disabled = true;
        this.currentStepEl.textContent = '-';
        this.progressFill.style.width = '0%';
        this.progressText.textContent = '0%';
        this.updateStatus('idle');
        
        // Clear log
        this.logEntries.innerHTML = `
            <div class="log-entry waiting">
                <span class="log-icon">⏳</span>
                <span class="log-text">Waiting to start...</span>
            </div>
        `;
        
        // Reset all nodes
        Object.values(this.nodes).forEach(node => {
            if (node) {
                node.classList.remove('active', 'processing', 'success');
            }
        });
        
        // Reset all connections
        Object.values(this.connections).forEach(conn => {
            if (conn) {
                conn.classList.remove('active');
            }
        });
        
        // Hide data packet
        if (this.dataPacket) {
            this.dataPacket.setAttribute('opacity', '0');
        }
    }
    
    async executeWorkflow() {
        for (let i = this.currentStep; i < this.totalSteps; i++) {
            if (!this.isPlaying || this.isPaused) break;
            
            this.currentStep = i;
            await this.executeStep(this.currentWorkflow.steps[i]);
            this.updateProgress();
        }
        
        if (this.currentStep >= this.totalSteps - 1 && !this.isPaused) {
            this.complete();
        }
    }
    
    continueExecution() {
        this.executeWorkflow();
    }
    
    async executeStep(step) {
        const duration = step.duration / this.speed;
        
        this.updateLog(step.action, 'active');
        this.currentStepEl.textContent = step.action;
        
        if (step.node) {
            await this.animateNode(step.node, duration);
        } else if (step.connection) {
            await this.animateConnection(step.connection, duration);
        }
        
        await Utils.delay(duration * 0.2);
    }
    
    async animateNode(nodeId, duration) {
        const node = this.nodes[nodeId];
        if (!node) return;
        
        // Activate node
        node.classList.add('active');
        
        // Show data packet animation
        this.animateDataPacket(node);
        
        // Transition to processing
        await Utils.delay(duration * 0.3);
        node.classList.remove('active');
        node.classList.add('processing');
        
        // Complete
        await Utils.delay(duration * 0.7);
        node.classList.remove('processing');
        node.classList.add('success');
        
        // Update log
        this.logEntries.lastElementChild?.classList.remove('active');
        this.logEntries.lastElementChild?.classList.add('success');
    }
    
    async animateConnection(connectionId, duration) {
        const connection = this.connections[connectionId];
        if (!connection) return;
        
        connection.classList.add('active');
        
        // Animate data packet along path
        this.animatePacketAlongPath(connection);
        
        await Utils.delay(duration);
        
        connection.classList.remove('active');
    }
    
    animateDataPacket(targetNode) {
        if (!this.dataPacket || !targetNode) return;
        
        const nodeRect = targetNode.getBoundingClientRect();
        const svgRect = this.svg.getBoundingClientRect();
        
        const x = nodeRect.left - svgRect.left + nodeRect.width / 2;
        const y = nodeRect.top - svgRect.top + nodeRect.height / 2;
        
        this.dataPacket.setAttribute('opacity', '1');
        this.dataPacket.style.transition = 'transform 0.3s ease';
        this.dataPacket.setAttribute('transform', `translate(${x}, ${y})`);
        
        setTimeout(() => {
            this.dataPacket.setAttribute('opacity', '0');
        }, 300);
    }
    
    animatePacketAlongPath(connection) {
        // Simple animation - fade in at midpoint
        if (!this.dataPacket) return;
        
        this.dataPacket.setAttribute('opacity', '1');
        this.dataPacket.setAttribute('transform', 'translate(450, 175)');
        
        setTimeout(() => {
            this.dataPacket.setAttribute('opacity', '0');
        }, 400);
    }
    
    updateProgress() {
        const progress = ((this.currentStep + 1) / this.totalSteps) * 100;
        this.progressFill.style.width = `${progress}%`;
        this.progressText.textContent = `${Math.round(progress)}%`;
    }
    
    updateLog(message, type = 'active') {
        const icons = {
            active: '⚡',
            success: '✅',
            waiting: '⏳',
            error: '❌'
        };
        
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.innerHTML = `
            <span class="log-icon">${icons[type] || '⚡'}</span>
            <span class="log-text">${message}</span>
        `;
        
        this.logEntries.appendChild(entry);
        this.logEntries.scrollTop = this.logEntries.scrollHeight;
    }
    
    updateStatus(status) {
        this.statusBadge.className = `status-badge ${status}`;
        this.statusBadge.textContent = {
            idle: 'Idle',
            running: 'Running',
            success: 'Complete',
            error: 'Error'
        }[status] || 'Idle';
    }
    
    complete() {
        this.isPlaying = false;
        this.playBtn.disabled = false;
        this.pauseBtn.disabled = true;
        this.updateStatus('success');
        this.updateLog('Workflow completed successfully!', 'success');
        this.currentStepEl.textContent = 'Complete!';
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const workflowAnimation = new WorkflowAnimation();
    window.workflowAnimation = workflowAnimation;
});
