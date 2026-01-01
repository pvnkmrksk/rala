// ============================================================================
// pwa.js - Progressive Web App setup: service worker and install prompts
// ============================================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then((registration) => {
                console.log('✓ Service Worker registered:', registration.scope);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('New service worker available. Refresh to update.');
                        }
                    });
                });
            })
            .catch((error) => {
                console.warn('Service Worker registration failed:', error);
            });
    });
}

// Install Prompt Handling
let deferredPrompt;
window.deferredPrompt = null; // Make available globally
const installPrompt = document.getElementById('install-prompt');
const installClose = document.getElementById('install-close');

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    window.deferredPrompt = e; // Make available globally
    // Show the install prompt
    if (installPrompt) {
        installPrompt.classList.add('show');
    }
});

installPrompt.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    
    // Clear the deferredPrompt
    deferredPrompt = null;
    window.deferredPrompt = null;
    
    // Hide the install prompt
    if (installPrompt) {
        installPrompt.classList.remove('show');
    }
});

installClose.addEventListener('click', (e) => {
    e.stopPropagation();
    installPrompt.classList.remove('show');
});

// Hide prompt if app is already installed
window.addEventListener('appinstalled', () => {
    console.log('PWA installed successfully');
    if (installPrompt) {
        installPrompt.classList.remove('show');
    }
    deferredPrompt = null;
    window.deferredPrompt = null;
});

// Check if app is already installed (standalone mode)
if (window.matchMedia('(display-mode: standalone)').matches || 
    window.navigator.standalone === true) {
    console.log('Running as installed PWA');
    if (installPrompt) {
        installPrompt.classList.remove('show');
    }
}

// PWA Info Banner
const pwaInfoBanner = document.getElementById('pwa-info-banner');
const pwaInfoDismiss = document.getElementById('pwa-info-dismiss');

// Show info banner on first visit (if not dismissed before)
function showPWAInfo() {
    const dismissed = localStorage.getItem('pwa-info-dismissed');
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches || 
                       window.navigator.standalone === true;
    
    // Don't show if already dismissed or already installed
    if (!dismissed && !isInstalled && pwaInfoBanner) {
        // Show after a short delay so page loads first
        setTimeout(() => {
            pwaInfoBanner.classList.add('show');
        }, 2000);
    }
}

// Dismiss banner
if (pwaInfoDismiss) {
    pwaInfoDismiss.addEventListener('click', () => {
        if (pwaInfoBanner) {
            pwaInfoBanner.classList.remove('show');
            localStorage.setItem('pwa-info-dismissed', 'true');
        }
    });
}

// Show info banner
showPWAInfo();

// Start the app (only if not already started)
if (typeof init === 'function' && !window.appInitialized) {
    window.appInitialized = true;
    init();
}
