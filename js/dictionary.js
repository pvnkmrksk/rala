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
async function fetchDictionaryFile(source) {
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
        const text = await response.text();
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
    total: PADAKANAJA_DICTIONARIES.length,
    isActive: false
};

// Update progress indicator UI
function updateProgressIndicator(loaded, total, currentFile = '') {
    const progressEl = document.getElementById('dict-progress');
    if (!progressEl) return;
    
    const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
    progressEl.querySelector('.progress-percent').textContent = `${percent}%`;
    progressEl.querySelector('.progress-bar-fill').style.width = `${percent}%`;
    
    if (loaded < total) {
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
        console.log('=== MULTI-DICTIONARY LOADER v1.2 ===');
        
        // Step 1: Load primary dictionary first
        console.log(`Loading primary dictionary: ${PRIMARY_DICTIONARY.name}`);
        const primaryEntries = await fetchDictionaryFile(PRIMARY_DICTIONARY);
        
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
        
        // Step 2: Load additional dictionaries in background (sequentially)
        if (PADAKANAJA_DICTIONARIES.length > 0) {
            console.log(`Loading ${PADAKANAJA_DICTIONARIES.length} additional dictionaries in background...`);
            
            // Create progress indicator
            createProgressIndicator();
            
            // Load sequentially
            for (let i = 0; i < PADAKANAJA_DICTIONARIES.length; i++) {
                const filePath = PADAKANAJA_DICTIONARIES[i];
                const source = { url: filePath, type: 'local' };
                
                updateProgressIndicator(i, PADAKANAJA_DICTIONARIES.length, filePath);
                
                const entries = await fetchDictionaryFile(source);
                if (entries && Array.isArray(entries)) {
                    // Preserve source info from YAML entries
                    dictionary.push(...entries);
                    console.log(`✓ Loaded ${entries.length} entries from ${filePath} (${i + 1}/${PADAKANAJA_DICTIONARIES.length})`);
                    
                    // Rebuild reverse index incrementally
                    addToReverseIndex(entries);
                } else {
                    console.warn(`⚠ Skipped ${filePath} (failed to load or empty)`);
                }
            }
            
            updateProgressIndicator(PADAKANAJA_DICTIONARIES.length, PADAKANAJA_DICTIONARIES.length);
            console.log(`✓ Total loaded: ${dictionary.length} entries from ${1 + PADAKANAJA_DICTIONARIES.length} sources`);
        }
        
        // Cache the complete dictionary in IndexedDB
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
                    kannada: entry.entry,
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
                    kannada: entry.entry,
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

