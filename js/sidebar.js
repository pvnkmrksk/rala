// ============================================================================
// sidebar.js - Sidebar menu functionality
// ============================================================================

function initSidebar() {
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const sidebar = document.getElementById('sidebar');
    const sidebarClose = document.getElementById('sidebar-close');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const installLink = document.getElementById('install-link');
    const footerInstallLink = document.getElementById('footer-install-link');
    const sidebarOpenFeedback = document.getElementById('sidebar-open-feedback');
    
    // Open sidebar
    hamburgerMenu?.addEventListener('click', () => {
        sidebar?.classList.add('open');
        sidebarOverlay?.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent body scroll when sidebar is open
    });
    
    // Close sidebar
    const closeSidebar = () => {
        sidebar?.classList.remove('open');
        sidebarOverlay?.classList.remove('active');
        document.body.style.overflow = ''; // Restore body scroll
    };
    
    sidebarClose?.addEventListener('click', closeSidebar);
    sidebarOverlay?.addEventListener('click', closeSidebar);
    
    // Handle install link
    const handleInstall = (e) => {
        e.preventDefault();
        // Use unified install flow (native prompt where available, in-app guidance otherwise).
        if (typeof window.triggerInstallFlow === 'function') {
            window.triggerInstallFlow();
        }
        closeSidebar();
    };
    
    installLink?.addEventListener('click', handleInstall);
    // Footer install link removed

    sidebarOpenFeedback?.addEventListener('click', (e) => {
        e.preventDefault();
        if (typeof window.openRalaFeedback === 'function') {
            window.openRalaFeedback();
            closeSidebar();
            return;
        }
        closeSidebar();
        try {
            const u = new URL(window.location.href);
            u.searchParams.set('open_feedback', '1');
            window.location.assign(u.pathname + u.search + (u.hash || ''));
        } catch (_) {
            window.location.assign('index.html?open_feedback=1');
        }
    });
    
    // Close sidebar on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar?.classList.contains('open')) {
            closeSidebar();
        }
    });
}

