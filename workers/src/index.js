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

// Helper: Check if text contains whole word
function containsWholeWord(text, word) {
    if (!text || !word) return false;
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');
    return regex.test(text);
}

// Search using reverse index (O(1) lookup)
async function searchWithReverseIndex(query, env) {
    const queryLower = query.toLowerCase().trim();
    const words = queryLower.split(/\s+/).filter(w => w.length > 0);
    
    if (words.length === 0) {
        return [];
    }
    
    const isMultiWord = words.length > 1;
    const maxResults = 500;
    
    // Load chunk index
    const index = await loadChunkIndex(env);
    
    // For multi-word: collect all candidate entries, then filter to those containing all words
    if (isMultiWord) {
        const exactPhrase = queryLower;
        const exactPhraseResults = [];
        const allWordsResults = [];
        const seen = new Set();
        
        // Step 1: Collect all candidate entries (union of all word results)
        const candidateEntries = new Map(); // key -> entry data
        
        // Load all chunks for all words first
        const allChunkNumbers = new Set();
        for (const word of words) {
            const cleanWord = word.replace(/[^a-z0-9]/gi, '').toLowerCase();
            if (cleanWord.length < 2) continue;
            const chunks = getChunksForWord(cleanWord, index);
            chunks.forEach(c => allChunkNumbers.add(c));
        }
        await loadChunks(Array.from(allChunkNumbers), env);
        
        // Collect all entries that match any word
        for (const word of words) {
            const cleanWord = word.replace(/[^a-z0-9]/gi, '').toLowerCase();
            if (cleanWord.length < 2) continue;
            
            const chunkNumbers = getChunksForWord(cleanWord, index);
            for (const chunkNum of chunkNumbers) {
                const chunk = chunkCache.get(chunkNum);
                if (!chunk || !(cleanWord in chunk)) continue;
                
                for (const entry of chunk[cleanWord]) {
                    const key = `${entry.kannada}-${entry.english}`;
                    if (!candidateEntries.has(key)) {
                        candidateEntries.set(key, entry);
                    }
                }
            }
        }
        
        // Step 2: Filter candidates to only those containing ALL words
        for (const [key, entry] of candidateEntries) {
            if (seen.has(key) || exactPhraseResults.length + allWordsResults.length >= maxResults) break;
            
            const defLower = entry.english.toLowerCase();
            
            // Check if all words are present
            const allWordsPresent = words.every(w => {
                const cleanW = w.replace(/[^a-z0-9]/gi, '').toLowerCase();
                return containsWholeWord(entry.english, cleanW);
            });
            
            if (!allWordsPresent) continue; // Skip if not all words present
            
            // Exact phrase match (highest priority)
            if (defLower.includes(exactPhrase)) {
                seen.add(key);
                exactPhraseResults.push({
                    kannada: cleanKannadaEntry(entry.kannada),
                    definition: entry.english,
                    type: entry.type || 'Noun',
                    source: entry.source || '',
                    dict_title: entry.dict_title || '',
                    id: entry.id || '',
                    matchedWord: exactPhrase,
                    matchType: 'exact-phrase'
                });
            } else {
                // All words present as whole words
                seen.add(key);
                allWordsResults.push({
                    kannada: cleanKannadaEntry(entry.kannada),
                    definition: entry.english,
                    type: entry.type || 'Noun',
                    source: entry.source || '',
                    dict_title: entry.dict_title || '',
                    id: entry.id || '',
                    matchedWord: exactPhrase,
                    matchType: 'all-words'
                });
            }
        }
        
        // Return: exact phrase first, then all words
        return [...exactPhraseResults, ...allWordsResults].slice(0, maxResults);
    } else {
        // Single word search (original logic)
        const results = [];
        const seen = new Set();
        const word = words[0];
        const cleanWord = word.replace(/[^a-z0-9]/gi, '').toLowerCase();
        
        if (cleanWord.length < 2) return [];
        
        const chunkNumbers = getChunksForWord(cleanWord, index);
        await loadChunks(chunkNumbers, env);
        
        for (const chunkNum of chunkNumbers) {
            const chunk = chunkCache.get(chunkNum);
            if (!chunk || !(cleanWord in chunk)) continue;
            
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
                        id: entry.id || '',
                        matchedWord: word,
                        matchType: 'direct'
                    });
                }
            }
        }
        
        return results;
    }
}

function writeRalaMetric(env, name) {
    if (name === 'pwa_install') {
        console.log(JSON.stringify({ rala_event: name, ts: Date.now() }));
    }
    const analytics = env.ANALYTICS || env.ANALYTICS_ENGINE;
    if (analytics) {
        try {
            analytics.writeDataPoint({ blobs: [name], doubles: [1] });
        } catch (err) {
            console.error('Analytics write failed:', err);
        }
    }
}

function sanitizeLogFragment(s, maxLen) {
    if (!s || typeof s !== 'string') return '';
    return s.replace(/[\r\n\0]/g, ' ').trim().slice(0, maxLen);
}

/** Primary user search only: always logs `q` to Worker Logs (filter: rala_event). */
function logSearchPrimary(env, queryText) {
    const q = sanitizeLogFragment(queryText, 300);
    console.log(JSON.stringify({ rala_event: 'search_primary', q, ts: Date.now() }));
    const analytics = env.ANALYTICS || env.ANALYTICS_ENGINE;
    if (analytics) {
        try {
            analytics.writeDataPoint({ blobs: ['search_primary', q], doubles: [1] });
        } catch (err) {
            console.error('Analytics write failed:', err);
        }
    }
}

// Main request handler
export default {
    async fetch(request, env) {
        // CORS headers
        const origin = request.headers.get('Origin');
        const corsHeaders = {
            'Access-Control-Allow-Origin': origin || '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Rala-Intent',
            'Access-Control-Max-Age': '86400',
        };
        
        // Handle OPTIONS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);

        // Client-side events (whitelist only)
        if (url.pathname === '/__rala/v1/event' && request.method === 'POST') {
            try {
                const body = await request.json();
                const e = body && typeof body.e === 'string' ? body.e : '';
                if (e === 'pwa_install') {
                    writeRalaMetric(env, 'pwa_install');
                    return new Response(null, { status: 204, headers: corsHeaders });
                }
                if (e === 'audio_play') {
                    const w = sanitizeLogFragment(body.w, 120);
                    console.log(JSON.stringify({ rala_event: 'audio_play', w, ts: Date.now() }));
                    return new Response(null, { status: 204, headers: corsHeaders });
                }
                return new Response(JSON.stringify({ error: 'Unsupported event' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            } catch {
                return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
        }
        
        try {
            // Get query
            const query = url.searchParams.get('q') || '';
            
            if (!query || query.trim().length === 0) {
                return new Response(JSON.stringify({ 
                    error: 'Query parameter "q" is required' 
                }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            const intent = request.headers.get('X-Rala-Intent') || '';
            if (intent === 'primary') {
                logSearchPrimary(env, query.trim());
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

