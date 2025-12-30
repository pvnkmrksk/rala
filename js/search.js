// ============================================================================
// search.js - Search functions: direct search, synonym search, highlighting
// ============================================================================

// Clean Kannada entry text - remove brackets, parentheses, numbers, and other non-text characters
function cleanKannadaEntry(text) {
    if (!text) return '';
    // Remove brackets: [], (), {}, 【】, 「」, etc.
    let cleaned = text.replace(/[\[\](){}【】「」〈〉《》『』〔〕［］（）｛｝]/g, '');
    // Remove other common punctuation that shouldn't be in dictionary keys
    cleaned = cleaned.replace(/[<>"']/g, '');
    // Remove numbers (data entry errors) - ASCII digits and digit sequences
    cleaned = cleaned.replace(/\d+/g, '');
    // Remove multiple spaces and trim
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}

// Count words in Kannada text (split by spaces)
function countWords(text) {
    if (!text) return 0;
    const cleaned = cleanKannadaEntry(text);
    const words = cleaned.split(/\s+/).filter(w => w.length > 0);
    return words.length;
}

// Check if entry is a long phrase (>4 words)
function isLongPhrase(text) {
    return countWords(text) > 4;
}

// Check if entry is a description (more than 2 words) - these are low priority
function isDescription(text) {
    return countWords(text) > 2;
}

// Get word forms (derived words) - e.g., "heal" -> "healer", "healing", "healed"
// Get word endings/stems using Datamuse API only (no custom logic)
// Uses Datamuse's spelling pattern search to find word forms
async function getWordEndings(word) {
    try {
        // Use Datamuse API to find word forms (e.g., "escalation" -> "escalate", "escalating")
        // Search for words starting with the stem (remove common endings first)
        const endings = ['tion', 'sion', 'ing', 'ed', 'ly', 'ment', 'ness', 'ity', 'able', 'ible', 'er', 'est', 's', 'es'];
        let stem = word.toLowerCase();
        let foundStem = false;
        
        for (const ending of endings) {
            if (stem.endsWith(ending) && stem.length > ending.length + 2) {
                stem = stem.slice(0, -ending.length);
                foundStem = true;
                break;
            }
        }
        
        // If we found a stem, use Datamuse API to find all word forms
        if (foundStem && stem.length >= 3) {
            const response = await fetch(`${DATAMUSE_API}?sp=${encodeURIComponent(stem)}*&max=20`);
            const data = await response.json();
            
            const wordForms = [];
            const wordLower = word.toLowerCase();
            
            for (const item of data) {
                const itemWord = item.word.toLowerCase();
                // Exclude the original word itself
                if (itemWord !== wordLower && itemWord.startsWith(stem)) {
                    // Filter out compound words and phrases
                    if (!itemWord.includes(' ') && itemWord.length <= stem.length + 8) {
                        wordForms.push(item.word);
                    }
                }
            }
            
            return wordForms;
        }
        
        return [];
    } catch (error) {
        console.error('Error getting word endings from API:', error);
        return [];
    }
}

async function getWordForms(word) {
    try {
        const response = await fetch(`${DATAMUSE_API}?rel_der=${encodeURIComponent(word)}&max=10`);
        const data = await response.json();
        return data.map(item => item.word);
    } catch {
        return [];
    }
}

// Get proper synonyms (filter out antonyms, but keep words that are valid synonyms in other contexts)
async function getSynonyms(word) {
    try {
        // Get synonyms and antonyms
        const [synResponse, antResponse] = await Promise.all([
            fetch(`${DATAMUSE_API}?rel_syn=${encodeURIComponent(word)}&max=20`),
            fetch(`${DATAMUSE_API}?rel_ant=${encodeURIComponent(word)}&max=20`)
        ]);
        
        const synonyms = await synResponse.json();
        const antonyms = await antResponse.json();
        
        // Create set of antonyms to exclude (only for THIS specific word)
        const antonymSet = new Set(antonyms.map(item => item.word.toLowerCase()));
        
        // Filter out antonyms for this specific word
        // Don't globally exclude words like "quack" or "charlatan" - they might be valid synonyms elsewhere
        const filtered = synonyms
            .map(item => item.word)
            .filter(w => {
                const wLower = w.toLowerCase();
                // Only exclude if it's an antonym for THIS word
                if (antonymSet.has(wLower)) return false;
                // Exclude if word contains negative prefixes (un-, non-, anti-)
                // These are usually not synonyms
                if (wLower.startsWith('un') || wLower.startsWith('non') || wLower.startsWith('anti')) {
                    return false;
                }
                return true;
            });
        
        return filtered.slice(0, 10); // Limit to top 10
    } catch {
        return [];
    }
}

// Get word variants (plurals, verb forms) - DEPRECATED, use getWordEndings instead
async function getWordVariants(word) {
    try {
        // Get spelling variants (plurals, past tense, etc.) - but be careful
        const response = await fetch(`${DATAMUSE_API}?sp=${encodeURIComponent(word)}&max=10`);
        const data = await response.json();
        
        const variants = [];
        for (const item of data) {
            if (item.word && item.word !== word) {
                variants.push(item.word);
            }
        }
        
        return variants;
    } catch {
        return [];
    }
}

// Get similar words - REMOVED (was giving false positives like "exhalation", "excavation")
// Use only word endings and proper synonyms (rel_syn) instead
async function getSimilarWords(word) {
    // Disabled - was giving too many false positives
    return [];
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

function getDefinitionPriority(definition, searchWord, kannadaEntry = '') {
    // Priority system (lower number = higher priority):
    // 0: Exact match + Kannada has ≤2 words (best match)
    // 1: Exact match + Kannada has >2 words (description, lower priority)
    // 2: Match at end + Kannada has ≤2 words
    // 3: Match at end + Kannada has >2 words
    // 4: Match anywhere + Kannada has ≤2 words
    // 5: Match anywhere + Kannada has >2 words
    // 6: Partial word match (if multi-word query) + Kannada has ≤2 words
    // 7: Partial word match + Kannada has >2 words
    // 8: More than 2 words in Kannada (descriptions) - lowest priority
    
    if (!definition) return 8;
    const trimmed = definition.trim();
    const trimmedLower = trimmed.toLowerCase();
    const searchLower = searchWord.toLowerCase();
    
    // Check Kannada word count
    const kannadaWordCount = kannadaEntry ? countWords(kannadaEntry) : 0;
    const isKannadaShort = kannadaWordCount <= 2;
    const isKannadaDescription = kannadaWordCount > 2;
    
    // If Kannada has more than 2 words, it's a description - lowest priority
    if (isKannadaDescription) {
        // Still check match quality, but add penalty
        const basePriority = getMatchQuality(trimmed, trimmedLower, searchLower);
        return basePriority + 4; // Add penalty for descriptions
    }
    
    // For short Kannada entries (≤2 words), use normal priority
    return getMatchQuality(trimmed, trimmedLower, searchLower);
}

function getMatchQuality(trimmed, trimmedLower, searchLower) {
    // Escape special regex characters in search word
    const escapedSearch = searchLower.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    
    // Priority 0: Exact full-word match - definition is exactly the search word
    const trimmedNoPeriod = trimmed.replace(/\.\s*$/, '').trim();
    if (trimmedNoPeriod.toLowerCase() === searchLower) {
        return 0; // Highest priority
    }
    
    // Priority 1: Check if search term is fully between ";" and "." at the end
    const betweenSemicolonAndPeriod = new RegExp(`;\\s+[^;]*?${escapedSearch}\\s*\\.\\s*$`, 'i');
    if (betweenSemicolonAndPeriod.test(trimmed)) {
        return 1; // Second highest
    }
    
    // Priority 2: Check if search term is at the end (before final period)
    const atEndPattern = new RegExp(`${escapedSearch}\\s*\\.\\s*$`, 'i');
    if (atEndPattern.test(trimmed)) {
        return 2; // Third priority
    }
    
    // Priority 3: Match anywhere in definition
    if (trimmedLower.includes(searchLower)) {
        return 3;
    }
    
    // Priority 4: Partial word match (for multi-word queries)
    const words = searchLower.split(/\s+/);
    if (words.length > 1) {
        for (const word of words) {
            if (trimmedLower.includes(word)) {
                return 4; // Partial match
            }
        }
    }
    
    return 5; // No match (shouldn't happen if we're calling this)
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

// Search Alar dictionary locally (for offline support)
function searchLocalAlar(query) {
    if (!dictionary || dictionary.length === 0) {
        return [];
    }
    
    const queryLower = query.toLowerCase().trim();
    const words = queryLower.split(/\s+/).filter(w => w.length > 0);
    const results = [];
    const seen = new Set();
    
    // Filter to only Alar entries
    const alarEntries = dictionary.filter(e => e.source === 'alar');
    
    if (words.length === 1) {
        // Single word search - use whole word matching only (no substring matching)
        const word = words[0];
        for (const entry of alarEntries) {
            if (!entry.defs) continue;
            for (const def of entry.defs) {
                if (!def.entry) continue;
                // Use whole word matching - "test" won't match "detest"
                if (containsWholeWord(def.entry, word)) {
                    const key = `${entry.entry}-${def.entry}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        results.push({
                            kannada: entry.entry,
                            phone: entry.phone || '',
                            definition: def.entry,
                            type: def.type || 'Noun',
                            head: entry.head || '',
                            id: entry.id || '',
                            dict_title: entry.dict_title || '',
                            source: entry.source || 'alar',
                            matchedWord: word,
                            matchType: 'direct'
                        });
                    }
                }
            }
        }
    } else {
        // Multi-word search - check for exact phrase first, then all words as whole words
        const exactPhrase = queryLower;
        for (const entry of alarEntries) {
            if (!entry.defs) continue;
            for (const def of entry.defs) {
                if (!def.entry) continue;
                const defLower = def.entry.toLowerCase();
                // First try exact phrase match
                if (defLower.includes(exactPhrase)) {
                    const key = `${entry.entry}-${def.entry}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        results.push({
                            kannada: entry.entry,
                            phone: entry.phone || '',
                            definition: def.entry,
                            type: def.type || 'Noun',
                            head: entry.head || '',
                            id: entry.id || '',
                            dict_title: entry.dict_title || '',
                            source: entry.source || 'alar',
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
                                kannada: entry.entry,
                                phone: entry.phone || '',
                                definition: def.entry,
                                type: def.type || 'Noun',
                                head: entry.head || '',
                                id: entry.id || '',
                                dict_title: entry.dict_title || '',
                                source: entry.source || 'alar',
                                matchedWord: exactPhrase,
                                matchType: 'all-words'
                            });
                        }
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

async function searchDirect(query) {
    // If Worker API is configured, search Alar locally (fast) + Padakanaja from API (on-demand)
    if (WORKER_API_URL) {
        try {
            const startTime = performance.now();
            
            // Search Alar locally (fast, already loaded) and Padakanaja from API in parallel
            const [localResults, workerResponse] = await Promise.all([
                // Search Alar locally (if dictionary is loaded)
                Promise.resolve(
                    dictionaryReady && dictionary && dictionary.length > 0 
                        ? searchLocalAlar(query) 
                        : []
                ),
                // Fetch Padakanaja from Worker API (on-demand, like synonyms)
                fetch(`${WORKER_API_URL}?q=${encodeURIComponent(query)}`)
            ]);
            
            if (!workerResponse.ok) {
                throw new Error(`Worker API error: ${workerResponse.status}`);
            }
            
            const data = await workerResponse.json();
            const searchTime = performance.now() - startTime;
            
            // Convert Worker response format to client format (Padakanaja results)
            const padakanajaResults = data.results.map(result => ({
                kannada: result.kannada,
                phone: result.phone || '',
                definition: result.definition,
                type: result.type || 'Noun',
                head: result.head || '',
                id: result.id || '',
                dict_title: result.dict_title || '',
                source: result.source || '',
                matchedWord: result.matchedWord || query,
                matchType: result.matchType || 'direct'
            }));
            
            // Combine Alar (local) + Padakanaja (API) results
            const seen = new Set();
            const combinedResults = [];
            
            // Add Alar results first (local, fast)
            for (const result of localResults) {
                const key = `${result.kannada}-${result.definition}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    combinedResults.push(result);
                }
            }
            
            // Add Padakanaja results (from API, avoid duplicates)
            for (const result of padakanajaResults) {
                const key = `${result.kannada}-${result.definition}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    combinedResults.push(result);
                }
            }
            
            console.log(`🔍 Search "${query}" (v2.2): ${localResults.length} Alar + ${padakanajaResults.length} Padakanaja = ${combinedResults.length} total (${searchTime.toFixed(0)}ms)`);
            
            // Sort combined results (same priority logic as before)
            combinedResults.sort((a, b) => {
                const aPriority = getDefinitionPriority(a.definition, a.matchedWord || query, a.kannada);
                const bPriority = getDefinitionPriority(b.definition, b.matchedWord || query, b.kannada);
                if (aPriority !== bPriority) {
                    return aPriority - bPriority;
                }
                return cleanKannadaEntry(a.kannada).localeCompare(cleanKannadaEntry(b.kannada));
            });
            
            return combinedResults;
        } catch (error) {
            console.error('❌ Worker API search failed:', error);
            // Fall through to client-side search
        }
    }
    
    // Client-side search (original logic)
    // Auto-convert space to wildcard for exactly 2 words
    // e.g., "north east" -> "north*east" to match "north-east", "northeast", "north east"
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const isAutoWildcard = words.length === 2 && !query.includes('*');
    const wildcardPattern = isAutoWildcard ? query.replace(/\s+/, '*') : null;
    
    const hasWildcard = query.includes('*') || isAutoWildcard;
    const queryLower = query.toLowerCase().trim();
    const isMultiWord = words.length > 1;
    
    const exactPhraseResults = [];
    const allWordsResults = [];
    const anyWordResults = [];
    const seen = new Set();
    
    // Check once if padakanaja is in memory (reuse this check throughout the function)
    let hasPadakanajaInMemory = false;
    for (let i = 0; i < dictionary.length; i++) {
        if (dictionary[i].source && dictionary[i].source !== 'alar') {
            hasPadakanajaInMemory = true;
            break;
        }
    }
    
    // If wildcards are present (but not auto-wildcard for 2 words), search all definitions directly
    if (hasWildcard && !isAutoWildcard) {
        const results = [];
        // Search Alar entries
        for (let i = 0; i < dictionary.length; i++) {
            const entry = dictionary[i];
            if (!entry.defs) continue;
            
            for (const def of entry.defs) {
                if (!def.entry) continue;
                const defLower = def.entry.toLowerCase();
                
                // Check if definition matches the query pattern
                // For auto-wildcard (2 words), also check original query for exact phrase match
                const matchesWildcard = textContains(defLower, queryLower);
                const matchesOriginal = words.length === 2 && defLower.includes(query.toLowerCase().trim());
                
                if (matchesWildcard || matchesOriginal) {
                    const key = `${entry.entry}-${def.entry}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        // Determine which match was found for better highlighting
                        const matchedWord = matchesOriginal && words.length === 2 
                            ? query.toLowerCase().trim() 
                            : queryLower;
                        
                        results.push({
                            kannada: entry.entry,
                            phone: entry.phone,
                            definition: def.entry,
                            type: def.type,
                            head: entry.head,
                            id: entry.id,
                            dict_title: entry.dict_title,
                            source: entry.source,
                            matchedWord: matchedWord,
                            matchType: 'wildcard'
                        });
                    }
                }
            }
        }
        
        // Sort by priority, then alphabetically, then by length (long phrases at bottom)
        results.sort((a, b) => {
            const aPriority = getDefinitionPriority(a.definition, a.matchedWord, a.kannada);
            const bPriority = getDefinitionPriority(b.definition, b.matchedWord, b.kannada);
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            // Clean Kannada entries for comparison
            const aKannada = cleanKannadaEntry(a.kannada);
            const bKannada = cleanKannadaEntry(b.kannada);
            return aKannada.localeCompare(bKannada);
        });
        
        return results;
    }
    
    if (isMultiWord) {
        // Step 1: Find exact phrase matches (entire query in exact order)
        // For 2-word auto-wildcard, also search for hyphenated/compound variations
        const exactPhrase = queryLower;
        const searchPatterns = [exactPhrase];
        if (isAutoWildcard && wildcardPattern) {
            // Also search for hyphenated and compound variations
            searchPatterns.push(wildcardPattern.toLowerCase().replace('*', '-'));
            searchPatterns.push(wildcardPattern.toLowerCase().replace('*', ''));
        }
        
        // Search using reverse index
        if (reverseIndex.has(words[0])) {
            for (const entry of reverseIndex.get(words[0])) {
                const defLower = entry.definition.toLowerCase();
                let matched = false;
                let matchedPattern = exactPhrase;
                
                // Check all patterns
                for (const pattern of searchPatterns) {
                    if (defLower.includes(pattern)) {
                        matched = true;
                        matchedPattern = pattern;
                        break;
                    }
                }
                
                // Also check wildcard pattern if auto-wildcard
                if (!matched && isAutoWildcard && wildcardPattern) {
                    const wildcardLower = wildcardPattern.toLowerCase();
                    if (textContains(defLower, wildcardLower)) {
                        matched = true;
                        matchedPattern = wildcardLower;
                    }
                }
                
                if (matched) {
                    const key = `${entry.kannada}-${entry.definition}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        exactPhraseResults.push({ 
                            ...entry, 
                            matchedWord: matchedPattern, 
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
                    let matched = false;
                    let matchedPattern = exactPhrase;
                    
                    // Check all patterns
                    for (const pattern of searchPatterns) {
                        if (defLower.includes(pattern)) {
                            matched = true;
                            matchedPattern = pattern;
                            break;
                        }
                    }
                    
                    // Also check wildcard pattern if auto-wildcard
                    if (!matched && isAutoWildcard && wildcardPattern) {
                        const wildcardLower = wildcardPattern.toLowerCase();
                        if (textContains(defLower, wildcardLower)) {
                            matched = true;
                            matchedPattern = wildcardLower;
                        }
                    }
                    
                    if (matched) {
                        const key = `${entry.kannada}-${entry.definition}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            exactPhraseResults.push({ 
                                ...entry, 
                                matchedWord: matchedPattern, 
                                matchType: 'exact-phrase' 
                            });
                        }
                    }
                }
            }
        }
        
        // Also search padakanaja entries for exact phrase
        // Check if padakanaja is in memory first, otherwise search IndexedDB
        if (hasPadakanajaInMemory) {
            // Padakanaja is in memory - search from memory
            for (let i = 0; i < dictionary.length; i++) {
                const entry = dictionary[i];
                // Skip Alar entries (they're in reverse index)
                if (entry.source === 'alar') continue;
                
                if (!entry.defs) continue;
                
                for (const def of entry.defs) {
                    if (!def.entry) continue;
                    const defLower = def.entry.toLowerCase();
                    
                    // Check if definition matches any of the search patterns
                    let matched = false;
                    let matchedPattern = exactPhrase;
                    for (const pattern of searchPatterns) {
                        if (defLower.includes(pattern)) {
                            matched = true;
                            matchedPattern = pattern;
                            break;
                        }
                    }
                    
                    // Also check wildcard pattern if auto-wildcard
                    if (!matched && isAutoWildcard && wildcardPattern) {
                        const wildcardLower = wildcardPattern.toLowerCase();
                        if (textContains(defLower, wildcardLower)) {
                            matched = true;
                            matchedPattern = wildcardLower;
                        }
                    }
                    
                    if (matched) {
                        const key = `${entry.entry}-${def.entry}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            exactPhraseResults.push({
                                kannada: cleanKannadaEntry(entry.entry),
                                phone: entry.phone || '',
                                definition: def.entry,
                                type: normalizeType(def.type || ''),
                                head: entry.head || '',
                                id: entry.id || '',
                                dict_title: entry.dict_title || '',
                                source: entry.source || '',
                                matchedWord: matchedPattern,
                                matchType: 'exact-phrase'
                            });
                        }
                    }
                }
            }
        } else if (window.searchPadakanajaFromIndexedDB) {
            // Padakanaja not in memory - search from IndexedDB (async, limited results)
            try {
                const padakanajaResults = await window.searchPadakanajaFromIndexedDB(words, 30);
                if (padakanajaResults && Array.isArray(padakanajaResults)) {
                    for (const result of padakanajaResults) {
                        const defLower = result.definition.toLowerCase();
                        let matched = false;
                        let matchedPattern = exactPhrase;
                        for (const pattern of searchPatterns) {
                            if (defLower.includes(pattern)) {
                                matched = true;
                                matchedPattern = pattern;
                                break;
                            }
                        }
                        if (matched) {
                            const key = `${result.kannada}-${result.definition}`;
                            if (!seen.has(key)) {
                                seen.add(key);
                                exactPhraseResults.push({
                                    ...result,
                                    matchedWord: matchedPattern,
                                    matchType: 'exact-phrase'
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error searching padakanaja from IndexedDB:', error);
            }
        }
        
        // For 2-word auto-wildcard, also search all definitions for wildcard matches
        if (isAutoWildcard && wildcardPattern) {
            const wildcardLower = wildcardPattern.toLowerCase();
            for (let i = 0; i < dictionary.length; i++) {
                const entry = dictionary[i];
                if (!entry.defs) continue;
                
                for (const def of entry.defs) {
                    if (!def.entry) continue;
                    const defLower = def.entry.toLowerCase();
                    
                    // Check if it matches wildcard pattern but wasn't already found
                    if (textContains(defLower, wildcardLower)) {
                        const key = `${entry.entry}-${def.entry}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            exactPhraseResults.push({
                                kannada: entry.entry,
                                phone: entry.phone,
                                definition: def.entry,
                                type: def.type,
                                head: entry.head,
                                id: entry.id,
                                dict_title: entry.dict_title,
                                source: entry.source,
                                matchedWord: wildcardLower,
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
        
        // Filter to only those that contain all words (as whole words)
        for (const [key, entry] of candidateEntries.entries()) {
            const containsAllWords = words.every(word => containsWholeWord(entry.definition, word));
            if (containsAllWords) {
                seen.add(key);
                allWordsResults.push({ 
                    ...entry, 
                    matchedWord: words.join(' '), 
                    matchType: 'all-words' 
                });
            }
        }
        
        // Step 3: Find definitions containing any of the words (from reverse index)
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
        
        // Step 4: Also search padakanaja entries (English->Kannada, no reverse index)
        // This is important for words that only exist in padakanaja
        // Check if padakanaja is in memory first, otherwise search IndexedDB
        if (hasPadakanajaInMemory) {
            // Padakanaja is in memory - search from memory
            for (const word of words) {
                for (let i = 0; i < dictionary.length; i++) {
                    const entry = dictionary[i];
                    // Skip Alar entries (they're in reverse index)
                    if (entry.source === 'alar') continue;
                    
                    if (!entry.defs) continue;
                    
                    for (const def of entry.defs) {
                        if (!def.entry) continue;
                        // Check if definition contains the word (as whole word)
                        if (containsWholeWord(def.entry, word)) {
                            const key = `${entry.entry}-${def.entry}`;
                            if (!seen.has(key)) {
                                seen.add(key);
                                anyWordResults.push({
                                    kannada: cleanKannadaEntry(entry.entry),
                                    phone: entry.phone || '',
                                    definition: def.entry,
                                    type: normalizeType(def.type || ''),
                                    head: entry.head || '',
                                    id: entry.id || '',
                                    dict_title: entry.dict_title || '',
                                    source: entry.source || '',
                                    matchedWord: word,
                                    matchType: 'any-word'
                                });
                            }
                        }
                    }
                }
            }
        } else if (window.searchPadakanajaFromIndexedDB) {
            // Padakanaja not in memory - search from IndexedDB (async, memory-efficient)
            try {
                const padakanajaResults = await window.searchPadakanajaFromIndexedDB(words, 50);
                if (padakanajaResults && Array.isArray(padakanajaResults)) {
                    for (const result of padakanajaResults) {
                        const key = `${result.kannada}-${result.definition}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            anyWordResults.push(result);
                        }
                    }
                }
            } catch (error) {
                console.error('Error searching padakanaja from IndexedDB:', error);
            }
        }
        
        // Sort each section by priority, then alphabetically, then by length (long phrases at bottom)
        const sortWithLength = (a, b) => {
            const aPriority = getDefinitionPriority(a.definition, a.matchedWord, a.kannada);
            const bPriority = getDefinitionPriority(b.definition, b.matchedWord, b.kannada);
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            // Clean Kannada entries for comparison
            const aKannada = cleanKannadaEntry(a.kannada);
            const bKannada = cleanKannadaEntry(b.kannada);
            return aKannada.localeCompare(bKannada);
        };
        
        exactPhraseResults.sort(sortWithLength);
        allWordsResults.sort(sortWithLength);
        anyWordResults.sort(sortWithLength);
        
        // Combine results in priority order
        return [...exactPhraseResults, ...allWordsResults, ...anyWordResults];
    } else {
        // Single word: search both reverse index (Alar) and directly (Padakanaja)
        const word = words[0];
        
        // Search reverse index (Alar entries)
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
        
        // Search padakanaja entries (English->Kannada, no reverse index)
        // Check if padakanaja is in memory first, otherwise search IndexedDB
        if (hasPadakanajaInMemory) {
            // Padakanaja is in memory - search from memory
            for (let i = 0; i < dictionary.length; i++) {
                const entry = dictionary[i];
                // Skip Alar entries (they're in reverse index)
                if (entry.source === 'alar') continue;
                
                if (!entry.defs) continue;
                
                for (const def of entry.defs) {
                    if (!def.entry) continue;
                    // Check if definition contains the word (as whole word)
                    if (containsWholeWord(def.entry, word)) {
                        const key = `${entry.entry}-${def.entry}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            anyWordResults.push({
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
                        }
                    }
                }
            }
        } else if (window.searchPadakanajaFromIndexedDB) {
            // Padakanaja not in memory - search from IndexedDB
            try {
                const padakanajaResults = await window.searchPadakanajaFromIndexedDB([word], 50);
                if (padakanajaResults && Array.isArray(padakanajaResults)) {
                    for (const result of padakanajaResults) {
                        const key = `${result.kannada}-${result.definition}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            anyWordResults.push(result);
                        }
                    }
                }
            } catch (error) {
                console.error('Error searching padakanaja from IndexedDB:', error);
            }
        } else {
            // Padakanaja search function not yet available (might still be loading)
            console.warn('searchPadakanajaFromIndexedDB not available - padakanaja may still be loading');
        }
        
        // Sort results: prioritize by position in definition, then alphabetically, then by length
        anyWordResults.sort((a, b) => {
            // Get priority for each result (using the matched word as search term)
            const aPriority = getDefinitionPriority(a.definition, a.matchedWord, a.kannada);
            const bPriority = getDefinitionPriority(b.definition, b.matchedWord, b.kannada);
            
            // Lower priority number = higher priority (comes first)
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            
            // Clean Kannada entries for comparison
            const aKannada = cleanKannadaEntry(a.kannada);
            const bKannada = cleanKannadaEntry(b.kannada);
            
            // If same priority and length category, sort alphabetically by Kannada word
            return aKannada.localeCompare(bKannada);
        });
        
        return anyWordResults;
    }
}

async function searchWithSynonyms(query) {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const isMultiWord = words.length > 1;
    const queryLower = query.toLowerCase().trim();
    
    // If Worker API is enabled, use Datamuse for word endings + synonyms + Worker API for search
    if (WORKER_API_URL) {
        // STEP 1: Get word endings FIRST (e.g., "escalation" -> "escalate", "escalating")
        // This is the most important - should be checked BEFORE synonyms!
        const wordEndings = await getWordEndings(queryLower);
        
        // STEP 2: Get actual synonyms (only rel_syn, no means-like or sounds-like)
        const synonyms = await getSynonyms(queryLower);
        
        // Limit synonyms to top 5 to reduce Worker load (prevents CPU limits)
        const limitedSynonyms = synonyms.slice(0, 5);
        
        // Combine: word endings first, then limited synonyms
        let relatedWords = [...new Set([...wordEndings, ...limitedSynonyms])];
        
        console.log(`🔍 Word endings for "${queryLower}": ${wordEndings.join(', ') || 'none'}`);
        console.log(`🔍 Synonyms for "${queryLower}": ${synonyms.join(', ') || 'none'}`);
        
        if (relatedWords.length === 0) {
            return { results: [], synonymsUsed: {} };
        }
        
        // Progressive loading: Search Worker API for each synonym word
        // Return results as they come in (via callback for progressive rendering)
        const results = [];
        const seen = new Set();
        const synonymsUsed = {};
        
        // Search related words with rate limiting (max 2 concurrent requests)
        // Reduced from 3 to 2 to prevent CPU limits (Worker does linear search)
        const BATCH_SIZE = 2;
        
        for (let i = 0; i < relatedWords.length; i += BATCH_SIZE) {
            const batch = relatedWords.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(async (relWord) => {
                try {
                    // Add timeout to prevent hanging requests
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
                    
                    const response = await fetch(`${WORKER_API_URL}?q=${encodeURIComponent(relWord)}`, {
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                        const data = await response.json();
                        const wordResults = [];
                        for (const result of data.results || []) {
                            const key = `${result.kannada}-${result.definition}`;
                            if (!seen.has(key)) {
                                seen.add(key);
                                if (!synonymsUsed[queryLower]) synonymsUsed[queryLower] = [];
                                if (!synonymsUsed[queryLower].includes(relWord)) {
                                    synonymsUsed[queryLower].push(relWord);
                                }
                                wordResults.push({
                                    kannada: result.kannada,
                                    phone: result.phone || '',
                                    definition: result.definition,
                                    type: result.type || 'Noun',
                                    head: result.head || '',
                                    id: result.id || '',
                                    dict_title: result.dict_title || '',
                                    source: result.source || '',
                                    matchedWord: relWord,
                                    originalQuery: queryLower,
                                    matchType: 'synonym'
                                });
                            }
                        }
                        return wordResults;
                    } else if (response.status === 503) {
                        // Rate limited or CPU limit - skip this synonym gracefully
                        console.warn(`⚠️ Worker rate limited for "${relWord}" (503) - skipping`);
                        return [];
                    } else {
                        console.warn(`Failed to search synonym "${relWord}": ${response.status}`);
                        return [];
                    }
                } catch (error) {
                    if (error.name === 'AbortError') {
                        console.warn(`⚠️ Timeout searching synonym "${relWord}" - skipping`);
                    } else {
                        console.warn(`Failed to search synonym "${relWord}":`, error);
                    }
                    return [];
                }
            });
            
            // Wait for batch to complete before starting next batch
            const batchResults = await Promise.all(batchPromises);
            for (const wordResults of batchResults) {
                if (Array.isArray(wordResults)) {
                    results.push(...wordResults);
                }
            }
            
            // Longer delay between batches to avoid CPU limits (Worker needs time to process)
            if (i + BATCH_SIZE < relatedWords.length) {
                await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay (increased from 200ms)
            }
        }
        
        return { results, synonymsUsed };
    }
    
    // Client-side synonym search (original logic)
    
    // Check if padakanaja is in memory (reuse this check throughout the function)
    let hasPadakanajaInMemory = false;
    for (let i = 0; i < dictionary.length; i++) {
        if (dictionary[i].source && dictionary[i].source !== 'alar') {
            hasPadakanajaInMemory = true;
            break;
        }
    }
    
    // For multi-word queries, first try to get synonyms for the whole phrase
    if (isMultiWord) {
        const queryLower = query.toLowerCase().trim();
            // Get word forms and synonyms first
            const [wordForms, synonyms] = await Promise.all([
                getWordForms(queryLower),
                getSynonyms(queryLower)
            ]);
            
            // Only use similar words if we don't have enough good synonyms
            let relatedWords = [...new Set([...wordForms, ...synonyms])];
            
            // Only add similar words if we have very few results (less than 3)
            if (relatedWords.length < 3) {
                const similar = await getSimilarWords(queryLower);
                relatedWords = [...new Set([...relatedWords, ...similar])];
            }
        
        // If synonyms exist for the whole phrase, use them and return early
        if (relatedWords.length > 0) {
            const results = [];
            const seen = new Set();
            const synonymsUsed = {};
            
            for (const relWord of relatedWords) {
                // Search reverse index (Alar entries)
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
                
                // Also search padakanaja entries (English->Kannada)
                // Check if padakanaja is in memory first
                if (hasPadakanajaInMemory) {
                    // Padakanaja is in memory - search from memory
                    for (let i = 0; i < dictionary.length; i++) {
                        const entry = dictionary[i];
                        // Skip Alar entries (they're in reverse index)
                        if (entry.source === 'alar') continue;
                        
                        if (!entry.defs) continue;
                        
                        for (const def of entry.defs) {
                            if (!def.entry) continue;
                            // Check if definition contains the synonym word (as whole word)
                            if (containsWholeWord(def.entry, relWord)) {
                                const key = `${entry.entry}-${def.entry}`;
                                if (!seen.has(key)) {
                                    seen.add(key);
                                    if (!synonymsUsed[queryLower]) synonymsUsed[queryLower] = [];
                                    if (!synonymsUsed[queryLower].includes(relWord)) {
                                        synonymsUsed[queryLower].push(relWord);
                                    }
                                    results.push({
                                        kannada: cleanKannadaEntry(entry.entry),
                                        phone: entry.phone || '',
                                        definition: def.entry,
                                        type: normalizeType(def.type || ''),
                                        head: entry.head || '',
                                        id: entry.id || '',
                                        dict_title: entry.dict_title || '',
                                        source: entry.source || '',
                                        matchedWord: relWord,
                                        originalQuery: queryLower,
                                        matchType: 'synonym'
                                    });
                                }
                            }
                        }
                    }
                } else if (window.searchPadakanajaFromIndexedDB) {
                    // Padakanaja not in memory - search from IndexedDB
                    try {
                        const padakanajaResults = await window.searchPadakanajaFromIndexedDB([relWord], 20);
                        if (padakanajaResults && Array.isArray(padakanajaResults)) {
                            for (const result of padakanajaResults) {
                                const key = `${result.kannada}-${result.definition}`;
                                if (!seen.has(key)) {
                                    seen.add(key);
                                    if (!synonymsUsed[queryLower]) synonymsUsed[queryLower] = [];
                                    if (!synonymsUsed[queryLower].includes(relWord)) {
                                        synonymsUsed[queryLower].push(relWord);
                                    }
                                    results.push({
                                        ...result,
                                        matchedWord: relWord,
                                        originalQuery: queryLower,
                                        matchType: 'synonym'
                                    });
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error searching padakanaja synonyms from IndexedDB:', error);
                    }
                }
            }
            
            // Sort by priority first, then alphabetically
            results.sort((a, b) => {
                const aPriority = getDefinitionPriority(a.definition, a.matchedWord || '', a.kannada);
                const bPriority = getDefinitionPriority(b.definition, b.matchedWord || '', b.kannada);
                if (aPriority !== bPriority) {
                    return aPriority - bPriority;
                }
                const aKannada = cleanKannadaEntry(a.kannada);
                const bKannada = cleanKannadaEntry(b.kannada);
                return aKannada.localeCompare(bKannada);
            });
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
            // Get word forms first, then synonyms
            const [wordForms, synonyms] = await Promise.all([
                getWordForms(word),
                getSynonyms(word)
            ]);
            
            // Only use similar words if we don't have enough good synonyms
            // This avoids getting bad matches from ml endpoint
            let relatedWords = [...new Set([...wordForms, ...synonyms])];
            
            // Only add similar words if we have very few results (less than 3)
            // This way we avoid bad matches like "curing", "charlatan", etc.
            if (relatedWords.length < 3) {
                const similar = await getSimilarWords(word);
                relatedWords = [...new Set([...relatedWords, ...similar])];
            }
        
        for (const relWord of relatedWords) {
            // Search reverse index (Alar entries)
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
            
            // Also search padakanaja entries (English->Kannada)
            // Check if padakanaja is in memory first (reuse check from function start)
            if (hasPadakanajaInMemory) {
                // Padakanaja is in memory - search from memory
                for (let i = 0; i < dictionary.length; i++) {
                    const entry = dictionary[i];
                    // Skip Alar entries (they're in reverse index)
                    if (entry.source === 'alar') continue;
                    
                    if (!entry.defs) continue;
                    
                    for (const def of entry.defs) {
                        if (!def.entry) continue;
                        // Check if definition contains the synonym word (as whole word)
                        if (containsWholeWord(def.entry, relWord)) {
                            const key = `${entry.entry}-${def.entry}`;
                            if (!seen.has(key)) {
                                seen.add(key);
                                if (!synonymsUsed[word]) synonymsUsed[word] = [];
                                if (!synonymsUsed[word].includes(relWord)) {
                                    synonymsUsed[word].push(relWord);
                                }
                                results.push({
                                    kannada: cleanKannadaEntry(entry.entry),
                                    phone: entry.phone || '',
                                    definition: def.entry,
                                    type: normalizeType(def.type || ''),
                                    head: entry.head || '',
                                    id: entry.id || '',
                                    dict_title: entry.dict_title || '',
                                    source: entry.source || '',
                                    matchedWord: relWord,
                                    originalQuery: word,
                                    matchType: 'synonym'
                                });
                            }
                        }
                    }
                }
            } else if (window.searchPadakanajaFromIndexedDB) {
                // Padakanaja not in memory - search from IndexedDB
                try {
                    const padakanajaResults = await window.searchPadakanajaFromIndexedDB([relWord], 20);
                    if (padakanajaResults && Array.isArray(padakanajaResults)) {
                        for (const result of padakanajaResults) {
                            const key = `${result.kannada}-${result.definition}`;
                            if (!seen.has(key)) {
                                seen.add(key);
                                if (!synonymsUsed[word]) synonymsUsed[word] = [];
                                if (!synonymsUsed[word].includes(relWord)) {
                                    synonymsUsed[word].push(relWord);
                                }
                                results.push({
                                    ...result,
                                    matchedWord: relWord,
                                    originalQuery: word,
                                    matchType: 'synonym'
                                });
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error searching padakanaja synonyms from IndexedDB:', error);
                }
            }
        }
    }
    
    // Sort results: prioritize exact definitions, especially those matching the search term
    const exactCount = results.filter(r => isExactDefinition(r.definition)).length;
    console.log(`Synonym search - Total: ${results.length}, Exact definitions: ${exactCount}`);
    
    results.sort((a, b) => {
        // Get priority for each result (using the matched word as search term)
        const aPriority = getDefinitionPriority(a.definition, a.matchedWord, a.kannada);
        const bPriority = getDefinitionPriority(b.definition, b.matchedWord, b.kannada);
        
        // Lower priority number = higher priority (comes first)
        if (aPriority !== bPriority) {
            return aPriority - bPriority;
        }
        
        // Clean Kannada entries for comparison
        const aKannada = cleanKannadaEntry(a.kannada);
        const bKannada = cleanKannadaEntry(b.kannada);
        
        // If same priority, sort alphabetically by Kannada word
        return aKannada.localeCompare(bKannada);
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
