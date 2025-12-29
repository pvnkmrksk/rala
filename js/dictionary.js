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
            // Handle both old format (array) and new format (object with alar/padakanaja)
            if (cachedData) {
                if (Array.isArray(cachedData)) {
                    // Old format: just array of entries (might include padakanaja)
                    console.log(`✓ Loaded ${cachedData.length} entries from IndexedDB cache (old format)`);
                    dictionary = cachedData;
                    
                    // Check if mobile device - if so, separate padakanaja for IndexedDB search
                    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                    if (isMobileDevice) {
                        // On mobile, separate padakanaja entries and cache them separately
                        const alarEntries = [];
                        const padakanajaEntries = [];
                        for (const entry of cachedData) {
                            if (entry.source === 'alar') {
                                alarEntries.push(entry);
                            } else {
                                padakanajaEntries.push(entry);
                            }
                        }
                        dictionary = alarEntries;
                        if (padakanajaEntries.length > 0) {
                            try {
                                await setCachedPadakanaja(padakanajaEntries);
                                console.log(`✓ Separated and cached ${padakanajaEntries.length} padakanaja entries to IndexedDB for mobile`);
                                padakanajaInMemory = false;
                            } catch (error) {
                                console.error('Failed to cache padakanaja separately:', error);
                                // Fallback: keep in memory
                                dictionary = cachedData;
                                padakanajaInMemory = true;
                            }
                        }
                    } else {
                        // Desktop: keep everything in memory
                        padakanajaInMemory = true;
                    }
                    
                    dictionaryReady = true;
                    return;
                } else if (cachedData.alar && Array.isArray(cachedData.alar)) {
                    // New format: separate alar and padakanaja
                    dictionary = cachedData.alar;
                    
                    // Check if mobile device - handle padakanaja accordingly
                    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                    if (isMobileDevice && cachedData.padakanaja) {
                        // Mobile: cache padakanaja separately for IndexedDB search
                        try {
                            await setCachedPadakanaja(cachedData.padakanaja);
                            console.log('✓ Padakanaja cached separately for mobile IndexedDB search');
                            padakanajaInMemory = false;
                        } catch (error) {
                            console.error('Failed to cache padakanaja separately:', error);
                            // Fallback: expand and load into memory
                            const expandedPadakanaja = expandOptimizedEntries(cachedData.padakanaja);
                            dictionary = dictionary.concat(expandedPadakanaja);
                            padakanajaInMemory = true;
                        }
                    } else if (cachedData.padakanaja) {
                        // Desktop: expand and load into memory
                        const expandedPadakanaja = expandOptimizedEntries(cachedData.padakanaja);
                        dictionary = dictionary.concat(expandedPadakanaja);
                        padakanajaInMemory = true;
                    }
                    
                    dictionaryReady = true;
                    console.log(`✓ Loaded ${dictionary.length} entries from IndexedDB cache${isMobileDevice ? ' (padakanaja in IndexedDB)' : ''}`);
                console.log('Using cached dictionary. Add ?refresh=true to URL to force reload from network.');
                return; // Use cache, don't fetch from network
                }
            }
            console.log('No valid cache found in IndexedDB, fetching from network');
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

// Expand optimized dictionary format to flat array
// Supports both old format: {source: {dict_title: [[k, e, t?], ...]}}
// and new ultra-compact format: {source|dict_title: [[k, e, t?], ...]}
function expandOptimizedEntries(optimized) {
    // If it's already an array (regular format), return as-is
    if (Array.isArray(optimized)) {
        return optimized;
    }
    
    const entries = [];
    
    for (const [key, entriesList] of Object.entries(optimized)) {
        // Check if it's ultra-compact format (source|dict_title) or old format
        let source, dictTitle;
        if (key.includes('|')) {
            // Ultra-compact format: source|dict_title
            [source, dictTitle] = key.split('|', 2);
        } else {
            // Old format: nested {source: {dict_title: entries}}
            source = key;
            if (typeof optimized[key] === 'object' && !Array.isArray(optimized[key])) {
                // Old nested format
                for (const [dt, entriesList] of Object.entries(optimized[key])) {
                    for (const entryData of entriesList) {
                        let kannada, english, type;
                        if (entryData.length === 3) {
                            [kannada, english, type] = entryData;
                        } else {
                            [kannada, english] = entryData;
                            type = '';
                        }
                        entries.push({
                            entry: kannada,
                            defs: [{ entry: english, type: type || 'Noun' }],
                            source: source,
                            dict_title: dt
                        });
                    }
                }
                continue;
            }
            dictTitle = '';
        }
        
        // Process entries list (ultra-compact format)
        if (Array.isArray(entriesList)) {
            for (const entryData of entriesList) {
                // Handle both [k, e] and [k, e, t] formats
                let kannada, english, type;
                if (entryData.length === 3) {
                    [kannada, english, type] = entryData;
                } else {
                    [kannada, english] = entryData;
                    type = '';
                }
                
                entries.push({
                    entry: kannada,
                    defs: [{
                        entry: english,
                        type: type || 'Noun'  // Default type
                    }],
                    source: source,
                    dict_title: dictTitle
                });
            }
        }
    }
    
    return entries;
}

