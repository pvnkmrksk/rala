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
    if (!entryId) return null;
    
    // Alar: uses numeric IDs directly
    if (source === 'alar') {
        // Audio files are organized by ID ranges: 1-9999, 10000-19999, etc.
        let rangeStart, rangeEnd;
        if (entryId <= 9999) {
            rangeStart = 1;
            rangeEnd = 9999;
        } else {
            rangeStart = Math.floor(entryId / 10000) * 10000;
            rangeEnd = rangeStart + 9999;
        }
        const range = `${rangeStart}-${rangeEnd}`;
        return `https://raw.githubusercontent.com/Aditya-ds-1806/Alar-voice-corpus/main/audio/${range}/${entryId}.mp3`;
    }
    
    // Padakanaja: uses entry_id (string) but needs sequential_id for range calculation
    if (source !== 'alar' && padakanajaAudioIndex && padakanajaAudioIndex[entryId]) {
        const sequentialId = padakanajaAudioIndex[entryId];
        let rangeStart, rangeEnd;
        if (sequentialId <= 9999) {
            rangeStart = 1;
            rangeEnd = 9999;
        } else {
            rangeStart = Math.floor(sequentialId / 10000) * 10000;
            rangeEnd = rangeStart + 9999;
        }
        const range = `${rangeStart}-${rangeEnd}`;
        return `${PADAKANAJA_VOICE_CORPUS_URL}/audio/${range}/${entryId}.mp3`;
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
    if (!entryId) return false;
    
    // Create cache key with source to avoid conflicts
    const cacheKey = `${source}:${entryId}`;
    
    // Check cache first
    if (audioExistenceCache.has(cacheKey)) {
        return audioExistenceCache.get(cacheKey);
    }
    
    // For Padakanaja, ensure index is loaded
    if (source !== 'alar') {
        await loadPadakanajaAudioIndex();
    }
    
    const audioUrl = getAudioUrl(entryId, source);
    if (!audioUrl) {
        audioExistenceCache.set(cacheKey, false);
        return false;
    }
    
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
        return exists;
    } catch (error) {
        // If there's an error (network, timeout, CORS, etc.), assume it doesn't exist
        audioExistenceCache.set(cacheKey, false);
        return false;
    }
}

async function checkAndUpdateAudioButtons(results) {
    // Collect all unique entry IDs from results that we haven't checked yet
    // Include source information
    const entriesToCheck = [];
    const seen = new Set();
    
    for (const result of results) {
        if (!result.id || result.id.trim() === '') continue;
        const source = result.source || 'alar';
        const cacheKey = `${source}:${result.id}`;
        
        if (!audioExistenceCache.has(cacheKey) && !seen.has(cacheKey)) {
            entriesToCheck.push({ id: result.id, source });
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
                } else {
                    // Remove the button if it doesn't exist
                    button.remove();
                }
            });
        });
    }
}

function renderResultCard(result, query, isSynonym = false) {
    const highlightedDef = highlightMatch(result.definition, result.matchedWord, result.matchType);
    const audioUrl = result.id ? getAudioUrl(result.id) : null;
    const audioId = `audio-${result.id || 'no-id'}-${result.kannada.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const copyId = `copy-${result.id || 'no-id'}-${result.kannada.replace(/[^a-zA-Z0-9]/g, '-')}`;
    
    // Check cache first - if we know it doesn't exist, don't show button
    // If unknown, show it and check asynchronously
    let showButton = false;
    if (audioUrl && result.id) {
        const cached = audioExistenceCache.get(result.id);
        if (cached === true) {
            showButton = true; // We know it exists
        } else if (cached === false) {
            showButton = false; // We know it doesn't exist
        } else {
            showButton = true; // Unknown - show it and check later
        }
    }
    
    return `
        <div class="result-card">
            <div class="kannada-word">
                ${showButton && audioUrl ? `
                    <button class="audio-button" id="${audioId}" data-entry-id="${result.id || ''}" onclick="playAudio('${audioId}', '${audioUrl.replace(/'/g, "\\'")}')" title="Play pronunciation">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </button>
                ` : ''}
                <span>${result.kannada}</span>
                <button class="copy-button" id="${copyId}" onclick="copyKannadaWord('${copyId}', '${result.kannada.replace(/'/g, "\\'")}')" title="Copy Kannada word">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                </button>
            </div>
            <div class="phonetic">${result.phone || ''}</div>
            <div class="definition selectable">
                <span class="def-type">${result.type || 'n/a'}</span>
                <span class="def-text">${highlightedDef}</span>
            </div>
            ${isSynonym ? `<div class="synonym-match">matched via synonym: "${result.matchedWord}" (searched: "${result.originalQuery}")</div>` : ''}
        </div>
    `;
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
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    // Stop any currently playing audio
    const currentAudio = window.currentPlayingAudio;
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        const prevButton = document.querySelector('.audio-button.playing');
        if (prevButton) prevButton.classList.remove('playing');
    }
    
    // Play new audio
    const audio = new Audio(audioUrl);
    window.currentPlayingAudio = audio;
    
    button.classList.add('playing');
    
    audio.play().catch(err => {
        console.error('Error playing audio:', err);
        button.classList.remove('playing');
    });
    
    audio.onended = () => {
        button.classList.remove('playing');
        window.currentPlayingAudio = null;
    };
    
    audio.onerror = () => {
        button.classList.remove('playing');
        window.currentPlayingAudio = null;
    };
}

// Make playAudio available globally
window.playAudio = playAudio;
