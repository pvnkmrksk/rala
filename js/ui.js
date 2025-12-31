// ============================================================================
// ui.js - UI rendering functions: results display and result cards
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

function renderResults(directResults, synonymResults, synonymsUsed, query, loadingDirect = false, loadingIndirect = false, showDirectMobileLimit = false, showSynonymMobileLimit = false) {
    let html = '';
    
    // Only show "no results" if we're not loading and have no results
    // Don't show it during loading state (prevents "0 results" flash)
    if (directResults.length === 0 && synonymResults.length === 0 && !loadingDirect && !loadingIndirect) {
        return `
            <div class="no-results">
                <p>No results found for "${query}"</p>
                <p style="font-size: 14px; margin-top: 8px;">Try a different word or check spelling</p>
            </div>
        `;
    }
    
    // If loading and no results yet, show loading state (not "0 results")
    if (loadingDirect && directResults.length === 0) {
        // Loading state will be shown in the section below
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
    
    // Mobile limit notice for direct results
    if (showDirectMobileLimit) {
        html += `
            <div style="padding: 12px; margin-bottom: 16px; background: var(--bg-secondary); border-radius: 8px; font-size: 14px; color: var(--text-color-lighter);">
                Showing first 500 results. <strong>${directResults.length}+</strong> total results found.
            </div>
        `;
    }
    
    // Exact matches section
    const directCount = showDirectMobileLimit ? '500+' : directResults.length;
    html += `
        <div class="results-section section-anchor" id="exact-matches">
            <div class="section-header">Exact Match${directResults.length !== 1 ? 'es' : ''} (${directCount})</div>
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
    const synonymCount = showSynonymMobileLimit ? '500+' : synonymResults.length;
    html += `
        <div class="results-section section-anchor" id="synonym-matches">
            <div class="section-header">Synonym Match${synonymResults.length !== 1 ? 'es' : ''} (${synonymCount})</div>
    `;
    
    // Mobile limit notice for synonyms
    if (showSynonymMobileLimit) {
        html += `
            <div style="padding: 12px; margin-bottom: 16px; background: var(--bg-secondary); border-radius: 8px; font-size: 14px; color: var(--text-color-lighter);">
                Showing first 500 results. <strong>${synonymResults.length}+</strong> total synonym results found.
            </div>
        `;
    }
    
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

// getAudioUrl is now in utils.js and supports both Alar and Padakanaja

// checkAudioExists is now in utils.js and supports both Alar and Padakanaja

// checkAndUpdateAudioButtons is now in utils.js and supports both Alar and Padakanaja

function renderResultCard(result, query, isSynonym = false) {
    const highlightedDef = highlightMatch(result.definition, result.matchedWord, result.matchType);
    const source = result.source || 'alar';
    const audioUrl = result.id ? getAudioUrl(result.id, source) : null;
    const audioId = `audio-${result.id || 'no-id'}-${result.kannada.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const copyId = `copy-${result.id || 'no-id'}-${result.kannada.replace(/[^a-zA-Z0-9]/g, '-')}`;
    
    // Check cache first - if we know it doesn't exist, don't show button
    // If unknown, show it and check asynchronously
    // Support both Alar and Padakanaja sources
    let showButton = false;
    if (audioUrl && result.id) {
        const cacheKey = `${source}:${result.id}`;
        const cached = audioExistenceCache.get(cacheKey);
        if (cached === true) {
            showButton = true; // We know it exists
        } else if (cached === false) {
            showButton = false; // We know it doesn't exist
        } else {
            showButton = true; // Unknown - show it and check later
        }
    }
    
    // Get source display text and link
    let sourceText, sourceLink, sourceTextKannada;
    if (result.source === 'alar') {
        sourceText = PRIMARY_DICTIONARY.dictTitle;
        sourceTextKannada = PRIMARY_DICTIONARY.dictTitleKannada;
        // Link directly to the specific word in Alar dictionary
        // Format: https://alar.ink/dictionary/kannada/english/{urlEncodedKannadaWord}
        const kannadaWord = cleanKannadaEntry(result.kannada);
        if (kannadaWord) {
            const encodedWord = encodeURIComponent(kannadaWord);
            sourceLink = `https://alar.ink/dictionary/kannada/english/${encodedWord}`;
        } else {
            sourceLink = PRIMARY_DICTIONARY.link;
        }
    } else if (result.dict_title) {
        sourceText = result.dict_title;
        sourceLink = PADAKANAJA_BASE_URL;
    } else {
        sourceText = result.source || '';
        sourceLink = PADAKANAJA_BASE_URL;
    }
    
    const sourceId = `source-${result.id || 'no-id'}-${result.kannada.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const escapedSourceText = sourceText.replace(/'/g, "&#39;").replace(/"/g, '&quot;');
    const escapedSourceTextKannada = (sourceTextKannada || '').replace(/'/g, "&#39;").replace(/"/g, '&quot;');
    const tooltipText = sourceTextKannada ? `${escapedSourceTextKannada}<br>${escapedSourceText}` : escapedSourceText;
    
    const sourceDisplay = sourceText ? `
        <span class="dict-source-wrapper">
            <a href="${sourceLink}" target="_blank" rel="noopener noreferrer" class="dict-source" id="${sourceId}" data-source-text="${escapedSourceText}">[source]</a>
            <div class="dict-source-tooltip" id="${sourceId}-tooltip">${tooltipText}</div>
        </span>
    ` : '';
    
    return `
        <div class="result-card">
            <div class="kannada-word">
                ${showButton && audioUrl ? `
                    <button class="audio-button" id="${audioId}" data-entry-id="${result.id || ''}" data-source="${source}" onclick="playAudio('${audioId}', '${audioUrl.replace(/'/g, "\\'")}')" title="Play pronunciation">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                    </button>
                ` : ''}
                <span>${cleanKannadaEntry(result.kannada)}</span>
                ${sourceDisplay}
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
