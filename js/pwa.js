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
const INSTALL_AUTO_SHOWN_KEY = 'rala_install_auto_shown_v1';
const INSTALL_AUTO_SHOW_DELAY_MS = 3500;
let autoInstallShowTimer = null;

function isIosDevice() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isInStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
}

function ensureInstallHelpSheet() {
    let sheet = document.getElementById('install-help-sheet');
    if (sheet) return sheet;

    sheet = document.createElement('div');
    sheet.id = 'install-help-sheet';
    sheet.className = 'install-help-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-live', 'polite');
    sheet.innerHTML = `
        <div class="install-help-card">
            <button type="button" class="install-help-close" id="install-help-close" aria-label="Close install help">×</button>
            <h3>Install Rala</h3>
            <p id="install-help-text"></p>
        </div>
    `;
    document.body.appendChild(sheet);

    const closeBtn = sheet.querySelector('#install-help-close');
    closeBtn?.addEventListener('click', () => {
        sheet.classList.remove('show');
    });

    sheet.addEventListener('click', (e) => {
        if (e.target === sheet) {
            sheet.classList.remove('show');
        }
    });

    return sheet;
}

function getPlatformLabel() {
    const ua = navigator.userAgent || '';
    const platform = (navigator.platform || '').toLowerCase();
    if (isIosDevice()) return 'ios';
    if (/android/i.test(ua)) return 'android';
    if (platform.includes('win')) return 'windows';
    if (platform.includes('mac')) return 'macos';
    if (platform.includes('linux')) return 'linux';
    return 'other';
}

function getInstallInstructionText() {
    const platform = getPlatformLabel();
    if (platform === 'ios') {
        return 'On iPhone/iPad Safari: tap Share, then choose Add to Home Screen. Once installed, Rala works offline.';
    }
    if (platform === 'android') {
        return 'On Android: open browser menu and choose Install App or Add to Home screen. Once installed, Rala works offline.';
    }
    if (platform === 'windows') {
        return 'On Windows: open browser menu and choose Install App (or Apps > Install this site as an app). Once installed, Rala works offline.';
    }
    if (platform === 'macos') {
        return 'On macOS Safari: use File > Add to Dock. In Chrome/Edge, use the Install App button in the address bar or browser menu. Once installed, Rala works offline.';
    }
    if (platform === 'linux') {
        return 'On Linux: open browser menu and choose Install App / Install this site as an app. Once installed, Rala works offline.';
    }
    return 'Open your browser menu and choose Install App or Add to Home screen. Once installed, Rala works offline.';
}

function showInstallInstructions() {
    const sheet = ensureInstallHelpSheet();
    const text = sheet.querySelector('#install-help-text');
    text.textContent = getInstallInstructionText();

    sheet.classList.add('show');
}

function scheduleAutoInstallPromptCard() {
    if (!installPrompt || isInStandaloneMode()) return;
    const alreadyShown = localStorage.getItem(INSTALL_AUTO_SHOWN_KEY) === '1';
    if (alreadyShown) return;
    clearTimeout(autoInstallShowTimer);
    autoInstallShowTimer = setTimeout(() => {
        if (!isInStandaloneMode() && deferredPrompt) {
            installPrompt.classList.add('show');
            localStorage.setItem(INSTALL_AUTO_SHOWN_KEY, '1');
        }
    }, INSTALL_AUTO_SHOW_DELAY_MS);
}

async function promptInstall() {
    if (!deferredPrompt) return false;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);

    deferredPrompt = null;
    window.deferredPrompt = null;
    if (installPrompt) {
        installPrompt.classList.remove('show');
    }
    return true;
}

window.triggerInstallFlow = async function triggerInstallFlow() {
    if (deferredPrompt) {
        await promptInstall();
        return;
    }
    if (!isInStandaloneMode()) {
        showInstallInstructions();
    }
};

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    window.deferredPrompt = e; // Make available globally
    // Auto-show install card only once, after app settles for a few seconds.
    scheduleAutoInstallPromptCard();
});

if (installPrompt) {
    installPrompt.addEventListener('click', async () => {
        await window.triggerInstallFlow();
    });
}

if (installClose && installPrompt) {
    installClose.addEventListener('click', (e) => {
        e.stopPropagation();
        installPrompt.classList.remove('show');
        // Count as seen once if user dismisses.
        localStorage.setItem(INSTALL_AUTO_SHOWN_KEY, '1');
    });
}

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

// For platforms without beforeinstallprompt (e.g., iOS Safari), show polished
// install instructions automatically only once.
window.addEventListener('load', () => {
    if (isInStandaloneMode()) return;
    const alreadyShown = localStorage.getItem(INSTALL_AUTO_SHOWN_KEY) === '1';
    if (alreadyShown) return;
    if (deferredPrompt) return;
    if (!installPrompt) return;
    setTimeout(() => {
        if (!deferredPrompt && !isInStandaloneMode()) {
            showInstallInstructions();
            localStorage.setItem(INSTALL_AUTO_SHOWN_KEY, '1');
        }
    }, INSTALL_AUTO_SHOW_DELAY_MS);
});

// PWA Info Banner - REMOVED (user requested deletion)

// Start the app (only if not already started)
if (typeof init === 'function' && !window.appInitialized) {
    window.appInitialized = true;
init();
}
