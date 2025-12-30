// Cloudflare Worker for Rala Dictionary Search
// Simple approach: Two dictionary keys (Padakanaja + Alar), linear search with .includes()
// This was the original working approach - simple and fast!

// Cache dictionary in Worker memory (stays warm between requests)
// Only Padakanaja - Alar is loaded client-side for offline support
let dictionaryCache = null;
let cacheLoadPromise = null;

// Expand optimized Padakanaja format
function expandPadakanajaEntries(optimized) {
    if (Array.isArray(optimized)) {
        return optimized;
    }
    
    const entries = [];
    
    for (const [key, entriesList] of Object.entries(optimized)) {
        let source, dictTitle;
        if (key.includes('|')) {
            [source, dictTitle] = key.split('|', 2);
        } else {
            source = key;
            dictTitle = '';
        }
        
        if (Array.isArray(entriesList)) {
            for (const entryData of entriesList) {
                let kannada, english, type;
                if (entryData.length === 3) {
                    [kannada, english, type] = entryData;
                } else {
                    [kannada, english] = entryData;
                    type = 'Noun';
                }
                
                entries.push({
                    entry: kannada,
                    defs: [{
                        entry: english,
                        type: type || 'Noun'
                    }],
                    source: source,
                    dict_title: dictTitle
                });
            }
        }
    }
    
    return entries;
}

