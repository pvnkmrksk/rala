// ============================================================================
// utils.js - Utility functions: dark mode, URL sync, audio, and copy
// ============================================================================
function initDarkMode() {
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const darkModeIcon = document.getElementById('dark-mode-icon');
    
    // Check for saved preference, otherwise use system preference
    const savedMode = localStorage.getItem('darkMode');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    let isDark = savedMode === 'dark' || (savedMode === null && systemPrefersDark);
    
    function updateDarkMode(dark) {
        if (dark) {
            document.body.classList.remove('light-mode');
            document.body.classList.add('dark-mode');
            // Update icon to sun (light mode icon)
            darkModeIcon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
            darkModeToggle.setAttribute('title', 'Switch to light mode');
        } else {
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
            // Update icon to moon (dark mode icon)
            darkModeIcon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
            darkModeToggle.setAttribute('title', 'Switch to dark mode');
        }
        localStorage.setItem('darkMode', dark ? 'dark' : 'light');
    }
    
    // Initialize
    updateDarkMode(isDark);
    
    // Toggle on click
    darkModeToggle.addEventListener('click', () => {
        isDark = !isDark;
        updateDarkMode(isDark);
    });
    
    // Listen for system preference changes (only if no saved preference)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (localStorage.getItem('darkMode') === null) {
            updateDarkMode(e.matches);
        }
    });
}

function initScrollToTopButton() {
    const buttonId = 'scroll-to-top-button';
    let scrollTopButton = document.getElementById(buttonId);

    if (!scrollTopButton) {
        scrollTopButton = document.createElement('button');
        scrollTopButton.id = buttonId;
        scrollTopButton.className = 'scroll-top-button';
        scrollTopButton.setAttribute('type', 'button');
        scrollTopButton.setAttribute('title', 'Scroll to top');
        scrollTopButton.setAttribute('aria-label', 'Scroll to top');
        scrollTopButton.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="m18 15-6-6-6 6"></path>
            </svg>
        `;
        document.body.appendChild(scrollTopButton);
    }

    const toggleVisibility = () => {
        if (window.scrollY > 320) {
            scrollTopButton.classList.add('show');
        } else {
            scrollTopButton.classList.remove('show');
        }
    };

    scrollTopButton.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    window.addEventListener('scroll', toggleVisibility, { passive: true });
    toggleVisibility();
}
// URL sync functionality
function getQueryFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('q') || '';
}

function updateURL(query, replace = false) {
    const url = new URL(window.location);
    if (query.trim()) {
        url.searchParams.set('q', query.trim());
    } else {
        url.searchParams.delete('q');
    }
    if (replace) {
        window.history.replaceState({ query }, '', url);
    } else {
        window.history.pushState({ query }, '', url);
    }
}
function getAudioUrl(entryId, source = 'alar') {
    console.log('🔍 getAudioUrl called:', { entryId, source, entryIdType: typeof entryId });
    
    if (!entryId) {
        console.log('❌ No entryId provided');
        return null;
    }
    
    // Alar: uses numeric IDs directly
    if (source === 'alar') {
        const numericId = typeof entryId === 'string' ? parseInt(entryId, 10) : entryId;
        if (isNaN(numericId)) {
            console.log('❌ Invalid Alar ID (not numeric):', entryId);
            return null;
        }
        
    // Audio files are organized by ID ranges: 1-9999, 10000-19999, etc.
    let rangeStart, rangeEnd;
        if (numericId <= 9999) {
        rangeStart = 1;
        rangeEnd = 9999;
    } else {
            rangeStart = Math.floor(numericId / 10000) * 10000;
        rangeEnd = rangeStart + 9999;
    }
    const range = `${rangeStart}-${rangeEnd}`;
        const url = `https://raw.githubusercontent.com/Aditya-ds-1806/Alar-voice-corpus/main/audio/${range}/${numericId}.mp3`;
        console.log('✅ Alar audio URL:', url);
        return url;
    }
    
    // Padakanaja: uses entry_id (string) but needs sequential_id for range calculation
    const entryIdStr = String(entryId);
    console.log('🔍 Padakanaja lookup:', { entryIdStr, indexLoaded: padakanajaAudioIndex !== null, indexSize: padakanajaAudioIndex ? Object.keys(padakanajaAudioIndex).length : 0 });
    
    if (source !== 'alar' && padakanajaAudioIndex && padakanajaAudioIndex[entryIdStr]) {
        const sequentialId = padakanajaAudioIndex[entryIdStr];
        console.log('✅ Found sequential_id:', sequentialId, 'for entry_id:', entryIdStr);
        
        let rangeStart, rangeEnd;
        if (sequentialId <= 9999) {
            rangeStart = 1;
            rangeEnd = 9999;
        } else {
            rangeStart = Math.floor(sequentialId / 10000) * 10000;
            rangeEnd = rangeStart + 9999;
        }
        const range = `${rangeStart}-${rangeEnd}`;
        const url = `${PADAKANAJA_VOICE_CORPUS_URL}/audio/${range}/${entryIdStr}.mp3`;
        console.log('✅ Padakanaja audio URL:', url);
        return url;
    } else {
        console.log('❌ Padakanaja entry not found in index:', {
            entryIdStr,
            indexLoaded: padakanajaAudioIndex !== null,
            inIndex: padakanajaAudioIndex ? entryIdStr in padakanajaAudioIndex : false
        });
    }
    
    return null;
}

