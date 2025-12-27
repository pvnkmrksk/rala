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

// Fetch dictionary from network and cache it in IndexedDB
async function fetchAndCacheDictionary() {
    try {
        console.log('Fetching dictionary from network...');
        const response = await fetch(YAML_URL);
        if (!response.ok) throw new Error('Failed to fetch dictionary');
        const text = await response.text();
        dictionary = jsyaml.load(text);
        console.log(`✓ Loaded ${dictionary.length} entries from network`);
        
        // Cache the parsed dictionary in IndexedDB
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
                    return;
                }
            } catch (cacheError) {
                console.error('✗ Failed to load from cache:', cacheError);
            }
        }
        throw error;
    }
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
                    type: def.type,
                    head: entry.head,
                    id: entryId
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

