// Main App
const YAML_URL = 'https://raw.githubusercontent.com/alar-dict/data/master/alar.yml';
const DATAMUSE_API = 'https://api.datamuse.com/words';
const CACHE_KEY = 'rala_dictionary_cache';
const CACHE_VERSION_KEY = 'rala_cache_version';
const CACHE_VERSION = '1.0'; // Increment this to invalidate all caches
const DB_NAME = 'rala_dictionary_db';
const DB_VERSION = 1;
const STORE_NAME = 'dictionary';

let dictionary = [];
let reverseIndex = new Map();
let allEnglishWords = new Set();

// Cache for audio file existence checks
const audioExistenceCache = new Map(); // entryId -> boolean (true/false/null for unknown)

// DOM elements
const app = document.getElementById('app');

// Dark mode functionality
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

// Initialize
async function init() {
    try {
        // Initialize dark mode first
        initDarkMode();
        
        await loadDictionary();
        buildReverseIndex();
        
        // Check URL for initial query before rendering
        const urlQuery = getQueryFromURL();
        renderApp(urlQuery);
    } catch (error) {
        app.innerHTML = `
            <div class="status" style="color: #e74c3c;">
                <p>❌ Failed to load dictionary: ${error.message}</p>
                <p style="font-size: 14px;">Try refreshing the page or check your internet connection.</p>
            </div>
        `;
    }
}

// IndexedDB helper functions
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
        } catch (dbError) {
            console.error('Failed to delete database:', dbError);
        }
    }
}

// Function to check cache status (can be called from console: checkRalaCache())
async function checkRalaCache() {
    try {
        const cachedData = await getCachedDictionary();
        const version = await getCachedVersion();
        
        if (cachedData && Array.isArray(cachedData)) {
            const size = new Blob([JSON.stringify(cachedData)]).size;
            console.log('Cache Status (IndexedDB):');
            console.log(`  Version: ${version} (current: ${CACHE_VERSION})`);
            console.log(`  Entries: ${cachedData.length}`);
            console.log(`  Size: ${(size / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  Valid: ${cachedData.length > 0 ? 'Yes' : 'No'}`);
        } else {
            console.log('Cache Status: No cache found in IndexedDB');
        }
    } catch (error) {
        console.log('Cache Status: Error checking cache -', error.message);
    }
}

// Make cache functions available globally
window.clearRalaCache = clearRalaCache;
window.checkRalaCache = checkRalaCache;

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

async function getSynonyms(word) {
    try {
        // Get synonyms using Datamuse API
        const response = await fetch(`${DATAMUSE_API}?rel_syn=${encodeURIComponent(word)}&max=15`);
        const data = await response.json();
        return data.map(item => item.word);
    } catch {
        return [];
    }
}

async function getSimilarWords(word) {
    try {
        // Get words with similar meaning
        const response = await fetch(`${DATAMUSE_API}?ml=${encodeURIComponent(word)}&max=20`);
        const data = await response.json();
        return data.map(item => item.word);
    } catch {
        return [];
    }
}

function isExactDefinition(definition) {
    // Check if definition ends with "; a ..." or "; an ..." pattern
    // These are primary/exact definitions
    // Pattern examples: "; a printer." or "; an editor."
    if (!definition) return false;
    const trimmed = definition.trim();
    // Match "; a " or "; an " followed by any text ending with period
    // More permissive: check if it contains "; a " or "; an " in the last 100 chars
    const lastPart = trimmed.slice(-100);
    return /;\s*(a|an)\s+[^;]+\.\s*$/i.test(lastPart);
}

