/**
 * Laravel MCP Documentation - Core JavaScript
 * Handles search, navigation, copy buttons, and core functionality
 */

// ==================== Search System ====================
class SearchSystem {
    constructor() {
        this.modal = document.getElementById('search-modal');
        this.input = document.getElementById('search-input');
        this.results = document.getElementById('search-results');
        this.searchIndex = [];
        this.isOpen = false;
        
        this.init();
    }
    
    init() {
        this.buildIndex();
        this.bindEvents();
    }
    
    buildIndex() {
        // Index all sections
        document.querySelectorAll('section[id]').forEach(section => {
            const heading = section.querySelector('h1, h2, h3');
            if (heading) {
                this.searchIndex.push({
                    id: section.id,
                    title: heading.textContent.trim(),
                    content: section.textContent.substring(0, 300).trim(),
                    type: 'section'
                });
            }
        });
        
        // Index all tools from the table
        document.querySelectorAll('.tools-table tbody tr').forEach(row => {
            const code = row.querySelector('code');
            const desc = row.querySelectorAll('td')[2];
            if (code && desc) {
                this.searchIndex.push({
                    id: 'tools-overview',
                    title: code.textContent.trim(),
                    content: desc.textContent.trim(),
                    type: 'tool'
                });
            }
        });
    }
    
    bindEvents() {
        // Keyboard shortcut (Ctrl+K / Cmd+K)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.toggle();
            }
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
        
        // Search buttons
        document.getElementById('sidebar-search')?.addEventListener('click', () => this.open());
        document.getElementById('search-toggle')?.addEventListener('click', () => this.toggle());
        
        // Modal backdrop click
        this.modal.querySelector('.modal-backdrop')?.addEventListener('click', () => this.close());
        
        // Input handler
        this.input?.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }
    
    toggle() {
        this.isOpen ? this.close() : this.open();
    }
    
    open() {
        this.modal.classList.remove('hidden');
        this.input.focus();
        this.isOpen = true;
        document.body.style.overflow = 'hidden';
    }
    
    close() {
        this.modal.classList.add('hidden');
        this.input.value = '';
        this.results.innerHTML = '';
        this.isOpen = false;
        document.body.style.overflow = '';
    }
    
    handleSearch(query) {
        if (!query || query.length < 2) {
            this.results.innerHTML = '';
            return;
        }
        
        const normalizedQuery = query.toLowerCase();
        const matches = this.searchIndex.filter(item => 
            item.title.toLowerCase().includes(normalizedQuery) ||
            item.content.toLowerCase().includes(normalizedQuery)
        ).slice(0, 10);
        
        this.renderResults(matches, normalizedQuery);
    }
    
    renderResults(matches, query) {
        if (matches.length === 0) {
            this.results.innerHTML = `
                <div class="search-result">
                    <p>No results found for "${this.escapeHtml(query)}"</p>
                </div>
            `;
            return;
        }
        
        this.results.innerHTML = matches.map(item => {
            const highlightedTitle = this.highlightMatch(item.title, query);
            const highlightedContent = this.highlightMatch(
                item.content.substring(0, 100), 
                query
            );
            
            return `
                <a href="#${item.id}" class="search-result" onclick="searchSystem.close()">
                    <strong>${highlightedTitle}</strong>
                    <p>${highlightedContent}...</p>
                </a>
            `;
        }).join('');
    }
    
    highlightMatch(text, query) {
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

// ==================== Navigation System ====================
class NavigationSystem {
    constructor() {
        this.sidebar = document.getElementById('sidebar');
        this.menuToggle = document.getElementById('menu-toggle');
        this.navLinks = document.querySelectorAll('.nav-link');
        this.sections = document.querySelectorAll('section[id]');
        this.backToTop = document.getElementById('back-to-top');
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.setupScrollSpy();
        this.setupBackToTop();
    }
    
    bindEvents() {
        // Mobile menu toggle
        this.menuToggle?.addEventListener('click', () => this.toggleMobileMenu());
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.sidebar.contains(e.target) && !this.menuToggle.contains(e.target)) {
                this.closeMobileMenu();
            }
        });
        
        // Close menu when clicking a nav link
        this.navLinks.forEach(link => {
            link.addEventListener('click', () => this.closeMobileMenu());
        });
    }
    
    toggleMobileMenu() {
        this.sidebar.classList.toggle('open');
    }
    
    isMenuOpen() {
        return this.sidebar.classList.contains('open');
    }
    
    closeMobileMenu() {
        this.sidebar.classList.remove('open');
    }
    
    closeMobileMenu() {
        this.sidebar.classList.remove('open');
    }
    
    setupScrollSpy() {
        const observerOptions = {
            root: null,
            rootMargin: '-20% 0px -80% 0px',
            threshold: 0
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.setActiveLink(entry.target.id);
                }
            });
        }, observerOptions);
        
        this.sections.forEach(section => observer.observe(section));
    }
    
    setActiveLink(sectionId) {
        this.navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${sectionId}`) {
                link.classList.add('active');
            }
        });
    }
    
    setupBackToTop() {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                this.backToTop.classList.remove('hidden');
            } else {
                this.backToTop.classList.add('hidden');
            }
        });
        
        this.backToTop?.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}

// ==================== Copy Code System ====================
class CopyCodeSystem {
    constructor() {
        this.init();
    }
    
    init() {
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleCopy(e));
        });
    }
    
    async handleCopy(e) {
        const btn = e.currentTarget;
        const codeBlock = btn.closest('.code-block');
        const code = codeBlock?.querySelector('code');
        
        if (!code) return;
        
        try {
            await navigator.clipboard.writeText(code.textContent);
            
            // Visual feedback
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            btn.classList.add('copied');
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.classList.remove('copied');
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }
}

// ==================== Smooth Scroll ====================
class SmoothScroll {
    constructor() {
        this.init();
    }
    
    init() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = anchor.getAttribute('href').slice(1);
                const target = document.getElementById(targetId);
                
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                    
                    // Update URL without scrolling
                    history.pushState(null, null, `#${targetId}`);
                }
            });
        });
    }
}

// ==================== Utility Functions ====================
const Utils = {
    // Delay helper for animations
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    // Format time ago
    timeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        
        const intervals = {
            year: 31536000,
            month: 2592000,
            week: 604800,
            day: 86400,
            hour: 3600,
            minute: 60
        };
        
        for (const [unit, secondsInUnit] of Object.entries(intervals)) {
            const interval = Math.floor(seconds / secondsInUnit);
            if (interval >= 1) {
                return `${interval} ${unit}${interval !== 1 ? 's' : ''} ago`;
            }
        }
        
        return 'just now';
    },
    
    // Animate number
    animateNumber(element, start, end, duration = 1000) {
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + (end - start) * eased);
            
            element.textContent = current;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    },
    
    // Generate unique ID
    generateId() {
        return `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },
    
    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// ==================== Initialize Everything ====================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all systems
    window.searchSystem = new SearchSystem();
    window.navigation = new NavigationSystem();
    window.copyCode = new CopyCodeSystem();
    window.smoothScroll = new SmoothScroll();
    
    // Initialize Prism.js highlighting
    if (typeof Prism !== 'undefined') {
        Prism.highlightAll();
    }
    
    // Handle initial hash
    if (window.location.hash) {
        const target = document.querySelector(window.location.hash);
        if (target) {
            setTimeout(() => {
                target.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }
    
    console.log('Laravel MCP Documentation initialized');
});

// Export for use in other modules
window.Utils = Utils;
