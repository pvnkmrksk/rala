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

