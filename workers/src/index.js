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

function sanitizeLogFragment(s, maxLen) {
    if (!s || typeof s !== 'string') return '';
    return s.replace(/[\r\n\0]/g, ' ').trim().slice(0, maxLen);
}

const EVENT_VERSION = 'rala_event.v2';
const EVENT_LOG_LEVEL = 'info';

function getRequestContext(request) {
    const cf = request.cf || {};
    return {
        ip: request.headers.get('CF-Connecting-IP') || request.headers.get('X-Real-IP') || '',
        country: cf.country || '',
        city: cf.city || '',
        region: cf.region || '',
        colo: cf.colo || '',
        asn: cf.asn || null,
        isp: cf.asOrganization || '',
        user_agent: request.headers.get('User-Agent') || '',
        origin: request.headers.get('Origin') || '',
        referer: request.headers.get('Referer') || ''
    };
}

async function archiveEventToR2(env, eventObj) {
    if (!env.LOG_ARCHIVE) return;
    const date = new Date(eventObj.ts);
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const key = `events/${yyyy}/${mm}/${dd}/${hh}/${eventObj.ts}-${crypto.randomUUID()}.json`;
    const body = JSON.stringify(eventObj);
    await env.LOG_ARCHIVE.put(key, body, {
        httpMetadata: { contentType: 'application/json' }
    });
}

function emitEvent(env, request, eventName, payload = {}, executionCtx = null) {
    const eventObj = {
        rala_event: eventName,
        event_version: EVENT_VERSION,
        log_level: EVENT_LOG_LEVEL,
        ts: Date.now(),
        ...payload,
        ctx: getRequestContext(request)
    };

    console.log(JSON.stringify(eventObj));

    const analytics = env.ANALYTICS || env.ANALYTICS_ENGINE;
    if (analytics) {
        const term = payload.q || payload.w || '';
        try {
            analytics.writeDataPoint({ blobs: [eventName, term], doubles: [1] });
        } catch (err) {
            console.error('Analytics write failed:', err);
        }
    }

    if (executionCtx && env.LOG_ARCHIVE) {
        executionCtx.waitUntil(archiveEventToR2(env, eventObj));
    }
}

function isDashboardAuthorized(request, env, url) {
    const expected = (env.LOG_DASHBOARD_TOKEN || '').trim();
    if (!expected) return false;
    const headerToken = (request.headers.get('X-Rala-Dashboard-Token') || '').trim();
    const queryToken = (url.searchParams.get('token') || '').trim();
    return headerToken === expected || queryToken === expected;
}

function toArchiveHourPrefix(ts) {
    const d = new Date(ts);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    return `events/${yyyy}/${mm}/${dd}/${hh}/`;
}

function utcHourStartMs(ts) {
    const d = new Date(ts);
    return Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        d.getUTCHours(),
        0,
        0,
        0
    );
}

async function readArchiveEvents(env, options = {}) {
    if (!env.LOG_ARCHIVE) {
        return { events: [], scannedKeys: 0 };
    }

    const hours = Math.max(1, Math.min(24 * 14, Number(options.hours || 24))); // 1h..14d
    const limit = Math.max(1, Math.min(5000, Number(options.limit || 1000)));
    const eventFilter = sanitizeLogFragment(options.event || '', 64);
    const sinceMs = Date.now() - (hours * 60 * 60 * 1000);

    let scannedKeys = 0;
    const candidateKeys = [];
    const maxScannedKeys = 75000;
    const targetCandidateCount = Math.max(limit * 10, 3000);
    const startHour = utcHourStartMs(Date.now());
    const minHour = utcHourStartMs(sinceMs);

    // Scan recent hour partitions first so dashboards don't miss fresh events at high key counts.
    for (let hourTs = startHour; hourTs >= minHour; hourTs -= 60 * 60 * 1000) {
        const prefix = toArchiveHourPrefix(hourTs);
        let cursor = undefined;

        while (true) {
            const page = await env.LOG_ARCHIVE.list({ prefix, cursor, limit: 1000 });
            for (const obj of page.objects || []) {
                scannedKeys += 1;
                candidateKeys.push(obj.key);
            }

            if (!page.truncated) break;
            cursor = page.cursor;

            if (scannedKeys >= maxScannedKeys) break;
            if (!eventFilter && candidateKeys.length >= targetCandidateCount) break;
        }

        if (scannedKeys >= maxScannedKeys) break;
        if (!eventFilter && candidateKeys.length >= targetCandidateCount) break;
    }

    // Keys include timestamp prefix, so lexical sort gives stable chronology inside date folders.
    candidateKeys.sort();
    const keysToFetch = candidateKeys.slice(-Math.min(candidateKeys.length, limit * 3));

    const parsed = [];
    for (const key of keysToFetch) {
        const obj = await env.LOG_ARCHIVE.get(key);
        if (!obj) continue;
        try {
            const ev = JSON.parse(await obj.text());
            if (!ev || typeof ev !== 'object') continue;
            if (eventFilter && ev.rala_event !== eventFilter) continue;
            if (typeof ev.ts === 'number' && ev.ts < sinceMs) continue;
            parsed.push(ev);
        } catch {
            // Skip malformed objects
        }
    }

    parsed.sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
    return { events: parsed.slice(0, limit), scannedKeys };
}

/** Primary user search only: always logs `q` to Worker Logs (filter: rala_event). */
function logSearchPrimary(env, request, queryText, executionCtx = null) {
    const q = sanitizeLogFragment(queryText, 300);
    emitEvent(env, request, 'search_primary', { q }, executionCtx);
}

// Main request handler
export default {
    async fetch(request, env, executionCtx) {
        // CORS headers
        const origin = request.headers.get('Origin');
        const corsHeaders = {
            'Access-Control-Allow-Origin': origin || '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Rala-Intent, X-Rala-Dashboard-Token',
            'Access-Control-Max-Age': '86400',
        };
        
        // Handle OPTIONS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);

        // Admin archive endpoint (for local dashboard)
        if (url.pathname === '/__rala/v1/archive' && request.method === 'GET') {
            if (!isDashboardAuthorized(request, env, url)) {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                    status: 401,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            const result = await readArchiveEvents(env, {
                hours: url.searchParams.get('hours') || '24',
                limit: url.searchParams.get('limit') || '1000',
                event: url.searchParams.get('event') || ''
            });
            return new Response(JSON.stringify({
                event_version: EVENT_VERSION,
                archive_version: 'rala_archive.v1',
                generated_at: Date.now(),
                count: result.events.length,
                scanned_keys: result.scannedKeys,
                events: result.events
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Client-side events (whitelist only)
        if (url.pathname === '/__rala/v1/event' && request.method === 'POST') {
            try {
                const body = await request.json();
                const e = body && typeof body.e === 'string' ? body.e : '';
                if (e === 'pwa_install') {
                    emitEvent(env, request, 'pwa_install', {}, executionCtx);
                    return new Response(null, { status: 204, headers: corsHeaders });
                }
                if (e === 'audio_play') {
                    const w = sanitizeLogFragment(body.w, 120);
                    emitEvent(env, request, 'audio_play', { w }, executionCtx);
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
                logSearchPrimary(env, request, query.trim(), executionCtx);
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

