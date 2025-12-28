// ============================================================================
// dictionary.js - Dictionary loading, caching, and reverse index building
// ============================================================================

// Load dictionary with IndexedDB caching
async function loadDictionary() {
    // Check if we should bypass cache (URL parameter or version mismatch)
    const bypassCache = shouldBypassCache();
    const cachedVersion = await getCachedVersion();
    const versionMatches = cachedVersion === CACHE_VERSION;
    
    // Try to load from cache first (unless bypassed or version mismatch)
    if (!bypassCache && versionMatches) {
        try {
            const cachedData = await getCachedDictionary();
            if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
                console.log(`✓ Loaded ${cachedData.length} entries from IndexedDB cache`);
                console.log('Using cached dictionary. Add ?refresh=true to URL to force reload from network.');
                dictionary = cachedData;
                return; // Use cache, don't fetch from network
            } else {
                console.log('No cache found in IndexedDB, fetching from network');
            }
        } catch (error) {
            console.warn('Failed to load from IndexedDB cache:', error);
            console.log('Falling back to network fetch');
        }
    } else {
        if (bypassCache) {
            console.log('Cache bypassed (refresh parameter detected)');
        } else if (!versionMatches) {
            console.log(`Cache version mismatch (cached: ${cachedVersion}, current: ${CACHE_VERSION}), fetching fresh data`);
        }
    }
    
    // If no cache or bypassed, fetch from network
    await fetchAndCacheDictionary();
}