function getDefinitionPriority(definition, searchWord) {
    // Higher priority = comes first (lower number = higher priority)
    // Priority 1: Search term fully between ";" and "." at the end (e.g., "; a test." or "; north-east.")
    // Priority 2: Search term at the end (before the final period)
    // Priority 3: Other definitions
    
    if (!definition) return 3;
    const trimmed = definition.trim();
    const trimmedLower = trimmed.toLowerCase();
    const searchLower = searchWord.toLowerCase();
    
    // Escape special regex characters in search word
    const escapedSearch = searchLower.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    
    // Priority 1: Check if search term is fully between ";" and "." at the end
    // Pattern: "; ... searchWord." - the search term must be between a semicolon and the final period
    // We want to match: "; [anything] searchWord." where there's a semicolon before and period after
    const betweenSemicolonAndPeriod = new RegExp(`;\\s+[^;]*?${escapedSearch}\\s*\\.\\s*$`, 'i');
    if (betweenSemicolonAndPeriod.test(trimmed)) {
        return 1; // Highest priority
    }
    
    // Priority 2: Check if search term is at the end (before final period, but not necessarily after semicolon)
    // Pattern: "... searchWord." or "... searchWord ."
    const atEndPattern = new RegExp(`${escapedSearch}\\s*\\.\\s*$`, 'i');
    if (atEndPattern.test(trimmed)) {
        return 2; // Second priority
    }
    
    return 3; // Lowest priority
}

// Convert wildcard pattern (*) to regex pattern
// * matches a single character (letter, space, or hyphen)
function wildcardToRegex(pattern) {
    // Escape all regex special chars except *
    let regexPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    // Replace * with [a-zA-Z\s-] (single letter, space, or hyphen)
    regexPattern = regexPattern.replace(/\*/g, '[a-zA-Z\\s-]');
    return new RegExp(regexPattern, 'i');
}

// Check if a word matches a pattern (handles wildcards)
function wordMatches(word, pattern) {
    if (pattern.includes('*')) {
        const regex = wildcardToRegex(pattern);
        return regex.test(word);
    }
    return word.toLowerCase() === pattern.toLowerCase();
}

// Check if text contains a pattern (handles wildcards)
function textContains(text, pattern) {
    if (pattern.includes('*')) {
        const regex = wildcardToRegex(pattern);
        return regex.test(text);
    }
    return text.toLowerCase().includes(pattern.toLowerCase());
}