// Clean Kannada entry
function cleanKannadaEntry(text) {
    if (!text) return '';
    let cleaned = text.replace(/[\[\](){}【】「」〈〉《》『』〔〕［］（）｛｝]/g, '');
    cleaned = cleaned.replace(/[<>"']/g, '');
    cleaned = cleaned.replace(/\d+/g, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}

// Count words in Kannada text
function countWords(text) {
    if (!text) return 0;
    const cleaned = cleanKannadaEntry(text);
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    return words.length;
}

// Get definition priority for sorting
function getDefinitionPriority(definition, searchWord, kannadaEntry = '') {
    if (!definition) return 9;
    const trimmed = definition.trim();
    const trimmedLower = trimmed.toLowerCase();
    const searchLower = searchWord.toLowerCase();
    const escapedSearch = searchLower.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    
    const kannadaWordCount = countWords(kannadaEntry);
    const isKannadaShort = kannadaWordCount <= 2;
    
    // Priority 0/1: Exact full-word match
    const trimmedNoPeriod = trimmed.replace(/\.\s*$/, '').trim();
    if (trimmedNoPeriod.toLowerCase() === searchLower) {
        return isKannadaShort ? 0 : 1;
    }
    
    // Priority 2/3: Search term at the end
    const atEndPattern = new RegExp(`${escapedSearch}\\s*\\.\\s*$`, 'i');
    if (atEndPattern.test(trimmed)) {
        return isKannadaShort ? 2 : 3;
    }
    
    // Priority 4/5: Search term anywhere
    if (trimmedLower.includes(searchLower)) {
        return isKannadaShort ? 4 : 5;
    }
    
    return 9;
}

// Load dictionary from KV (with caching) - Padakanaja only
// Alar is loaded client-side for offline support
async function loadDictionary(env) {
    if (dictionaryCache) {
        return dictionaryCache;
    }
    
    if (cacheLoadPromise) {
        return cacheLoadPromise;
    }
    
    cacheLoadPromise = (async () => {
        try {
            // Load only Padakanaja (21MB - fast and works)
            const data = await env.DICTIONARY.get('combined_dictionaries_ultra', 'json');
            if (!data) {
                throw new Error('Dictionary not found in KV');
            }
            
            // Expand optimized format
            dictionaryCache = expandPadakanajaEntries(data);
            console.log(`Loaded ${dictionaryCache.length} Padakanaja entries from KV`);
            return dictionaryCache;
        } catch (error) {
            console.error('Failed to load dictionary:', error);
            throw error;
        }
    })();
    
    return cacheLoadPromise;
}

// Helper: Check if text contains word as a whole word (not substring)
// e.g., "test" matches "test" but NOT "detest" or "testing"
function containsWholeWord(text, word) {
    if (!text || !word) return false;
    // Escape special regex characters in word
    const escapedWord = word.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    // Use word boundary regex to match whole words only
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');
    return regex.test(text);
}

// Search with whole word matching only (no substring matching)
async function searchDictionary(query, dictionary) {
    const queryLower = query.toLowerCase().trim();
    const words = queryLower.split(/\s+/).filter(w => w.length > 0);
    const isMultiWord = words.length > 1;
    const maxResults = 2000;
    
    const results = [];
    const seen = new Set();
    
    if (isMultiWord) {
        // Multi-word: search for exact phrase first, then all words as whole words
        const exactPhrase = queryLower;
        
        for (const entry of dictionary) {
            if (results.length >= maxResults) break;
            if (!entry.defs) continue;
            for (const def of entry.defs) {
                if (results.length >= maxResults) break;
                if (!def.entry) continue;
                const defLower = def.entry.toLowerCase();
                
                // Exact phrase match (substring is OK for phrases)
                if (defLower.includes(exactPhrase)) {
                    const key = `${entry.entry}-${def.entry}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        results.push({
                            kannada: cleanKannadaEntry(entry.entry),
                            definition: def.entry,
                            type: def.type || 'Noun',
                            source: entry.source || '',
                            dict_title: entry.dict_title || '',
                            matchedWord: exactPhrase,
                            matchType: 'exact-phrase'
                        });
                    }
                } else {
                    // Then check if all words appear as whole words
                    const allWordsMatch = words.every(w => containsWholeWord(def.entry, w));
                    if (allWordsMatch) {
                        const key = `${entry.entry}-${def.entry}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            results.push({
                                kannada: cleanKannadaEntry(entry.entry),
                                definition: def.entry,
                                type: def.type || 'Noun',
                                source: entry.source || '',
                                dict_title: entry.dict_title || '',
                                matchedWord: exactPhrase,
                                matchType: 'all-words'
                            });
                        }
                    }
                }
            }
        }
    } else {
        // Single word: use whole word matching only (no substring matching)
        const word = words[0];
        for (const entry of dictionary) {
            if (results.length >= maxResults) break;
            if (!entry.defs) continue;
            for (const def of entry.defs) {
                if (results.length >= maxResults) break;
                if (!def.entry) continue;
                
                // Use whole word matching - "test" won't match "detest"
                if (containsWholeWord(def.entry, word)) {
                    const key = `${entry.entry}-${def.entry}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        results.push({
                            kannada: cleanKannadaEntry(entry.entry),
                            definition: def.entry,
                            type: def.type || 'Noun',
                            source: entry.source || '',
                            dict_title: entry.dict_title || '',
                            matchedWord: word,
                            matchType: 'direct'
                        });
                    }
                }
            }
        }
    }
    
    // Sort by priority
    results.sort((a, b) => {
        const aPriority = getDefinitionPriority(a.definition, a.matchedWord, a.kannada);
        const bPriority = getDefinitionPriority(b.definition, b.matchedWord, b.kannada);
        if (aPriority !== bPriority) {
            return aPriority - bPriority;
        }
        return cleanKannadaEntry(a.kannada).localeCompare(cleanKannadaEntry(b.kannada));
    });
    
    return results;
}

// Main request handler
export default {
    async fetch(request, env) {
        // CORS headers (allow all origins including localhost)
        const origin = request.headers.get('Origin');
        const corsHeaders = {
            'Access-Control-Allow-Origin': origin || '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
        };
        
        // Handle OPTIONS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }
        
        // Only allow GET and POST
        if (request.method !== 'GET' && request.method !== 'POST') {
            return new Response('Method not allowed', { 
                status: 405,
                headers: corsHeaders 
            });
        }
        
        try {
            // Get query from URL or body
            let query = '';
            if (request.method === 'GET') {
                const url = new URL(request.url);
                query = url.searchParams.get('q') || '';
            } else {
                const body = await request.json();
                query = body.query || '';
            }
            
            if (!query || query.trim().length === 0) {
                return new Response(JSON.stringify({ 
                    error: 'Query parameter "q" is required' 
                }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
            
            // Load dictionary (cached) - Padakanaja only
            // Alar is loaded client-side for offline support
            const dictionary = await loadDictionary(env);
            
            // Search with simple linear search (.includes() catches partial matches!)
            const results = await searchDictionary(query.trim(), dictionary);
            
            // Return results
            return new Response(JSON.stringify({
                query: query.trim(),
                results: results,
                count: results.length
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
            
        } catch (error) {
            console.error('Error:', error);
            return new Response(JSON.stringify({ 
                error: 'Internal server error',
                message: error.message 
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }
};