// Clean Kannada entry text - remove brackets, parentheses, numbers, and other non-text characters
function cleanKannadaEntry(text) {
    if (!text) return '';
    // Remove brackets: [], (), {}, 【】, 「」, etc.
    let cleaned = text.replace(/[\[\](){}【】「」〈〉《》『』〔〕［］（）｛｝]/g, '');
    // Remove other common punctuation that shouldn't be in dictionary keys
    cleaned = cleaned.replace(/[<>"']/g, '');
    // Remove numbers (data entry errors) - ASCII digits and digit sequences
    cleaned = cleaned.replace(/\d+/g, '');
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
        // On mobile, yield to main thread periodically to prevent blocking
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let text = '';
        let chunkCount = 0;
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            loaded += value.length;
            text += decoder.decode(value, { stream: true });
            chunkCount++;
            
            // On mobile, yield to main thread every 50 chunks to prevent blocking
            if (isMobile && chunkCount % 50 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            
            // Report progress if callback provided and we have valid total
            // Only report if loaded <= total (or within 5% tolerance for compression differences)
            if (onProgress && total && total > 0) {
                // Cap at 100% - if loaded exceeds total, it's likely due to compression differences
                const percent = loaded >= total ? 100 : Math.round((loaded / total) * 100);
                onProgress(loaded, total, percent);
            }
        }
        
        // Decode any remaining text
        text += decoder.decode();
        
        // Detect format: JSON or YAML
        // On mobile, parse large JSON files in idle time to prevent blocking
        let data;
        
        if (url.endsWith('.json')) {
            // On mobile, parse large JSON files (>1MB) in idle time to prevent blocking
            if (isMobile && text.length > 1000000 && 'requestIdleCallback' in window) {
                return new Promise((resolve, reject) => {
                    requestIdleCallback(() => {
                        try {
                            data = JSON.parse(text);
                            resolve(expandOptimizedEntries(data));
                        } catch (error) {
                            reject(error);
                        }
                    }, { timeout: 100 });
                });
            } else {
                data = JSON.parse(text);
            }
        } else {
            data = jsyaml.load(text);
        }
        
        // Check if it's optimized format (grouped by source) or regular format
        const entries = Array.isArray(data) ? data : expandOptimizedEntries(data);
        
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
    
    // Calculate percent, ensuring it never exceeds 100%
    // If loaded > total, it's likely due to compression differences, so cap at 100%
    let calculatedPercent;
    if (percent !== null) {
        calculatedPercent = Math.max(0, Math.min(100, Math.round(percent)));
    } else if (total > 0 && loaded > 0) {
        // Cap at 100% if loaded exceeds total (compression or header mismatch)
        calculatedPercent = loaded >= total ? 100 : Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
    } else {
        calculatedPercent = 0;
    }
    
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
        updateProgressIndicator(0, null, 0, 'Loading Alar Dictionary...');
        
        const primaryEntries = await fetchDictionaryFile(
            PRIMARY_DICTIONARY,
            (loaded, total, percent) => {
                // Percent is already capped at 100% in fetchDictionaryFile
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
        dictionaryReady = true; // Alar is ready for search - spinner can be removed now
        console.log(`✓ Loaded ${primaryEntries.length} entries from ${PRIMARY_DICTIONARY.name}`);
        
        // Load pre-built Alar reverse index instead of building it client-side
        console.log('Loading pre-built Alar reverse index...');
        try {
            await loadPreBuiltReverseIndex(ALAR_REVERSE_INDEX_FILES, ALAR_REVERSE_INDEX_METADATA, 'Alar');
            console.log(`✓ Alar reverse index loaded. Total words: ${reverseIndex.size}`);
        } catch (error) {
            console.warn('Failed to load pre-built Alar reverse index, building from entries:', error);
            // Fallback: build from entries if pre-built index fails
            buildReverseIndex();
            console.log(`✓ Alar reverse index built from entries. Total words: ${reverseIndex.size}`);
        }
        
        // Don't hide progress indicator yet - padakanaja is still loading
        // It will be hidden when padakanaja finishes or if padakanaja is disabled
        
        // Step 2: Load combined padakanaja dictionary in background
        // MOBILE: Skip padakanaja entirely (only Alar loads)
        // DESKTOP: Load padakanaja into memory
        const isMobileDeviceCheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobileDeviceCheck) {
            console.log('📱 Mobile device detected - skipping padakanaja (Alar only for better performance)');
            console.log('💡 Use server-side search for full dictionary access');
            return;
        }
        
        if (PADAKANAJA_COMBINED_FILES.length === 0) {
            console.log('Padakanaja dictionaries disabled');
            return;
        }
        
        console.log(`Loading additional dictionaries in background (non-blocking)...`);
        
        const loadPadakanajaAsync = () => {
            // Show progress immediately for padakanaja loading
            createProgressIndicator();
            updateProgressIndicator(0, PADAKANAJA_COMBINED_FILES.length, 0, 'Loading Additional Dictionaries...');
            
            // Load all chunks sequentially
            let allPadakanajaEntries = [];
            let loadedChunks = 0;
            
            const loadNextChunk = async (chunkIndex) => {
                if (chunkIndex >= PADAKANAJA_COMBINED_FILES.length) {
                    // All chunks loaded
                    if (allPadakanajaEntries.length > 0) {
                        // Flatten all chunks
                        let totalPadakanajaEntries = 0;
                        let allPadakanaja = [];
                        for (const chunk of allPadakanajaEntries) {
                            if (Array.isArray(chunk)) {
                                allPadakanaja = allPadakanaja.concat(chunk);
                                totalPadakanajaEntries += chunk.length;
                            }
                        }
                        
                        console.log(`✓ Loaded ${totalPadakanajaEntries} entries from ${PADAKANAJA_COMBINED_FILES.length} padakanaja chunks`);
                        
                        if (isMobileDevice) {
                            // MOBILE: Cache to IndexedDB only, don't load into memory
                            console.log('📱 Mobile device detected - caching padakanaja to IndexedDB (not loading into memory)');
                            padakanajaInMemory = false;
                            
                            // Cache padakanaja separately
                            try {
                                await setCachedPadakanaja(allPadakanaja);
                                console.log('✓ Padakanaja cached to IndexedDB - will search on-demand');
                            } catch (error) {
                                console.error('Failed to cache padakanaja:', error);
                            }
                        } else {
                            // DESKTOP: Load into memory for faster searches
                            console.log('💻 Desktop device - loading padakanaja into memory');
                            dictionary = dictionary.concat(allPadakanaja);
                            padakanajaInMemory = true;
                            
                            // Update cache asynchronously (non-blocking)
                            if ('requestIdleCallback' in window) {
                                requestIdleCallback(() => {
                                    updateCache();
                                }, { timeout: 5000 });
                            } else {
                                setTimeout(() => {
                                    updateCache();
                                }, 100);
                            }
                        }
                        
                        // Mark dictionary as ready
                        dictionaryReady = true;
                        
                        updateProgressIndicator(PADAKANAJA_COMBINED_FILES.length, PADAKANAJA_COMBINED_FILES.length, 100, 'All Dictionaries Loaded');
                        console.log(`✓ Total loaded: ${dictionary.length} entries in memory${isMobileDevice ? ' (padakanaja in IndexedDB)' : ''}`);
                        
                        // Hide progress indicator after a moment
                        setTimeout(() => {
                            const progressEl = document.getElementById('dict-progress');
                            if (progressEl) {
                                progressEl.style.opacity = '0';
                                setTimeout(() => {
                                    progressEl.style.display = 'none';
                                }, 300);
                            }
                        }, 500);
                    } else {
                        console.warn(`⚠ Failed to load padakanaja dictionary chunks`);
                        dictionaryReady = true; // Still mark as ready with just Alar
                        updateProgressIndicator(1, 1, 100, 'Alar Dictionary Ready');
                        
                        // Hide progress indicator
                        setTimeout(() => {
                            const progressEl = document.getElementById('dict-progress');
                            if (progressEl) {
                                progressEl.style.opacity = '0';
                                setTimeout(() => {
                                    progressEl.style.display = 'none';
                                }, 300);
                            }
                        }, 500);
                    }
                    return;
                }
                
                const chunkFile = PADAKANAJA_COMBINED_FILES[chunkIndex];
                const padakanajaSource = { url: chunkFile, type: 'local' };
                
                try {
                    // Fetch and expand entries (simple!)
                    const chunkEntries = await fetchDictionaryFile(
                        padakanajaSource,
                        (loaded, total, percent) => {
                            // Calculate overall progress across all chunks
                            const chunkProgress = (chunkIndex + (percent / 100)) / PADAKANAJA_COMBINED_FILES.length;
                            const overallPercent = Math.round(chunkProgress * 100);
                            updateProgressIndicator(
                                chunkIndex + (percent / 100),
                                PADAKANAJA_COMBINED_FILES.length,
                                overallPercent,
                                `Loading Additional Dictionaries... (${chunkIndex + 1}/${PADAKANAJA_COMBINED_FILES.length})`
                            );
                        }
                    );
                    
                    if (chunkEntries && Array.isArray(chunkEntries)) {
                        allPadakanajaEntries.push(chunkEntries);
                        loadedChunks++;
                        console.log(`✓ Loaded chunk ${chunkIndex + 1}/${PADAKANAJA_COMBINED_FILES.length}: ${chunkEntries.length} entries`);
                        
                        // Load next chunk
                        await loadNextChunk(chunkIndex + 1);
                    } else {
                        console.warn(`⚠ Failed to load chunk ${chunkIndex + 1}: ${chunkFile}`);
                        // Continue with next chunk even if this one failed
                        await loadNextChunk(chunkIndex + 1);
                    }
                } catch (error) {
                    console.error(`Error loading chunk ${chunkIndex + 1}:`, error);
                    // Continue with next chunk even if this one failed
                    await loadNextChunk(chunkIndex + 1);
                }
            };
            
            // Start loading chunks
            loadNextChunk(0).catch(error => {
                console.error('Error loading padakanaja dictionary chunks:', error);
                updateProgressIndicator(1, 1, 100, 'Alar Dictionary Ready');
                
                // Hide progress indicator
                setTimeout(() => {
                    const progressEl = document.getElementById('dict-progress');
                    if (progressEl) {
                        progressEl.style.opacity = '0';
                        setTimeout(() => {
                            progressEl.style.display = 'none';
                        }, 300);
                    }
                }, 500);
            });
        };
        
        // Use requestIdleCallback if available, otherwise setTimeout with delay
        // On mobile, use longer delays to prevent blocking
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const delay = isMobileDevice ? 3000 : 2000; // Longer delay on mobile
        
        if ('requestIdleCallback' in window) {
            requestIdleCallback(loadPadakanajaAsync, { timeout: delay });
        } else {
            // Fallback: delay longer on mobile
            setTimeout(loadPadakanajaAsync, isMobileDevice ? 1000 : 500);
        }
        
        // Search padakanaja entries from IndexedDB (memory-efficient for mobile)
        async function searchPadakanajaFromIndexedDB(searchWords, maxResults = 100) {
            try {
                const padakanajaData = await getCachedPadakanaja();
                if (!padakanajaData) return [];
                
                // Expand optimized format if needed
                const entries = expandOptimizedEntries(padakanajaData);
                if (!Array.isArray(entries)) return [];
                
                const results = [];
                const seen = new Set();
                
                for (const word of searchWords) {
                    const wordLower = word.toLowerCase();
                    let count = 0;
                    
                    for (let i = 0; i < entries.length && count < maxResults; i++) {
                        const entry = entries[i];
                        if (!entry.defs) continue;
                        
                        for (const def of entry.defs) {
                            if (!def.entry) continue;
                            const defLower = def.entry.toLowerCase();
                            
                            if (defLower.includes(wordLower)) {
                                const key = `${entry.entry}-${def.entry}`;
                                if (!seen.has(key)) {
                                    seen.add(key);
                                    results.push({
                                        kannada: cleanKannadaEntry(entry.entry),
                                        phone: entry.phone || '',
                                        definition: def.entry,
                                        type: normalizeType(def.type || ''),
                                        head: entry.head || '',
                                        id: entry.id || '',
                                        dict_title: entry.dict_title || '',
                                        source: entry.source || '',
                                        matchedWord: word,
                                        matchType: 'direct'
                                    });
                                    count++;
                                    if (count >= maxResults) break;
                                }
                            }
                        }
                        if (count >= maxResults) break;
                    }
                }
                
                return results;
            } catch (error) {
                console.error('Error searching padakanaja from IndexedDB:', error);
                return [];
            }
        }
        
        // Make searchPadakanajaFromIndexedDB available globally
        window.searchPadakanajaFromIndexedDB = searchPadakanajaFromIndexedDB;
        
        // Cache function (called separately)
        async function updateCache() {
        try {
            // On mobile, cache Alar and padakanaja separately
            // On desktop, cache everything together
            const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            
            if (isMobileDevice && !padakanajaInMemory) {
                // Mobile: cache Alar separately (padakanaja already cached separately)
                const alarEntries = dictionary.filter(entry => entry.source === 'alar');
                const dataSize = new Blob([JSON.stringify(alarEntries)]).size;
                const sizeMB = (dataSize / 1024 / 1024).toFixed(2);
                console.log(`Caching ${sizeMB} MB of Alar data in IndexedDB...`);
                
                await setCachedDictionary({ alar: alarEntries });
                await setCachedVersion(CACHE_VERSION);
                
                console.log(`✓ Alar cached successfully in IndexedDB (${sizeMB} MB)`);
            } else {
                // Desktop: cache everything together, or mobile fallback
            const dataSize = new Blob([JSON.stringify(dictionary)]).size;
            const sizeMB = (dataSize / 1024 / 1024).toFixed(2);
            console.log(`Caching ${sizeMB} MB of data in IndexedDB...`);
            
                if (isMobileDevice && padakanajaInMemory) {
                    // Mobile fallback: separate alar and padakanaja
                    const alarEntries = dictionary.filter(entry => entry.source === 'alar');
                    const padakanajaEntries = dictionary.filter(entry => entry.source !== 'alar');
                    await setCachedDictionary({ alar: alarEntries, padakanaja: padakanajaEntries });
                } else {
                    // Desktop: cache as array (old format for compatibility)
            await setCachedDictionary(dictionary);
                }
            await setCachedVersion(CACHE_VERSION);
            
            // Verify cache was saved
            const verifyCache = await getCachedDictionary();
                if (verifyCache) {
                    const verifyCount = Array.isArray(verifyCache) ? verifyCache.length : 
                                      (verifyCache.alar ? verifyCache.alar.length : 0);
                    if (verifyCount === dictionary.length || (isMobileDevice && verifyCount === dictionary.filter(e => e.source === 'alar').length)) {
                console.log(`✓ Dictionary cached successfully in IndexedDB (${sizeMB} MB)`);
                        console.log(`  Cache verification: ${verifyCount} entries stored`);
            } else {
                console.warn('⚠ Cache verification: entry count mismatch');
                    }
                }
            }
        } catch (error) {
            console.error('✗ Failed to cache dictionary in IndexedDB:', error);
            console.error('Dictionary will be fetched on each visit');
        }
        }
        
        // Cache Alar dictionary asynchronously (non-blocking) - will update with full dictionary later
        // Use requestIdleCallback to avoid blocking UI
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                updateCache();
            }, { timeout: 1000 });
        } else {
            setTimeout(() => {
                updateCache();
            }, 100);
        }
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

// Load pre-built reverse index from JSON chunks
async function loadPreBuiltReverseIndex(indexFiles, metadataFile, sourceName = '') {
    try {
        // Load metadata first
        const metadataResponse = await fetch(metadataFile);
        if (!metadataResponse.ok) {
            throw new Error(`Failed to load reverse index metadata: ${metadataResponse.status}`);
        }
        const metadata = await metadataResponse.json();
        
        const parts = metadata.totalParts || indexFiles.length;
        const words = metadata.totalWords || 0;
        console.log(`Loading ${sourceName} reverse index (${parts} parts, ${words.toLocaleString()} words)...`);
        
        // Load all chunks in parallel
        const chunkPromises = indexFiles.map(async (file, index) => {
            const response = await fetch(file);
            if (!response.ok) {
                throw new Error(`Failed to load reverse index chunk ${index + 1}: ${response.status}`);
            }
            const data = await response.json();
            return data.reverseIndex || {};
        });
        
        const chunks = await Promise.all(chunkPromises);
        
        // Merge all chunks into reverse index
        for (const chunk of chunks) {
            for (const [word, entries] of Object.entries(chunk)) {
                if (!reverseIndex.has(word)) {
                    reverseIndex.set(word, []);
                }
                // Use concat to avoid "too many arguments" error for words with many entries
                const existing = reverseIndex.get(word);
                reverseIndex.set(word, existing.concat(entries));
            }
        }
        
        // Update allEnglishWords from metadata
        if (metadata.allEnglishWords) {
            metadata.allEnglishWords.forEach(word => allEnglishWords.add(word));
        }
        
        console.log(`✓ Loaded reverse index: ${reverseIndex.size.toLocaleString()} words`);
    } catch (error) {
        console.error('Error loading pre-built reverse index:', error);
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

