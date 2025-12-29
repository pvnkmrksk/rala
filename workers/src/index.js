// Cloudflare Worker for Rala Dictionary Search
// Uses optimized English->Kannada reverse index with lazy chunk loading

// Cache for loaded chunks (keyed by chunk number)
const chunkCache = new Map();
let chunkIndex = null;
let chunkCount = 21;

// Clean Kannada entry (remove brackets, numbers, etc.)
function cleanKannadaEntry(text) {
    if (!text) return '';
    let cleaned = text.replace(/[\[\](){}【】「」〈〉《》『』〔〕［］（）｛｝]/g, '');
    cleaned = cleaned.replace(/[<>"']/g, '');
    cleaned = cleaned.replace(/\d+/g, ''); // Remove numbers
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

// Load chunk index (maps word prefixes to chunk numbers)
async function loadChunkIndex(env) {
    if (chunkIndex) {
        return chunkIndex;
    }
    
    try {
        chunkIndex = await env.DICTIONARY.get('chunk_index', 'json');
        if (!chunkIndex) {
            // Fallback: load all chunks (slower but works)
            chunkIndex = {};
        }
        return chunkIndex;
    } catch (error) {
        console.error('Failed to load chunk index:', error);
        return {};
    }
}

// Get chunk numbers that might contain a word
function getChunksForWord(word, chunkIndex) {
    const wordLower = word.toLowerCase();
    const chunks = new Set();
    
    // Try prefixes of length 1, 2, 3
    for (let len = 1; len <= 3 && len <= wordLower.length; len++) {
        const prefix = wordLower.substring(0, len);
        if (chunkIndex[prefix]) {
            for (const chunkNum of chunkIndex[prefix]) {
                chunks.add(chunkNum);
            }
        }
    }
    
    // If no chunks found, return all chunks (fallback)
    if (chunks.size === 0) {
        for (let i = 1; i <= chunkCount; i++) {
            chunks.add(i);
        }
    }
    
    return Array.from(chunks);
}

// Load specific chunk(s) from KV
async function loadChunks(chunkNumbers, env) {
    const chunksToLoad = chunkNumbers.filter(num => !chunkCache.has(num));
    
    if (chunksToLoad.length === 0) {
        return; // All chunks already cached
    }
    
    // Load chunks in parallel
    const promises = chunksToLoad.map(async (chunkNum) => {
        try {
            const chunk = await env.DICTIONARY.get(`english_reverse_index_part${chunkNum}`, 'json');
            if (chunk) {
                chunkCache.set(chunkNum, chunk);
            }
        } catch (error) {
            console.error(`Failed to load chunk ${chunkNum}:`, error);
        }
    });
    
    await Promise.all(promises);
}

// Get word from cached chunks
function getWordFromChunks(word) {
    const wordLower = word.toLowerCase();
    const results = [];
    
    for (const [chunkNum, chunk] of chunkCache.entries()) {
        if (chunk[wordLower]) {
            results.push(...chunk[wordLower]);
        }
    }
    
    return results;
}

// Search function using lazy-loaded chunks
async function searchDictionary(query, env) {
    const queryLower = query.toLowerCase().trim();
    const words = queryLower.split(/\s+/).filter(w => w.length > 0);
    const isMultiWord = words.length > 1;
    
    // Load chunk index
    const chunkIndex = await loadChunkIndex(env);
    
    // Determine which chunks to load
    const chunksToLoad = new Set();
    for (const word of words) {
        const chunks = getChunksForWord(word, chunkIndex);
        for (const chunkNum of chunks) {
            chunksToLoad.add(chunkNum);
        }
    }
    
    // Load required chunks
    await loadChunks(Array.from(chunksToLoad), env);
    
    const results = [];
    const seen = new Set();
    
    if (isMultiWord) {
        // Multi-word: search for exact phrase, then all words
        const exactPhrase = queryLower;
        const phraseResults = getWordFromChunks(exactPhrase);
        for (const entry of phraseResults) {
            const key = `${entry.kannada}-${entry.full_definition}`;
            if (!seen.has(key)) {
                seen.add(key);
                results.push({
                    kannada: cleanKannadaEntry(entry.kannada),
                    definition: entry.full_definition,
                    type: entry.type || 'Noun',
                    source: entry.source || '',
                    dict_title: '',
                    matchedWord: exactPhrase,
                    matchType: 'exact-phrase'
                });
            }
        }
        
        // All words present
        for (const word of words) {
            const wordResults = getWordFromChunks(word);
            for (const entry of wordResults) {
                const key = `${entry.kannada}-${entry.full_definition}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    results.push({
                        kannada: cleanKannadaEntry(entry.kannada),
                        definition: entry.full_definition,
                        type: entry.type || 'Noun',
                        source: entry.source || '',
                        dict_title: '',
                        matchedWord: word,
                        matchType: 'all-words'
                    });
                }
            }
        }
    } else {
        // Single word search
        const word = words[0];
        const wordResults = getWordFromChunks(word);
        
        for (const entry of wordResults) {
            const key = `${entry.kannada}-${entry.full_definition}`;
            if (!seen.has(key)) {
                seen.add(key);
                results.push({
                    kannada: cleanKannadaEntry(entry.kannada),
                    definition: entry.full_definition,
                    type: entry.type || 'Noun',
                    source: entry.source || '',
                    dict_title: '',
                    matchedWord: word,
                    matchType: 'direct'
                });
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
        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
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
            
            // Search using lazy-loaded chunks
            const results = await searchDictionary(query.trim(), env);
            
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