function searchDirect(query) {
    const hasWildcard = query.includes('*');
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const queryLower = query.toLowerCase().trim();
    const isMultiWord = words.length > 1;
    
    const exactPhraseResults = [];
    const allWordsResults = [];
    const anyWordResults = [];
    const seen = new Set();
    
    // If wildcards are present, we need to search all definitions directly
    if (hasWildcard) {
        const results = [];
        for (let i = 0; i < dictionary.length; i++) {
            const entry = dictionary[i];
            if (!entry.defs) continue;
            
            for (const def of entry.defs) {
                if (!def.entry) continue;
                const defLower = def.entry.toLowerCase();
                
                // Check if definition matches the query pattern
                if (textContains(defLower, queryLower)) {
                    const key = `${entry.entry}-${def.entry}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        results.push({
                            kannada: entry.entry,
                            phone: entry.phone,
                            definition: def.entry,
                            type: def.type,
                            head: entry.head,
                            id: entry.id,
                            matchedWord: queryLower,
                            matchType: 'wildcard'
                        });
                    }
                }
            }
        }
        
        // Sort by priority
        results.sort((a, b) => {
            const aPriority = getDefinitionPriority(a.definition, a.matchedWord);
            const bPriority = getDefinitionPriority(b.definition, b.matchedWord);
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            return a.kannada.localeCompare(b.kannada);
        });
        
        return results;
    }
    
    if (isMultiWord) {
        // Step 1: Find exact phrase matches (entire query in exact order)
        const exactPhrase = queryLower;
        if (reverseIndex.has(words[0])) {
            for (const entry of reverseIndex.get(words[0])) {
                const defLower = entry.definition.toLowerCase();
                if (defLower.includes(exactPhrase)) {
                    const key = `${entry.kannada}-${entry.definition}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        exactPhraseResults.push({ 
                            ...entry, 
                            matchedWord: exactPhrase, 
                            matchType: 'exact-phrase' 
                        });
                    }
                }
            }
        }
        // Also check entries for other words (in case first word doesn't appear)
        for (let i = 1; i < words.length; i++) {
            if (reverseIndex.has(words[i])) {
                for (const entry of reverseIndex.get(words[i])) {
                    const defLower = entry.definition.toLowerCase();
                    if (defLower.includes(exactPhrase)) {
                        const key = `${entry.kannada}-${entry.definition}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            exactPhraseResults.push({ 
                                ...entry, 
                                matchedWord: exactPhrase, 
                                matchType: 'exact-phrase' 
                            });
                        }
                    }
                }
            }
        }
        
        // Step 2: Find definitions containing all words (in any order)
        const candidateEntries = new Map();
        if (reverseIndex.has(words[0])) {
            for (const entry of reverseIndex.get(words[0])) {
                const key = `${entry.kannada}-${entry.definition}`;
                if (!seen.has(key)) {
                    candidateEntries.set(key, entry);
                }
            }
        }
        
        // Filter to only those that contain all words
        for (const [key, entry] of candidateEntries.entries()) {
            const defLower = entry.definition.toLowerCase();
            const containsAllWords = words.every(word => defLower.includes(word));
            if (containsAllWords) {
                seen.add(key);
                allWordsResults.push({ 
                    ...entry, 
                    matchedWord: words.join(' '), 
                    matchType: 'all-words' 
                });
            }
        }
        
        // Step 3: Find definitions containing any of the words
        for (const word of words) {
            if (reverseIndex.has(word)) {
                for (const entry of reverseIndex.get(word)) {
                    const key = `${entry.kannada}-${entry.definition}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        anyWordResults.push({ 
                            ...entry, 
                            matchedWord: word, 
                            matchType: 'any-word' 
                        });
                    }
                }
            }
        }
        
        // Sort each section by priority, then alphabetically
        exactPhraseResults.sort((a, b) => {
            const aPriority = getDefinitionPriority(a.definition, a.matchedWord);
            const bPriority = getDefinitionPriority(b.definition, b.matchedWord);
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            return a.kannada.localeCompare(b.kannada);
        });
        
        allWordsResults.sort((a, b) => {
            const aPriority = getDefinitionPriority(a.definition, a.matchedWord);
            const bPriority = getDefinitionPriority(b.definition, b.matchedWord);
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            return a.kannada.localeCompare(b.kannada);
        });
        
        anyWordResults.sort((a, b) => {
            const aPriority = getDefinitionPriority(a.definition, a.matchedWord);
            const bPriority = getDefinitionPriority(b.definition, b.matchedWord);
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            return a.kannada.localeCompare(b.kannada);
        });
        
        // Combine results in priority order
        return [...exactPhraseResults, ...allWordsResults, ...anyWordResults];
    } else {
        // Single word: use original logic
        const word = words[0];
        if (reverseIndex.has(word)) {
            for (const entry of reverseIndex.get(word)) {
                const key = `${entry.kannada}-${entry.definition}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    anyWordResults.push({ 
                        ...entry, 
                        matchedWord: word, 
                        matchType: 'direct' 
                    });
                }
            }
        }
        
        // Sort results: prioritize by position in definition
        anyWordResults.sort((a, b) => {
            // Get priority for each result (using the matched word as search term)
            const aPriority = getDefinitionPriority(a.definition, a.matchedWord);
            const bPriority = getDefinitionPriority(b.definition, b.matchedWord);
            
            // Lower priority number = higher priority (comes first)
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            
            // If same priority, sort alphabetically by Kannada word
            return a.kannada.localeCompare(b.kannada);
        });
        
        return anyWordResults;
    }
}

async function searchWithSynonyms(query) {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const isMultiWord = words.length > 1;
    
    // For multi-word queries, first try to get synonyms for the whole phrase
    if (isMultiWord) {
        const queryLower = query.toLowerCase().trim();
        const [synonyms, similar] = await Promise.all([
            getSynonyms(queryLower),
            getSimilarWords(queryLower)
        ]);
        
        const relatedWords = [...new Set([...synonyms, ...similar])];
        
        // If synonyms exist for the whole phrase, use them and return early
        if (relatedWords.length > 0) {
            const results = [];
            const seen = new Set();
            const synonymsUsed = {};
            
            for (const relWord of relatedWords) {
                if (reverseIndex.has(relWord)) {
                    for (const entry of reverseIndex.get(relWord)) {
                        const key = `${entry.kannada}-${entry.definition}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            if (!synonymsUsed[queryLower]) synonymsUsed[queryLower] = [];
                            if (!synonymsUsed[queryLower].includes(relWord)) {
                                synonymsUsed[queryLower].push(relWord);
                            }
                            results.push({ 
                                ...entry, 
                                matchedWord: relWord, 
                                originalQuery: queryLower,
                                matchType: 'synonym' 
                            });
                        }
                    }
                }
            }
            
            // Sort alphabetically by Kannada word
            results.sort((a, b) => a.kannada.localeCompare(b.kannada));
            return { results, synonymsUsed };
        }
        // If no synonyms for whole phrase, skip synonym search for multi-word
        return { results: [], synonymsUsed: {} };
    }
    
    // Original logic for single word (as usual)
    const results = [];
    const seen = new Set();
    const synonymsUsed = {};
    
    for (const word of words) {
        // Get synonyms and similar words
        const [synonyms, similar] = await Promise.all([
            getSynonyms(word),
            getSimilarWords(word)
        ]);
        
        const relatedWords = [...new Set([...synonyms, ...similar])];
        
        for (const relWord of relatedWords) {
            if (reverseIndex.has(relWord)) {
                for (const entry of reverseIndex.get(relWord)) {
                    const key = `${entry.kannada}-${entry.definition}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        if (!synonymsUsed[word]) synonymsUsed[word] = [];
                        if (!synonymsUsed[word].includes(relWord)) {
                            synonymsUsed[word].push(relWord);
                        }
                        results.push({ 
                            ...entry, 
                            matchedWord: relWord, 
                            originalQuery: word,
                            matchType: 'synonym' 
                        });
                    }
                }
            }
        }
    }
    
    // Sort results: prioritize exact definitions, especially those matching the search term
    const exactCount = results.filter(r => isExactDefinition(r.definition)).length;
    console.log(`Synonym search - Total: ${results.length}, Exact definitions: ${exactCount}`);
    
    results.sort((a, b) => {
        // Get priority for each result (using the matched word as search term)
        const aPriority = getDefinitionPriority(a.definition, a.matchedWord);
        const bPriority = getDefinitionPriority(b.definition, b.matchedWord);
        
        // Lower priority number = higher priority (comes first)
        if (aPriority !== bPriority) {
            return aPriority - bPriority;
        }
        
        // If same priority, sort alphabetically by Kannada word
        return a.kannada.localeCompare(b.kannada);
    });
    
    return { results, synonymsUsed };
}

function highlightMatch(text, matchedWord, matchType = null) {
    // Check if matchedWord contains wildcards
    const hasWildcard = matchedWord.includes('*');
    
    // Handle different match types
    if (matchType === 'exact-phrase' && matchedWord.includes(' ')) {
        // Exact phrase match: highlight the entire phrase
        if (hasWildcard) {
            // For wildcards, use the wildcard regex pattern
            const regex = wildcardToRegex(matchedWord);
            return text.replace(regex, (match) => {
                // Check if already highlighted
                if (match.includes('<span')) return match;
                return `<span class="matched-word">${match}</span>`;
            });
        } else {
            const escaped = matchedWord.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escaped})`, 'gi');
            return text.replace(regex, '<span class="matched-word">$1</span>');
        }
    } else if (matchType === 'all-words' && matchedWord.includes(' ')) {
        // All words present but not in order: highlight each word individually
        const words = matchedWord.split(/\s+/).filter(w => w.length > 0);
        let highlighted = text;
        
        // Process each word separately
        for (const word of words) {
            let regex;
            if (word.includes('*')) {
                // Use wildcard regex
                regex = wildcardToRegex(word);
            } else {
                // Use word boundary regex
                const escaped = word.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
                regex = new RegExp(`\\b(${escaped})\\b`, 'gi');
            }
            
            let match;
            const matches = [];
            
            // Find all matches
            while ((match = regex.exec(highlighted)) !== null) {
                // Check if this match is inside an HTML tag
                const beforeMatch = highlighted.substring(0, match.index);
                const lastOpenTag = beforeMatch.lastIndexOf('<');
                const lastCloseTag = beforeMatch.lastIndexOf('>');
                
                // If there's an open tag before this match and no closing tag after it, skip
                if (lastOpenTag > lastCloseTag) {
                    continue;
                }
                
                matches.push({
                    index: match.index,
                    length: match[0].length,
                    text: match[0]
                });
            }
            
            // Replace matches in reverse order to preserve indices
            for (let i = matches.length - 1; i >= 0; i--) {
                const m = matches[i];
                highlighted = highlighted.substring(0, m.index) + 
                              `<span class="matched-word">${m.text}</span>` + 
                              highlighted.substring(m.index + m.length);
            }
        }
        
        return highlighted;
    } else {
        // Single word or any-word match: highlight word boundaries or wildcard pattern
        if (hasWildcard) {
            // For wildcards, use the wildcard regex pattern
            const regex = wildcardToRegex(matchedWord);
            return text.replace(regex, (match) => {
                // Check if already highlighted
                if (match.includes('<span')) return match;
                return `<span class="matched-word">${match}</span>`;
            });
        } else {
            const escaped = matchedWord.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b(${escaped})\\b`, 'gi');
            return text.replace(regex, '<span class="matched-word">$1</span>');
        }
    }
}

function renderResults(directResults, synonymResults, synonymsUsed, query, loadingDirect = false, loadingIndirect = false) {
    let html = '';
    
    if (directResults.length === 0 && synonymResults.length === 0 && !loadingDirect && !loadingIndirect) {
        return `
            <div class="no-results">
                <p>No results found for "${query}"</p>
                <p style="font-size: 14px; margin-top: 8px;">Try a different word or check spelling</p>
            </div>
        `;
    }
    
    // Check if multi-word query and split results by match type
    const isMultiWord = query.trim().split(/\s+/).length > 1;
    let exactPhraseResults = [];
    let allWordsResults = [];
    let anyWordResults = [];
    
    if (isMultiWord && directResults.length > 0) {
        exactPhraseResults = directResults.filter(r => r.matchType === 'exact-phrase');
        allWordsResults = directResults.filter(r => r.matchType === 'all-words');
        anyWordResults = directResults.filter(r => r.matchType === 'any-word');
    } else {
        anyWordResults = directResults;
    }
    
    // Exact matches section
    html += `
        <div class="results-section section-anchor" id="exact-matches">
            <div class="section-header">Exact Match${directResults.length !== 1 ? 'es' : ''} (${directResults.length})</div>
    `;
    
    if (loadingDirect) {
        html += `
            <div class="loading">
                <div class="spinner"></div>
                <p>Searching...</p>
            </div>
        `;
    } else if (directResults.length > 0) {
        // For multi-word, show sections with separators
        if (isMultiWord && exactPhraseResults.length > 0) {
            html += `<div class="result-subsection"><div class="subsection-label">Exact phrase matches (${exactPhraseResults.length})</div>`;
            html += exactPhraseResults.map(r => renderResultCard(r, query)).join('');
            html += `</div>`;
        }
        
        if (isMultiWord && allWordsResults.length > 0) {
            html += `<div class="result-subsection"><div class="subsection-label">All words present (${allWordsResults.length})</div>`;
            html += allWordsResults.map(r => renderResultCard(r, query)).join('');
            html += `</div>`;
        }
        
        if (isMultiWord && anyWordResults.length > 0) {
            html += `<div class="result-subsection"><div class="subsection-label">Any word present (${anyWordResults.length})</div>`;
            html += anyWordResults.map(r => renderResultCard(r, query)).join('');
            html += `</div>`;
        }
        
        if (!isMultiWord) {
            html += anyWordResults.map(r => renderResultCard(r, query)).join('');
        }
        
        // Check audio files and update buttons after rendering
        setTimeout(() => checkAndUpdateAudioButtons(directResults), 100);
    } else {
        html += `
            <div class="no-results">
                <p>No exact matches found</p>
            </div>
        `;
    }
    
    html += `</div>`;
    
    // Synonym matches section
    html += `
        <div class="results-section section-anchor" id="synonym-matches">
            <div class="section-header">Synonym Match${synonymResults.length !== 1 ? 'es' : ''} (${synonymResults.length})</div>
    `;
    
    if (loadingIndirect) {
        html += `
            <div class="loading">
                <div class="spinner"></div>
                <p>Searching...</p>
            </div>
        `;
    } else if (synonymResults.length > 0) {
        const usedSynonyms = Object.entries(synonymsUsed)
            .map(([orig, syns]) => `"${orig}" → ${syns.slice(0, 5).join(', ')}`)
            .join('; ');
            
        html += `
            <div class="search-info">
                Found via: ${usedSynonyms}
            </div>
        `;
        html += synonymResults.map(r => renderResultCard(r, query, true)).join('');
        // Check audio files and update buttons after rendering
        setTimeout(() => checkAndUpdateAudioButtons(synonymResults), 100);
    } else if (!loadingDirect) {
        html += `
            <div class="no-results">
                <p>No synonym matches found</p>
            </div>
        `;
    }
    
    html += `</div>`;
    
    return html;
}

function getAudioUrl(entryId) {
    if (!entryId) return null;
    // Audio files are organized by ID ranges: 1-9999, 10000-19999, etc.
    // Range calculation: for ID 1-9999 use "1-9999", for 10000-19999 use "10000-19999", etc.
    // For IDs 1-9999: rangeStart = 1, rangeEnd = 9999
    // For IDs 10000-19999: rangeStart = 10000, rangeEnd = 19999
    // For IDs 20000-29999: rangeStart = 20000, rangeEnd = 29999, etc.
    let rangeStart, rangeEnd;
    if (entryId <= 9999) {
        rangeStart = 1;
        rangeEnd = 9999;
    } else {
        rangeStart = Math.floor(entryId / 10000) * 10000;
        rangeEnd = rangeStart + 9999;
    }
    const range = `${rangeStart}-${rangeEnd}`;
    // Using raw.githubusercontent.com to serve the audio files
    return `https://raw.githubusercontent.com/Aditya-ds-1806/Alar-voice-corpus/main/audio/${range}/${entryId}.mp3`;
}

async function checkAudioExists(entryId) {
    if (!entryId) return false;
    
    // Check cache first
    if (audioExistenceCache.has(entryId)) {
        return audioExistenceCache.get(entryId);
    }
    
    const audioUrl = getAudioUrl(entryId);
    if (!audioUrl) {
        audioExistenceCache.set(entryId, false);
        return false;
    }
    
    try {
        // Use HEAD request to check if file exists without downloading it
        const response = await fetch(audioUrl, { method: 'HEAD', cache: 'no-cache' });
        const exists = response.ok && response.status === 200;
        audioExistenceCache.set(entryId, exists);
        
        if (!exists) {
            console.log(`Audio file not found for entry ID ${entryId}: ${audioUrl}`);
        }
        
        return exists;
    } catch (error) {
        // If there's an error (network, CORS, etc.), assume it doesn't exist
        audioExistenceCache.set(entryId, false);
        console.log(`Error checking audio for entry ID ${entryId}:`, error);
        return false;
    }
}

async function checkAndUpdateAudioButtons(results) {
    // Collect all unique entry IDs from results that we haven't checked yet
    const entryIds = [...new Set(results.map(r => r.id).filter(id => id && !audioExistenceCache.has(id)))];
    
    if (entryIds.length === 0) return; // All already checked
    
    // Check all audio files in parallel (limit to avoid too many requests)
    const checkPromises = entryIds.slice(0, 50).map(async (entryId) => {
        const exists = await checkAudioExists(entryId);
        return { entryId, exists };
    });
    
    const results_checks = await Promise.all(checkPromises);
    
    // Update buttons based on existence
    results_checks.forEach(({ entryId, exists }) => {
        // Find all buttons for this entry ID
        const buttons = document.querySelectorAll(`[data-entry-id="${entryId}"]`);
        if (buttons.length === 0 && exists) {
            // Button wasn't shown but file exists - we need to add it
            // This shouldn't happen with current logic, but handle it just in case
            return;
        }
        buttons.forEach(button => {
            if (exists) {
                button.style.display = '';
            } else {
                // Remove the button if it doesn't exist
                button.remove();
            }
        });
    });
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

// Make copyKannadaWord available globally
window.copyKannadaWord = copyKannadaWord;

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

function renderApp(initialQuery = '') {
    app.innerHTML = `
        <div class="tabs-wrapper" id="tabs-wrapper" style="display: none;">
            <div class="tabs">
                <button class="tab active" id="tab-exact">
                    <span>Exact Match</span>
                    <span id="tab-exact-count"></span>
                    <span id="tab-exact-spinner" class="tab-spinner" style="display: none;"></span>
                </button>
                <button class="tab" id="tab-synonym">
                    <span>Synonym Match</span>
                    <span id="tab-synonym-count"></span>
                    <span id="tab-synonym-spinner" class="tab-spinner" style="display: none;"></span>
                </button>
            </div>
        </div>
        <div id="results" class="results-container"></div>
        <div class="stats">
            ${dictionary.length.toLocaleString()} Kannada entries | 
            ${reverseIndex.size.toLocaleString()} unique English words indexed
        </div>
    `;
    
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const resultsDiv = document.getElementById('results');
    const tabsWrapper = document.getElementById('tabs-wrapper');
    const tabExact = document.getElementById('tab-exact');
    const tabSynonym = document.getElementById('tab-synonym');
    const tabExactCount = document.getElementById('tab-exact-count');
    const tabSynonymCount = document.getElementById('tab-synonym-count');
    const tabExactSpinner = document.getElementById('tab-exact-spinner');
    const tabSynonymSpinner = document.getElementById('tab-synonym-spinner');
    
    let directResults = [];
    let synonymResults = [];
    let synonymsUsed = {};
    let currentQuery = '';
    let debounceTimer = null;
    let synonymSearchInProgress = false;
    let synonymSearchCompleted = false;
    let synonymSearchTimeout = null;
    
    function switchTab(tabName) {
        if (tabName === 'exact') {
            tabExact.classList.add('active');
            tabSynonym.classList.remove('active');
            const exactSection = document.getElementById('exact-matches');
            if (exactSection) {
                setTimeout(() => {
                    const searchHeight = document.querySelector('.sticky-search').offsetHeight;
                    const tabsHeight = document.querySelector('.tabs-wrapper').offsetHeight;
                    const offset = searchHeight + tabsHeight;
                    const elementPosition = exactSection.getBoundingClientRect().top + window.pageYOffset;
                    window.scrollTo({ 
                        top: elementPosition - offset, 
                        behavior: 'smooth' 
                    });
                }, 100);
            }
        } else {
            tabSynonym.classList.add('active');
            tabExact.classList.remove('active');
            const synonymSection = document.getElementById('synonym-matches');
            if (synonymSection) {
                setTimeout(() => {
                    const searchHeight = document.querySelector('.sticky-search').offsetHeight;
                    const tabsHeight = document.querySelector('.tabs-wrapper').offsetHeight;
                    const offset = searchHeight + tabsHeight;
                    const elementPosition = synonymSection.getBoundingClientRect().top + window.pageYOffset;
                    window.scrollTo({ 
                        top: elementPosition - offset, 
                        behavior: 'smooth' 
                    });
                }, 100);
            }
        }
    }
    
    tabExact.addEventListener('click', () => switchTab('exact'));
    tabSynonym.addEventListener('click', () => switchTab('synonym'));
    searchButton.addEventListener('click', () => {
        if (searchInput.value.trim()) {
            performSearch(searchInput.value.trim(), true);
        }
    });
    
    async function loadSynonyms(query) {
        if (synonymSearchInProgress || synonymSearchCompleted) {
            return;
        }
        
        synonymSearchInProgress = true;
        tabSynonymSpinner.style.display = 'inline-block';
        
        const { results: synonymResultsTemp, synonymsUsed: synonymsUsedTemp } = await searchWithSynonyms(query);
        
        // Filter out synonym results that are already in direct results
        const directKeys = new Set(directResults.map(r => `${r.kannada}-${r.definition}`));
        synonymResults = synonymResultsTemp.filter(r => 
            !directKeys.has(`${r.kannada}-${r.definition}`)
        );
        synonymsUsed = synonymsUsedTemp;
        
        tabSynonymCount.textContent = ` (${synonymResults.length})`;
        tabSynonymSpinner.style.display = 'none';
        synonymSearchCompleted = true;
        
        // Update UI with both results
        resultsDiv.innerHTML = renderResults(directResults, synonymResults, synonymsUsed, query, false, false);
    }
    
    async function performSearch(query, fromEnter = false, skipURLUpdate = false) {
        if (!query.trim()) {
            resultsDiv.innerHTML = '';
            tabsWrapper.style.display = 'none';
            directResults = [];
            synonymResults = [];
            synonymsUsed = {};
            currentQuery = '';
            synonymSearchInProgress = false;
            synonymSearchCompleted = false;
            if (synonymSearchTimeout) {
                clearTimeout(synonymSearchTimeout);
                synonymSearchTimeout = null;
            }
            if (!skipURLUpdate) {
                updateURL('', true);
            }
            return;
        }
        
        currentQuery = query;
        
        // Update URL (use replace for debounced searches, push for explicit searches)
        if (!skipURLUpdate) {
            updateURL(query, !fromEnter);
        }
        directResults = [];
        synonymResults = [];
        synonymsUsed = {};
        synonymSearchInProgress = false;
        synonymSearchCompleted = false;
        
        // Clear any pending synonym search
        if (synonymSearchTimeout) {
            clearTimeout(synonymSearchTimeout);
            synonymSearchTimeout = null;
        }
        
        // Show tabs
        tabsWrapper.style.display = 'block';
        
        // Reset tab states
        tabExactCount.textContent = '';
        tabSynonymCount.textContent = '';
        tabExactSpinner.style.display = 'inline-block';
        tabSynonymSpinner.style.display = 'none';
        
        // Show loading state for direct matches
        resultsDiv.innerHTML = renderResults([], [], {}, query, true, false);
        switchTab('exact');
        
        // Step 1: Search direct matches
        directResults = searchDirect(query);
        tabExactCount.textContent = ` (${directResults.length})`;
        tabExactSpinner.style.display = 'none';
        
        // Update UI with direct results
        resultsDiv.innerHTML = renderResults(directResults, [], {}, query, false, false);
        
        // Step 2: Load synonyms with delay (500ms) or immediately if Enter was pressed
        if (fromEnter) {
            // Load immediately if Enter was pressed
            await loadSynonyms(query);
        } else {
            // Wait 500ms before loading synonyms
            synonymSearchTimeout = setTimeout(() => {
                loadSynonyms(query);
            }, 500);
        }
        
        // Hide tabs if no results at all
        if (directResults.length === 0 && synonymResults.length === 0) {
            tabsWrapper.style.display = 'none';
        } else {
            // Default to exact tab
            switchTab('exact');
        }
    }
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            performSearch(e.target.value, false);
        }, 300);
    });
    
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(debounceTimer);
            const query = e.target.value.trim();
            
            // If query changed, perform new search
            if (query !== currentQuery) {
                performSearch(query, true);
            } else if (!synonymSearchCompleted && !synonymSearchInProgress && currentQuery) {
                // If synonyms haven't loaded yet, load them now
                if (synonymSearchTimeout) {
                    clearTimeout(synonymSearchTimeout);
                    synonymSearchTimeout = null;
                }
                loadSynonyms(currentQuery);
            }
        }
    });
    
    // Handle browser back/forward buttons
    window.addEventListener('popstate', (e) => {
        const urlQuery = getQueryFromURL();
        if (urlQuery !== currentQuery) {
            searchInput.value = urlQuery;
            if (urlQuery) {
                performSearch(urlQuery, false, true); // skipURLUpdate = true since URL is already updated
            } else {
                performSearch('', false, true);
            }
        }
    });
    
    // Handle initial query from URL
    if (initialQuery) {
        searchInput.value = initialQuery;
        // Trigger search after a short delay to ensure everything is ready
        setTimeout(() => {
            performSearch(initialQuery, false, true); // skipURLUpdate = true since URL already has it
        }, 100);
    }
}

// Service Worker Registration for PWA
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
const installPrompt = document.getElementById('install-prompt');
const installClose = document.getElementById('install-close');

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    // Show the install prompt
    installPrompt.classList.add('show');
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
    
    // Hide the install prompt
    installPrompt.classList.remove('show');
});

installClose.addEventListener('click', (e) => {
    e.stopPropagation();
    installPrompt.classList.remove('show');
});

// Hide prompt if app is already installed
window.addEventListener('appinstalled', () => {
    console.log('PWA installed successfully');
    installPrompt.classList.remove('show');
    deferredPrompt = null;
});

// Check if app is already installed (standalone mode)
if (window.matchMedia('(display-mode: standalone)').matches || 
    window.navigator.standalone === true) {
    console.log('Running as installed PWA');
    installPrompt.classList.remove('show');
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

// Start the app
init();
