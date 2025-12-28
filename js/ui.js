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
    // Skip non-Alar sources as they don't have audio files
    const entryIds = [...new Set(results
        .filter(r => r.id && r.source === 'alar')
        .map(r => r.id)
        .filter(id => !audioExistenceCache.has(id)))];
    
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
    // Skip audio for non-Alar sources (they don't have audio files)
    let showButton = false;
    if (audioUrl && result.id && result.source === 'alar') {
        const cached = audioExistenceCache.get(result.id);
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
        sourceLink = PRIMARY_DICTIONARY.link;
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
                    <button class="audio-button" id="${audioId}" data-entry-id="${result.id || ''}" onclick="playAudio('${audioId}', '${audioUrl.replace(/'/g, "\\'")}')" title="Play pronunciation">
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
