// ============================================================================
// search.js - Search functions: direct search, synonym search, highlighting
// ============================================================================

// Clean Kannada entry text - remove brackets, parentheses, and other non-text characters
function cleanKannadaEntry(text) {
    if (!text) return '';
    // Remove brackets: [], (), {}, 【】, 「」, etc.
    let cleaned = text.replace(/[\[\](){}【】「」〈〉《》『』〔〕［］（）｛｝]/g, '');
    // Remove other common punctuation that shouldn't be in dictionary keys
    cleaned = cleaned.replace(/[<>"']/g, '');
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

function getDefinitionPriority(definition, searchWord, kannadaEntry = '') {
    // Higher priority = comes first (lower number = higher priority)
    // Priority 0: Exact full-word match (definition is exactly the search word, nothing else)
    // Priority 1: Search term fully between ";" and "." at the end (e.g., "; a test." or "; north-east.")
    // Priority 2: Search term at the end (before the final period)
    // Priority 3: Other definitions
    
    if (!definition) return 3;
    const trimmed = definition.trim();
    const trimmedLower = trimmed.toLowerCase();
    const searchLower = searchWord.toLowerCase();
    
    // Escape special regex characters in search word
    const escapedSearch = searchLower.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    
    // Priority 0: Exact full-word match - definition is exactly the search word (case-insensitive)
    // Remove trailing period if present for comparison
    const trimmedNoPeriod = trimmed.replace(/\.\s*$/, '').trim();
    if (trimmedNoPeriod.toLowerCase() === searchLower) {
        return 0; // Absolute highest priority
    }
    
    // Priority 1: Check if search term is fully between ";" and "." at the end
    // Pattern: "; ... searchWord." - the search term must be between a semicolon and the final period
    // We want to match: "; [anything] searchWord." where there's a semicolon before and period after
    const betweenSemicolonAndPeriod = new RegExp(`;\\s+[^;]*?${escapedSearch}\\s*\\.\\s*$`, 'i');
    if (betweenSemicolonAndPeriod.test(trimmed)) {
        return 1; // Second highest priority
    }
    
    // Priority 2: Check if search term is at the end (before final period, but not necessarily after semicolon)
    // Pattern: "... searchWord." or "... searchWord ."
    const atEndPattern = new RegExp(`${escapedSearch}\\s*\\.\\s*$`, 'i');
    if (atEndPattern.test(trimmed)) {
        return 2; // Third priority
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
    
    // If wildcards are present (but not auto-wildcard for 2 words), search all definitions directly
    if (hasWildcard && !isAutoWildcard) {
        const results = [];
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
            const aIsLong = isLongPhrase(aKannada);
            const bIsLong = isLongPhrase(bKannada);
            // Long phrases go to bottom
            if (aIsLong !== bIsLong) {
                return aIsLong ? 1 : -1;
            }
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
            const aIsLong = isLongPhrase(aKannada);
            const bIsLong = isLongPhrase(bKannada);
            // Long phrases go to bottom
            if (aIsLong !== bIsLong) {
                return aIsLong ? 1 : -1;
            }
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
        
        // Search padakanaja entries directly (English->Kannada, no reverse index)
        for (let i = 0; i < dictionary.length; i++) {
            const entry = dictionary[i];
            // Skip Alar entries (they're in reverse index)
            if (entry.source === 'alar') continue;
            
            if (!entry.defs) continue;
            
            for (const def of entry.defs) {
                if (!def.entry) continue;
                const defLower = def.entry.toLowerCase();
                
                // Check if definition contains the word
                if (defLower.includes(word)) {
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
            const aIsLong = isLongPhrase(aKannada);
            const bIsLong = isLongPhrase(bKannada);
            // Long phrases go to bottom
            if (aIsLong !== bIsLong) {
                return aIsLong ? 1 : -1;
            }
            
            // If same priority and length category, sort alphabetically by Kannada word
            return aKannada.localeCompare(bKannada);
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
            
            // Sort alphabetically by Kannada word, then by length (long phrases at bottom)
            results.sort((a, b) => {
                const aKannada = cleanKannadaEntry(a.kannada);
                const bKannada = cleanKannadaEntry(b.kannada);
                const aIsLong = isLongPhrase(aKannada);
                const bIsLong = isLongPhrase(bKannada);
                // Long phrases go to bottom
                if (aIsLong !== bIsLong) {
                    return aIsLong ? 1 : -1;
                }
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
        const aPriority = getDefinitionPriority(a.definition, a.matchedWord, a.kannada);
        const bPriority = getDefinitionPriority(b.definition, b.matchedWord, b.kannada);
        
        // Lower priority number = higher priority (comes first)
        if (aPriority !== bPriority) {
            return aPriority - bPriority;
        }
        
        // Clean Kannada entries for comparison
        const aKannada = cleanKannadaEntry(a.kannada);
        const bKannada = cleanKannadaEntry(b.kannada);
        const aIsLong = isLongPhrase(aKannada);
        const bIsLong = isLongPhrase(bKannada);
        // Long phrases go to bottom
        if (aIsLong !== bIsLong) {
            return aIsLong ? 1 : -1;
        }
        
        // If same priority and length category, sort alphabetically by Kannada word
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