// Load Padakanaja audio index (lightweight mapping: entry_id -> sequential_id)
async function loadPadakanajaAudioIndex() {
    if (padakanajaAudioIndex !== null) return padakanajaAudioIndex; // Already loaded
    if (padakanajaAudioIndexLoading) {
        // Wait for ongoing load
        while (padakanajaAudioIndexLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return padakanajaAudioIndex;
    }
    
    padakanajaAudioIndexLoading = true;
    try {
        const response = await fetch(`${PADAKANAJA_VOICE_CORPUS_URL}/audio_index.json`);
        if (response.ok) {
            padakanajaAudioIndex = await response.json();
            console.log(`✓ Loaded Padakanaja audio index (${Object.keys(padakanajaAudioIndex).length} entries)`);
        } else {
            console.warn('Failed to load Padakanaja audio index:', response.status);
            padakanajaAudioIndex = {}; // Empty to prevent retries
        }
    } catch (error) {
        console.warn('Error loading Padakanaja audio index:', error);
        padakanajaAudioIndex = {}; // Empty to prevent retries
    } finally {
        padakanajaAudioIndexLoading = false;
    }
    
    return padakanajaAudioIndex;
}

async function checkAudioExists(entryId, source = 'alar') {
    const entryIdStr = String(entryId);
    console.log('🔍 checkAudioExists called:', { entryId: entryIdStr, source });
    
    if (!entryIdStr || entryIdStr === '') {
        console.log('❌ Empty entryId');
        return false;
    }
    
    // Create cache key with source to avoid conflicts
    const cacheKey = `${source}:${entryIdStr}`;
    
    // Check cache first
    if (audioExistenceCache.has(cacheKey)) {
        const cached = audioExistenceCache.get(cacheKey);
        console.log('✅ Found in cache:', cached);
        return cached;
    }
    
    // For Padakanaja, ensure index is loaded
    if (source !== 'alar') {
        console.log('📚 Loading Padakanaja audio index...');
        await loadPadakanajaAudioIndex();
    }
    
    const audioUrl = getAudioUrl(entryIdStr, source);
    if (!audioUrl) {
        console.log('❌ No audio URL generated');
        audioExistenceCache.set(cacheKey, false);
        return false;
    }
    
    console.log('🌐 Checking audio file:', audioUrl);
    try {
        // Use HEAD request with timeout to check if file exists
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
        
        const response = await fetch(audioUrl, { 
            method: 'HEAD', 
            cache: 'no-cache',
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        const exists = response.ok && response.status === 200;
        audioExistenceCache.set(cacheKey, exists);
        
        if (exists) {
            console.log('✅ Audio file exists:', audioUrl);
        } else {
            console.log(`❌ Audio file not found (${response.status}):`, audioUrl);
        }
        
        return exists;
    } catch (error) {
        // If there's an error (network, timeout, CORS, etc.), assume it doesn't exist
        audioExistenceCache.set(cacheKey, false);
        console.error(`❌ Error checking audio:`, error);
        console.error('   URL:', audioUrl);
        return false;
    }
}

async function checkAndUpdateAudioButtons(results) {
    // Collect all unique entry IDs from results that we haven't checked yet
    // Include source information
    const entriesToCheck = [];
    const seen = new Set();
    
    for (const result of results) {
        const idStr = result.id ? String(result.id).trim() : '';
        if (!idStr) continue;
        const source = result.source || 'alar';
        const cacheKey = `${source}:${idStr}`;
        
        if (!audioExistenceCache.has(cacheKey) && !seen.has(cacheKey)) {
            entriesToCheck.push({ id: idStr, source });
            seen.add(cacheKey);
        }
    }
    
    if (entriesToCheck.length === 0) return; // All already checked
    
    // Load Padakanaja index if needed (non-blocking, with timeout)
    const hasPadakanaja = entriesToCheck.some(e => e.source !== 'alar');
    if (hasPadakanaja) {
        try {
            await Promise.race([
                loadPadakanajaAudioIndex(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
            ]);
        } catch (error) {
            console.warn('Audio index load timeout or error, continuing without it');
        }
    }
    
    // Check audio files in smaller batches to avoid blocking
    // Limit to first 20 entries to avoid too many requests
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < Math.min(entriesToCheck.length, 20); i += batchSize) {
        batches.push(entriesToCheck.slice(i, i + batchSize));
    }
    
    // Process batches sequentially to avoid overwhelming the network
    for (const batch of batches) {
        const checkPromises = batch.map(async ({ id, source }) => {
            try {
                const exists = await checkAudioExists(id, source);
                return { entryId: id, source, exists };
            } catch (error) {
                return { entryId: id, source, exists: false };
            }
    });
    
    const results_checks = await Promise.all(checkPromises);
    
        // Update buttons for this batch
        results_checks.forEach(({ entryId, source, exists }) => {
            // Get audio URL now that index is loaded (if it exists)
            const audioUrl = exists ? getAudioUrl(entryId, source) : null;
            
            // Pre-load audio if it exists
            if (exists && audioUrl && typeof preloadAudio === 'function') {
                preloadAudio(audioUrl);
            }
            
            // Find all buttons for this entry ID (include source in selector if needed)
            const buttons = document.querySelectorAll(`[data-entry-id="${entryId}"][data-source="${source}"]`);
            if (buttons.length === 0) {
                // Try without source selector for backward compatibility
                const fallbackButtons = document.querySelectorAll(`[data-entry-id="${entryId}"]`);
                fallbackButtons.forEach(button => {
                    if (button.getAttribute('data-source') === source || !button.hasAttribute('data-source')) {
                        if (exists && audioUrl) {
                            button.style.display = '';
                            button.style.opacity = '1';
                            button.setAttribute('onclick', `playAudio('${button.id}', '${audioUrl.replace(/'/g, "\\'")}')`);
                            button.setAttribute('data-audio-url', audioUrl);
                        } else {
                            button.remove();
                        }
                    }
                });
            return;
        }
        buttons.forEach(button => {
                if (exists && audioUrl) {
                button.style.display = '';
                    button.style.opacity = '1';
                    button.setAttribute('onclick', `playAudio('${button.id}', '${audioUrl.replace(/'/g, "\\'")}')`);
                    button.setAttribute('data-audio-url', audioUrl);
            } else {
                // Remove the button if it doesn't exist
                button.remove();
            }
        });
    });
}
}

function copyKannadaWord(buttonId, kannadaWord) {
    navigator.clipboard.writeText(kannadaWord).then(() => {
        const button = document.getElementById(buttonId);
        if (button) {
            const originalTitle = button.getAttribute('title');
            button.setAttribute('title', 'Copied!');
            button.classList.add('copied');
            setTimeout(() => {
                button.setAttribute('title', originalTitle);
                button.classList.remove('copied');
            }, 2000);
        }
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}
function playAudio(buttonId, audioUrl) {
    console.log('🔊 playAudio called:', { buttonId, audioUrl });
    
    const button = document.getElementById(buttonId);
    if (!button) {
        console.error('❌ Audio button not found:', buttonId);
        return;
    }

    try {
        const raw = button.getAttribute('data-kannada-log');
        if (raw && typeof window.reportRalaWorkerEvent === 'function') {
            const label = decodeURIComponent(raw).replace(/[\r\n]/g, ' ').trim().slice(0, 120);
            if (label) {
                window.reportRalaWorkerEvent('audio_play', { w: label });
            }
        }
    } catch (_) {
        /* ignore malformed data-kannada-log */
    }
    
    if (!audioUrl) {
        console.error('❌ No audio URL provided');
        return;
    }
    
    console.log('✅ Button found, URL valid:', audioUrl);
    
    // Stop any currently playing audio
    const currentAudio = window.currentPlayingAudio;
    if (currentAudio) {
        console.log('⏹ Stopping previous audio');
        currentAudio.pause();
        currentAudio.currentTime = 0;
        const prevButton = document.querySelector('.audio-button.playing');
        if (prevButton) prevButton.classList.remove('playing');
    }
    
    // Play new audio
    console.log('▶️ Creating Audio object and playing...');
    const audio = new Audio(audioUrl);
    window.currentPlayingAudio = audio;
    
    button.classList.add('playing');
    
    audio.play().then(() => {
        console.log('✅ Audio playback started successfully');
    }).catch(err => {
        console.error('❌ Error playing audio:', err);
        console.error('   URL:', audioUrl);
        console.error('   Error details:', {
            name: err.name,
            message: err.message,
            code: err.code
        });
        button.classList.remove('playing');
    });
    
    audio.onended = () => {
        console.log('✅ Audio playback ended');
        button.classList.remove('playing');
        window.currentPlayingAudio = null;
    };
    
    audio.onerror = (e) => {
        console.error('❌ Audio error event:', e);
        console.error('   URL:', audioUrl);
        console.error('   Error code:', audio.error?.code);
        console.error('   Error message:', audio.error?.message);
        button.classList.remove('playing');
        window.currentPlayingAudio = null;
    };
    
    // Add load event listener for debugging
    audio.addEventListener('loadstart', () => {
        console.log('📥 Audio load started');
    });
    
    audio.addEventListener('loadeddata', () => {
        console.log('✅ Audio data loaded');
    });
    
    audio.addEventListener('canplay', () => {
        console.log('✅ Audio can play');
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollToTopButton);
} else {
    initScrollToTopButton();
}

// Make functions available globally
window.playAudio = playAudio;
if (typeof preloadAudio === 'function') {
    window.preloadAudio = preloadAudio;
}