// Clean Kannada entry text - remove brackets, parentheses, and other non-text characters
function cleanKannadaEntry(text) {
    if (!text) return '';
    // Remove brackets: [], (), {}, 【】, 「」, etc.
    let cleaned = text.replace(/[\[\](){}【】「」〈〉《》『』〔〕［］（）｛｝]/g, '');
    // Remove other common punctuation that shouldn't be in dictionary keys
    cleaned = cleaned.replace(/[<>"']/g, '');
    // Remove multiple spaces and trim
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}

// Count words in Kannada text (split by spaces)
function countWords(text) {
    if (!text) return 0;
    const cleaned = cleanKannadaEntry(text);
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    return words.length;
}

// Check if entry is a long phrase (>4 words)
function isLongPhrase(text) {
    return countWords(text) > 4;
}

// Normalize type field to full forms (e.g., "n" -> "Noun", "v" -> "Verb")
function normalizeType(type) {
    if (!type) return 'Noun';
    const typeLower = type.toLowerCase().trim();
    const typeMap = {
        'n': 'Noun',
        'v': 'Verb',
        'adj': 'Adjective',
        'adv': 'Adverb',
        'pron': 'Pronoun',
        'prep': 'Preposition',
        'conj': 'Conjunction',
        'interj': 'Interjection',
        'noun': 'Noun',
        'verb': 'Verb',
        'adjective': 'Adjective',
        'adverb': 'Adverb',
        'pronoun': 'Pronoun',
        'preposition': 'Preposition',
        'conjunction': 'Conjunction',
        'interjection': 'Interjection'
    };
    return typeMap[typeLower] || type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

// Normalize entry types in a dictionary
function normalizeEntryTypes(entries) {
    if (!entries || !Array.isArray(entries)) return entries;
    
    return entries.map(entry => {
        if (entry.defs && Array.isArray(entry.defs)) {
            entry.defs = entry.defs.map(def => {
                if (def.type) {
                    def.type = normalizeType(def.type);
                }
                return def;
            });
        }
        return entry;
    });
}

// Fetch a single dictionary file (remote or local)
async function fetchDictionaryFile(source, onProgress = null) {
    try {
        let url = source.url;
        
        // For local files, ensure proper URL encoding
        if (source.type === 'local') {
            // Split path and encode each segment
            const parts = url.split('/');
            const encodedParts = parts.map(part => encodeURIComponent(part));
            url = encodedParts.join('/');
        }
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch ${url} (${response.status} ${response.statusText})`);
        
        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : null;
        let loaded = 0;
        
        // Stream the response for progress tracking
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let text = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            loaded += value.length;
            text += decoder.decode(value, { stream: true });
            
            // Report progress if callback provided
            if (onProgress && total) {
                const percent = Math.round((loaded / total) * 100);
                onProgress(loaded, total, percent);
            }
        }
        
        // Decode any remaining text
        text += decoder.decode();
        
        const entries = jsyaml.load(text);
        
        // Normalize types in the loaded entries
        return normalizeEntryTypes(entries);
    } catch (error) {
        console.error(`Failed to load dictionary from ${source.url}:`, error);
        if (error.message && error.message.includes('CORS')) {
            console.error('⚠ CORS error: Make sure you are accessing the page via http://localhost:8000, not file://');
        }
        return null;
    }
}

// Progress tracking for background dictionary loading
let backgroundLoadProgress = {
    current: 0,
    total: 1, // Now just one combined file
    isActive: false
};

// Update progress indicator UI
function updateProgressIndicator(loaded, total, percent = null, label = '') {
    const progressEl = document.getElementById('dict-progress');
    if (!progressEl) return;
    
    const calculatedPercent = percent !== null ? percent : (total > 0 ? Math.round((loaded / total) * 100) : 0);
    progressEl.querySelector('.progress-percent').textContent = `${calculatedPercent}%`;
    progressEl.querySelector('.progress-bar-fill').style.width = `${calculatedPercent}%`;
    
    if (label) {
        const labelEl = progressEl.querySelector('.progress-label');
        if (labelEl) labelEl.textContent = label;
    }
    
    if (calculatedPercent < 100) {
        progressEl.style.display = 'flex';
        // Trigger opacity transition
        setTimeout(() => {
            progressEl.style.opacity = '1';
        }, 10);
        backgroundLoadProgress.isActive = true;
    } else {
        // Fade out after a moment
        setTimeout(() => {
            progressEl.style.opacity = '0';
            setTimeout(() => {
                progressEl.style.display = 'none';
                backgroundLoadProgress.isActive = false;
            }, 300);
        }, 500);
    }
}

// Fetch dictionary from network and cache it in IndexedDB
async function fetchAndCacheDictionary() {
    try {
        console.log('=== MULTI-DICTIONARY LOADER v1.7 (Progressive Loading) ===');
        
        // Step 1: Load primary dictionary first with progress bar
        console.log(`Loading primary dictionary: ${PRIMARY_DICTIONARY.name}`);
        createProgressIndicator();
        updateProgressIndicator(0, 1, 0, 'Loading Alar Dictionary...');
        
        const primaryEntries = await fetchDictionaryFile(
            PRIMARY_DICTIONARY,
            (loaded, total, percent) => {
                updateProgressIndicator(loaded, total, percent, 'Loading Alar Dictionary...');
            }
        );
        
        if (!primaryEntries || !Array.isArray(primaryEntries)) {
            throw new Error('Failed to load primary dictionary');
        }
        
        // Add source info to primary entries
        primaryEntries.forEach(entry => {
            if (!entry.dict_title) entry.dict_title = PRIMARY_DICTIONARY.dictTitle;
            if (!entry.dict_title_kannada) entry.dict_title_kannada = PRIMARY_DICTIONARY.dictTitleKannada;
            if (!entry.source) entry.source = 'alar';
        });
        
        dictionary = primaryEntries;
        console.log(`✓ Loaded ${primaryEntries.length} entries from ${PRIMARY_DICTIONARY.name}`);
        
        // Build reverse index immediately so search works
        buildReverseIndex();
        
        // Hide progress indicator immediately - Alar is ready for search
        const progressEl = document.getElementById('dict-progress');
        if (progressEl) {
            progressEl.style.opacity = '0';
            setTimeout(() => {
                progressEl.style.display = 'none';
            }, 300);
        }
        
        // Step 2: Load combined padakanaja dictionary in background (truly async, non-blocking)
        // Use requestIdleCallback or setTimeout to ensure it doesn't block UI
        console.log(`Loading additional dictionaries in background (non-blocking)...`);
        
        const loadPadakanajaAsync = () => {
            // Only show progress if user is still on page after a delay
            let progressShown = false;
            const showProgressIfNeeded = () => {
                if (!progressShown) {
                    createProgressIndicator();
                    updateProgressIndicator(0, 1, 0, 'Loading Additional Dictionaries...');
                    progressShown = true;
                }
            };
            
            // Delay showing progress to avoid UI clutter if loading is fast
            const progressTimeout = setTimeout(showProgressIfNeeded, 2000);
            
            const padakanajaSource = { url: PADAKANAJA_COMBINED_FILE, type: 'local' };
            fetchDictionaryFile(
                padakanajaSource,
                (loaded, total, percent) => {
                    if (!progressShown) {
                        clearTimeout(progressTimeout);
                        showProgressIfNeeded();
                    }
                    updateProgressIndicator(loaded, total, percent, 'Loading Additional Dictionaries...');
                }
            ).then(padakanajaEntries => {
                clearTimeout(progressTimeout);
                if (padakanajaEntries && Array.isArray(padakanajaEntries)) {
                    dictionary.push(...padakanajaEntries);
                    console.log(`✓ Loaded ${padakanajaEntries.length} entries from combined padakanaja dictionary`);
                    
                    // Rebuild reverse index with all entries (incrementally, non-blocking)
                    // Use requestIdleCallback or chunk the work to avoid blocking
                    if ('requestIdleCallback' in window) {
                        requestIdleCallback(() => {
                            addToReverseIndex(padakanajaEntries);
                            updateCache();
                        }, { timeout: 5000 });
                    } else {
                        // Fallback: chunk the work
                        setTimeout(() => {
                            addToReverseIndex(padakanajaEntries);
                            updateCache();
                        }, 100);
                    }
                    
                    if (progressShown) {
                        updateProgressIndicator(1, 1, 100, 'All Dictionaries Loaded');
                    }
                    console.log(`✓ Total loaded: ${dictionary.length} entries from 2 sources (Alar + Combined Padakanaja)`);
                } else {
                    console.warn(`⚠ Failed to load combined padakanaja dictionary`);
                    if (progressShown) {
                        updateProgressIndicator(1, 1, 100, 'Alar Dictionary Ready');
                    }
                }
            }).catch(error => {
                clearTimeout(progressTimeout);
                console.error('Error loading padakanaja dictionary:', error);
                if (progressShown) {
                    updateProgressIndicator(1, 1, 100, 'Alar Dictionary Ready');
                }
            });
        };
        
        // Use requestIdleCallback if available, otherwise setTimeout with delay
        if ('requestIdleCallback' in window) {
            requestIdleCallback(loadPadakanajaAsync, { timeout: 1000 });
        } else {
            // Fallback: delay by 500ms to ensure UI is responsive
            setTimeout(loadPadakanajaAsync, 500);
        }
        
        // Cache function (called separately)
        async function updateCache() {
            try {
                const dataSize = new Blob([JSON.stringify(dictionary)]).size;
                const sizeMB = (dataSize / 1024 / 1024).toFixed(2);
                console.log(`Caching ${sizeMB} MB of data in IndexedDB...`);
                
                await setCachedDictionary(dictionary);
                await setCachedVersion(CACHE_VERSION);
                
                // Verify cache was saved
                const verifyCache = await getCachedDictionary();
                if (verifyCache && verifyCache.length === dictionary.length) {
                    console.log(`✓ Dictionary cached successfully in IndexedDB (${sizeMB} MB)`);
                    console.log(`  Cache verification: ${verifyCache.length} entries stored`);
                } else {
                    console.warn('⚠ Cache verification: entry count mismatch');
                }
            } catch (error) {
                console.error('✗ Failed to cache dictionary in IndexedDB:', error);
                console.error('Dictionary will be fetched on each visit');
            }
        }
        
        // Cache Alar dictionary immediately (will update with full dictionary later)
        updateCache();
    } catch (error) {
        // If network fetch fails and we have cached data, use it
        if (dictionary.length === 0) {
            try {
                const cachedData = await getCachedDictionary();
                if (cachedData && Array.isArray(cachedData) && cachedData.length > 0) {
                    dictionary = cachedData;
                    console.log(`✓ Network failed, using cached data: ${dictionary.length} entries`);
                    buildReverseIndex();
                    return;
                }
            } catch (cacheError) {
                console.error('✗ Failed to load from cache:', cacheError);
            }
        }
        throw error;
    }
}

// Add entries to reverse index incrementally
function addToReverseIndex(entries) {
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (!entry.defs) continue;
        
        const entryId = entry.id;
        
        for (const def of entry.defs) {
            if (!def.entry) continue;
            
            const words = extractWords(def.entry.toLowerCase());
            
            for (const word of words) {
                allEnglishWords.add(word);
                if (!reverseIndex.has(word)) {
                    reverseIndex.set(word, []);
                }
                reverseIndex.get(word).push({
                    kannada: cleanKannadaEntry(entry.entry),
                    phone: entry.phone,
                    definition: def.entry,
                    type: normalizeType(def.type),
                    head: entry.head,
                    id: entryId,
                    dict_title: entry.dict_title,
                    source: entry.source
                });
            }
        }
    }
}

// Create progress indicator UI
function createProgressIndicator() {
    if (document.getElementById('dict-progress')) return;
    
    const progressEl = document.createElement('div');
    progressEl.id = 'dict-progress';
    progressEl.className = 'dict-progress';
    progressEl.innerHTML = `
        <div class="progress-content">
            <div class="progress-label">Loading dictionaries</div>
            <div class="progress-bar">
                <div class="progress-bar-fill"></div>
            </div>
            <div class="progress-percent">0%</div>
        </div>
    `;
    document.body.appendChild(progressEl);
}

function buildReverseIndex() {
    // Build reverse index: English word -> list of Kannada entries
    reverseIndex = new Map();
    
    for (let i = 0; i < dictionary.length; i++) {
        const entry = dictionary[i];
        if (!entry.defs) continue;
        
        // Use the entry's own ID field (which matches the voice corpus file IDs)
        const entryId = entry.id;
        
        for (const def of entry.defs) {
            if (!def.entry) continue;
            
            // Extract English words from definition
            const words = extractWords(def.entry.toLowerCase());
            
            for (const word of words) {
                allEnglishWords.add(word);
                if (!reverseIndex.has(word)) {
                    reverseIndex.set(word, []);
                }
                reverseIndex.get(word).push({
                    kannada: cleanKannadaEntry(entry.entry),
                    phone: entry.phone,
                    definition: def.entry,
                    type: normalizeType(def.type),
                    head: entry.head,
                    id: entryId,
                    dict_title: entry.dict_title,
                    source: entry.source
                });
            }
        }
    }
    
    console.log(`Built reverse index with ${reverseIndex.size} English words`);
}

function extractWords(text) {
    // Extract meaningful words (skip common words, punctuation, etc.)
    const stopWords = new Set([
        'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
        'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
        'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'up',
        'about', 'into', 'over', 'after', 'or', 'and', 'but', 'if', 'as',
        'etc', 'eg', 'ie', 'cf', 'vs', 'fig', 'esp', 'also', 'see'
    ]);
    
    return text
        .replace(/[^\w\s-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w));
}

