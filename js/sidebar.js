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
        // Trigger PWA install prompt if available
        if (window.deferredPrompt) {
            window.deferredPrompt.prompt();
            window.deferredPrompt.userChoice.then((choiceResult) => {
                window.deferredPrompt = null;
            });
        } else {
            // Show install instructions
            alert('To install this app:\n\n' +
                  'Chrome/Edge: Click the menu (⋮) → "Install Rala"\n' +
                  'Safari (iOS): Tap Share → "Add to Home Screen"\n' +
                  'Firefox: Click menu → "Install"');
        }
        closeSidebar();
    };
    
    installLink?.addEventListener('click', handleInstall);
    footerInstallLink?.addEventListener('click', handleInstall);
    
    // Close sidebar on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar?.classList.contains('open')) {
            closeSidebar();
        }
    });
}

