// ============================================================================
// storage.js - IndexedDB storage operations and cache management
// ============================================================================
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

async function getCachedDictionary() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get('dictionary');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    } catch (error) {
        console.warn('IndexedDB not available:', error);
        return null;
    }
}

async function setCachedDictionary(data) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(data, 'dictionary');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    } catch (error) {
        console.error('Failed to save to IndexedDB:', error);
        throw error;
    }
}

// Store padakanaja separately (for mobile memory optimization)
async function setCachedPadakanaja(data) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(data, 'padakanaja');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    } catch (error) {
        console.error('Failed to save padakanaja to IndexedDB:', error);
        throw error;
    }
}

// Get padakanaja from IndexedDB (for mobile on-demand search)
async function getCachedPadakanaja() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get('padakanaja');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    } catch (error) {
        console.warn('IndexedDB not available for padakanaja:', error);
        return null;
    }
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

async function getCachedVersion() {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get('version');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    } catch (error) {
        return null;
    }
}

async function setCachedVersion(version) {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(version, 'version');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    } catch (error) {
        console.error('Failed to save version to IndexedDB:', error);
    }
}

// Check if URL has refresh parameter (for hard refresh bypass)
function shouldBypassCache() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('refresh') || urlParams.has('nocache');
}

// Function to manually clear cache (can be called from console: clearRalaCache())
async function clearRalaCache() {
    try {
        const db = await openDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        await Promise.all([
            new Promise((resolve, reject) => {
                const req = store.delete('dictionary');
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            }),
            new Promise((resolve, reject) => {
                const req = store.delete('version');
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            })
        ]);
        console.log('✓ Rala cache cleared from IndexedDB. Refresh the page to reload from network.');
    } catch (error) {
        console.error('Failed to clear cache:', error);
        // Fallback: try to delete the entire database
        try {
            const deleteReq = indexedDB.deleteDatabase(DB_NAME);
            deleteReq.onsuccess = () => {
                console.log('✓ Database deleted. Refresh the page to reload from network.');
            };
            deleteReq.onerror = () => {
                console.error('Failed to delete database:', deleteReq.error);
            };
        } catch (deleteError) {
            console.error('Failed to delete database:', deleteError);
        }
    }
}

// Function to check cache status (can be called from console: checkRalaCache())
async function checkRalaCache() {
    try {
        const cachedData = await getCachedDictionary();
        const version = await getCachedVersion();
        if (cachedData && Array.isArray(cachedData)) {
            const dataSize = new Blob([JSON.stringify(cachedData)]).size;
            const sizeMB = (dataSize / 1024 / 1024).toFixed(2);
            console.log(`Cache Status:
  Entries: ${cachedData.length.toLocaleString()}
  Size: ${sizeMB} MB
  Version: ${version || 'none'}
  Current Version: ${CACHE_VERSION}
  Status: ${version === CACHE_VERSION ? '✓ Valid' : '⚠ Outdated'}`);
        } else {
            console.log('No cache found in IndexedDB');
        }
    } catch (error) {
        console.error('Failed to check cache:', error);
    }
}

// Make cache functions available globally
window.clearRalaCache = clearRalaCache;
window.checkRalaCache = checkRalaCache;

