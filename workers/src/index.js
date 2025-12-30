// Cloudflare Worker for Rala Dictionary Search - REVERSE INDEX VERSION
// This is a test version using reverse index for O(1) lookups
// Use index.js for production (linear search)

// Cache reverse index chunks in Worker memory
let chunkCache = new Map(); // chunkNumber -> chunk data
let chunkIndex = null;
let chunkIndexPromise = null;

// Load chunk index (small file mapping prefixes to chunks)
async function loadChunkIndex(env) {
    if (chunkIndex) {
        return chunkIndex;
    }
    
    if (chunkIndexPromise) {
        return chunkIndexPromise;
    }
    
    chunkIndexPromise = (async () => {
        try {
            const data = await env.DICTIONARY.get('padakanaja_reverse_index_chunk_index', 'json');
            if (!data) {
                throw new Error('Chunk index not found in KV');
            }
            chunkIndex = data;
            console.log(`Loaded chunk index: ${Object.keys(chunkIndex).length} prefixes`);
            return chunkIndex;
        } catch (error) {
            console.error('Failed to load chunk index:', error);
            throw error;
        }
    })();
    
    return chunkIndexPromise;
}

// Load specific chunks from KV
async function loadChunks(chunkNumbers, env) {
    const chunksToLoad = chunkNumbers.filter(num => !chunkCache.has(num));
    
    if (chunksToLoad.length === 0) {
        return; // All chunks already loaded
    }
    
    const loadPromises = chunksToLoad.map(async (chunkNum) => {
        try {
            const chunkKey = `padakanaja_reverse_index_part${chunkNum}`;
            const data = await env.DICTIONARY.get(chunkKey, 'json');
            if (data) {
                chunkCache.set(chunkNum, data);
                console.log(`Loaded chunk ${chunkNum} (${Object.keys(data).length} words)`);
            }
        } catch (error) {
            console.error(`Failed to load chunk ${chunkNum}:`, error);
        }
    });
    
    await Promise.all(loadPromises);
}

// Get which chunks might contain a word
function getChunksForWord(word, chunkIndex) {
    if (!chunkIndex || !word) {
        return [1]; // Fallback: try first chunk
    }
    
    const wordLower = word.toLowerCase();
    const prefix = wordLower.substring(0, 3);
    
    if (prefix in chunkIndex) {
        return chunkIndex[prefix];
    }
    
    // Fallback: try first character
    const firstChar = wordLower[0];
    if (firstChar && firstChar in chunkIndex) {
        const chunks = chunkIndex[firstChar];
        return chunks.slice(0, 3); // Limit to 3 chunks
    }
    
    // Ultimate fallback: first chunk
    return [1];
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

// Search using reverse index (O(1) lookup)
async function searchWithReverseIndex(query, env) {
    const queryLower = query.toLowerCase().trim();
    const words = queryLower.split(/\s+/).filter(w => w.length > 0);
    
    if (words.length === 0) {
        return [];
    }
    
    // Load chunk index
    const index = await loadChunkIndex(env);
    console.log(`Searching for: ${queryLower}, words: ${words.join(', ')}`);
    console.log(`Chunk index loaded: ${Object.keys(index).length} prefixes`);
    
    const results = [];
    const seen = new Set();
    const maxResults = 500;
    
    // For each word, find relevant chunks and search
    for (const word of words) {
        if (results.length >= maxResults) break;
        
        const cleanWord = word.replace(/[^a-z0-9]/gi, '').toLowerCase();
        if (cleanWord.length < 2) continue;
        
        // Get chunks that might contain this word
        const chunkNumbers = getChunksForWord(cleanWord, index);
        console.log(`Word '${cleanWord}' -> chunks: ${chunkNumbers.join(', ')}`);
        
        // Load those chunks
        await loadChunks(chunkNumbers, env);
        console.log(`Loaded chunks: ${Array.from(chunkCache.keys()).join(', ')}`);
        
        // Search in loaded chunks
        for (const chunkNum of chunkNumbers) {
            const chunk = chunkCache.get(chunkNum);
            if (!chunk) {
                console.log(`Chunk ${chunkNum} not loaded after loadChunks call`);
                continue;
            }
            console.log(`Searching chunk ${chunkNum} (${Object.keys(chunk).length} words)`);
            console.log(`Looking for '${cleanWord}' in chunk ${chunkNum}`);
            
            // Check if word exists
            const hasWord = cleanWord in chunk;
            console.log(`'${cleanWord}' in chunk ${chunkNum}: ${hasWord}`);
            if (hasWord) {
                console.log(`Found '${cleanWord}' in chunk ${chunkNum}: ${chunk[cleanWord].length} entries`);
                for (const entry of chunk[cleanWord]) {
                    const key = `${entry.kannada}-${entry.english}`;
                    if (!seen.has(key) && results.length < maxResults) {
                        seen.add(key);
                        results.push({
                            kannada: cleanKannadaEntry(entry.kannada),
                            definition: entry.english,
                            type: entry.type || 'Noun',
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
    
    return results;
}

// Main request handler
export default {
    async fetch(request, env) {
        // CORS headers
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
        
        try {
            // Get query
            const url = new URL(request.url);
            const query = url.searchParams.get('q') || '';
            
            if (!query || query.trim().length === 0) {
                return new Response(JSON.stringify({ 
                    error: 'Query parameter "q" is required' 
                }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
            
            // Search using reverse index
            const results = await searchWithReverseIndex(query.trim(), env);
            
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

