// ============================================================================
// app.js - Main application initialization and event handlers
// ============================================================================

// Initialize
async function init() {
    const initStartTime = performance.now();
    console.log('🚀 RALA v2.2 - INIT STARTING (NEW VERSION - CHECK THIS MESSAGE!)');
    
    try {
        // Initialize dark mode first
        initDarkMode();
        
        // Initialize sidebar
        initSidebar();
        
        // Remove loading spinner immediately (no animation, instant)
        const loadingEl = document.getElementById('initial-loading');
        if (loadingEl) {
            loadingEl.remove();
            console.log('✅ Loading spinner removed immediately');
        } else {
            console.warn('⚠️ Loading spinner not found (may have been removed already)');
        }
        
        // If Worker API is available, load Alar from YAML (fast, original way) - async in background
        // Padakanaja will be loaded on-demand via API (like synonyms)
        if (!WORKER_API_URL) {
            await loadDictionary();
            // buildReverseIndex is now only needed if pre-built index fails (handled in loadDictionary)
            // Don't call it here as it's already handled
        } else {
            console.log('🚀 Worker API enabled - loading Alar in background');
            
            // Pre-warm Worker with a known word (elytra) and verify response
            // This ensures the API is actually ready before allowing searches
            const preWarmStartTime = performance.now();
            workerApiReadyPromise = fetch(`${WORKER_API_URL}?q=elytra`)
                .then(async (response) => {
                    if (!response.ok) {
                        throw new Error(`Worker API returned ${response.status}`);
                    }
                    const data = await response.json();
                    // Verify we got actual results (elytra should return results)
                    if (!data || !data.results || !Array.isArray(data.results)) {
                        throw new Error('Worker API returned invalid response format');
                    }
                    const preWarmTime = performance.now() - preWarmStartTime;
                    workerApiReady = true;
                    console.log(`🔥 Pre-warm Worker API verified: ${preWarmTime.toFixed(0)}ms (${data.results.length} results for "elytra")`);
                    return true;
                })
                .catch(error => {
                    const preWarmTime = performance.now() - preWarmStartTime;
                    console.warn(`⚠️ Pre-warm Worker API failed (${preWarmTime.toFixed(0)}ms):`, error);
                    // Still mark as ready after a delay to allow retries
                    setTimeout(() => {
                        workerApiReady = true;
                        console.log('⚠️ Worker API marked as ready despite pre-warm failure (will retry on search)');
                    }, 2000);
                    return false;
                });
            
            // Load Alar from YAML async in background (don't block UI)
            const alarLoadStartTime = performance.now();
            loadAlarFromYAML()
                .then(() => {
                    const alarLoadTime = performance.now() - alarLoadStartTime;
                    dictionaryReady = true;
                    console.log(`✓ Alar loaded in background: ${alarLoadTime.toFixed(0)}ms`);
                })
                .catch(error => {
                    const alarLoadTime = performance.now() - alarLoadStartTime;
                    console.error(`❌ Failed to load Alar in background (${alarLoadTime.toFixed(0)}ms):`, error);
                    dictionaryReady = true; // Mark ready anyway (Worker API will still work)
                });
            
            dictionaryReady = true; // Mark as ready immediately (UI doesn't wait)
            
            // Log total init time
            const initTime = performance.now() - initStartTime;
            console.log(`⚡ Site ready in: ${initTime.toFixed(0)}ms (v2.2 - NEW VERSION)`);
        }
        
        // Remove loading message (already done above, but keep this for non-Worker path)
        const removeLoading = () => {
            const loadingEl = app.querySelector('.loading');
            if (loadingEl && dictionaryReady) {
                loadingEl.remove();
                return true;
            }
            return false;
        };
        
        if (!WORKER_API_URL) {
            // Try immediately first (Alar might already be loaded from cache)
            if (!removeLoading()) {
                // If not ready yet, check every 50ms (faster on mobile) until ready
                const checkInterval = setInterval(() => {
                    if (removeLoading()) {
                        clearInterval(checkInterval);
                    }
                }, 50);
                
                // Stop checking after 3 seconds (faster fallback on mobile)
                setTimeout(() => {
                    clearInterval(checkInterval);
                    // Force remove if still there (Alar should be ready by now)
                    const loadingEl = app.querySelector('.loading');
                    if (loadingEl) {
                        console.warn('Force removing loading spinner after timeout');
                        loadingEl.remove();
                    }
                }, 3000);
            }
        }
        
        // Check URL for initial query before rendering
        const urlQuery = getQueryFromURL();
        
        // If there's an initial query and Worker API is enabled, wait for it to be ready
        if (urlQuery && WORKER_API_URL && typeof workerApiReadyPromise !== 'undefined' && workerApiReadyPromise !== null) {
            workerApiReadyPromise.then(() => {
                renderApp(urlQuery);
            }).catch(() => {
                // Still render even if pre-warm failed
                renderApp(urlQuery);
            });
        } else {
            renderApp(urlQuery);
        }
    } catch (error) {
        app.innerHTML = `
            <div class="status" style="color: #e74c3c;">
                <p>❌ Failed to load dictionary: ${error.message}</p>
                <p style="font-size: 14px;">Try refreshing the page or check your internet connection.</p>
            </div>
        `;
    }
}
function renderApp(initialQuery = '') {
    app.innerHTML = `
        <div id="results" class="results-container"></div>
        <div class="stats">
            ${WORKER_API_URL ? '478,680 entries | 103,585 unique English words' : `${dictionary.length.toLocaleString()} total entries | ${reverseIndex.size.toLocaleString()} unique English words indexed`}
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
    const searchSuggestions = document.getElementById('search-suggestions');
    
    let directResults = [];
    let synonymResults = [];
    let synonymsUsed = {};
    let currentQuery = '';
    let autocompleteTimer = null;
    let synonymSearchInProgress = false;
    let synonymSearchCompleted = false;
    let synonymSearchTimeout = null;
    let autocompleteWords = [];
    let autocompleteLoaded = false;
    let autocompleteLoadPromise = null;
    let searchSessionId = 0;
    let suggestionItems = [];
    let activeSuggestionIndex = -1;
    let lastSuggestionSignature = '';
    let firstSearchCompleteEventSent = false;

    async function loadAutocompleteWords() {
        if (autocompleteLoaded) return autocompleteWords;
        if (autocompleteLoadPromise) return autocompleteLoadPromise;
        autocompleteLoadPromise = fetch(GLOSSARY_WORDS_URL)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to load autocomplete words: ${response.status}`);
                }
                return response.json();
            })
            .then((words) => {
                autocompleteWords = Array.isArray(words) ? words : [];
                autocompleteLoaded = true;
                return autocompleteWords;
            })
            .catch((error) => {
                console.warn('Autocomplete disabled (failed to load words):', error);
                autocompleteWords = [];
                autocompleteLoaded = true;
                return autocompleteWords;
            });
        return autocompleteLoadPromise;
    }

    function getSuggestionMatches(rawQuery) {
        const query = rawQuery.trim().toLowerCase();
        if (query.length < 3 || autocompleteWords.length === 0) {
            return [];
        }

        const prefixMatches = [];
        const containsMatches = [];
        for (let i = 0; i < autocompleteWords.length; i++) {
            const word = autocompleteWords[i];
            const normalized = String(word).toLowerCase();
            if (normalized.startsWith(query)) {
                prefixMatches.push(word);
            } else if (query.length >= 3 && normalized.includes(query)) {
                containsMatches.push(word);
            }
            if (prefixMatches.length >= 7 && containsMatches.length >= 5) {
                break;
            }
        }

        const seen = new Set();
        const merged = [];
        // Always include the exact typed token first so root forms are never hidden.
        merged.push(rawQuery.trim());
        seen.add(rawQuery.trim().toLowerCase());

        [...prefixMatches, ...containsMatches].forEach((word) => {
            const key = String(word).toLowerCase();
            if (!seen.has(key) && merged.length < 8) {
                seen.add(key);
                merged.push(word);
            }
        });

        return merged;
    }

    function hideSuggestions() {
        if (!searchSuggestions) return;
        searchSuggestions.classList.remove('show');
        searchSuggestions.style.display = 'none';
        activeSuggestionIndex = -1;
    }

    function renderSuggestions(matches) {
        if (!searchSuggestions) return;
        const signature = matches.join('|');
        if (signature === lastSuggestionSignature) {
            return;
        }
        lastSuggestionSignature = signature;
        activeSuggestionIndex = -1;
        searchSuggestions.innerHTML = '';
        suggestionItems = [];

        matches.forEach((word, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'search-suggestion-item';
            btn.textContent = word;
            btn.setAttribute('aria-label', `Suggestion ${word}`);
            btn.addEventListener('mousedown', (e) => {
                // Prevent blur/focus flicker before click resolves.
                e.preventDefault();
            });
            btn.addEventListener('click', () => {
                searchInput.value = word;
                hideSuggestions();
                performSearch(word, true);
            });
            searchSuggestions.appendChild(btn);
            suggestionItems.push(btn);
        });

        if (matches.length === 0) {
            hideSuggestions();
            return;
        }
        searchSuggestions.style.display = 'block';
        // Trigger CSS transition in next frame.
        requestAnimationFrame(() => {
            searchSuggestions.classList.add('show');
        });
    }

    function updateSearchSuggestions(rawQuery) {
        if (!searchSuggestions) return;
        const merged = getSuggestionMatches(rawQuery);
        renderSuggestions(merged);
    }

    function moveSuggestionSelection(direction) {
        if (!suggestionItems.length) return;
        if (activeSuggestionIndex >= 0 && suggestionItems[activeSuggestionIndex]) {
            suggestionItems[activeSuggestionIndex].classList.remove('active');
        }
        activeSuggestionIndex += direction;
        if (activeSuggestionIndex < 0) activeSuggestionIndex = suggestionItems.length - 1;
        if (activeSuggestionIndex >= suggestionItems.length) activeSuggestionIndex = 0;
        const item = suggestionItems[activeSuggestionIndex];
        item.classList.add('active');
        searchInput.value = item.textContent || '';
    }
    
    function switchTab(tabName) {
        if (tabName === 'exact') {
            tabExact.classList.add('active');
            tabSynonym.classList.remove('active');
            const exactSection = document.getElementById('exact-matches');
            if (exactSection) {
                setTimeout(() => {
                    const searchHeight = document.querySelector('.sticky-search').offsetHeight;
                    const offset = searchHeight;
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
                    const offset = searchHeight;
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
    
    async function loadSynonyms(query, sessionId = searchSessionId) {
        if (sessionId !== searchSessionId) return;
        if (synonymSearchInProgress || synonymSearchCompleted) {
            return;
        }
        
        synonymSearchInProgress = true;
        tabSynonymSpinner.style.display = 'inline-block';
        
        // For Worker API, show progressive loading as results come in
        if (WORKER_API_URL) {
            // Start with empty synonym results, will update progressively
            synonymResults = [];
            synonymsUsed = {};
            
            // Progressive loading callback - update UI as results come in (flowing like a river)
            let lastResultCount = 0;
            const progressCallback = (currentResults, currentSynonymsUsed) => {
                if (sessionId !== searchSessionId) return;
                // Filter out synonym results that are already in direct results
                const directKeys = new Set(directResults.map(r => `${r.kannada}-${r.definition}`));
                const filteredResults = currentResults.filter(r => 
                    !directKeys.has(`${r.kannada}-${r.definition}`)
                );
                
                synonymResults = filteredResults;
                synonymsUsed = currentSynonymsUsed;
                tabSynonymCount.textContent = ` (${synonymResults.length})`;
                
                // Update UI progressively (only if synonym tab is active)
                if (tabSynonym.classList.contains('active')) {
                    // Only animate NEW results (the ones that just appeared)
                    const newCount = synonymResults.length - lastResultCount;
                    lastResultCount = synonymResults.length;
                    
                    resultsDiv.innerHTML = renderResults(directResults, synonymResults, synonymsUsed, query, false, true);
                    
                    // Animate only the NEW results (flowing in smoothly)
                    requestAnimationFrame(() => {
                        const synonymSection = document.getElementById('synonym-matches');
                        if (synonymSection) {
                            const resultCards = synonymSection.querySelectorAll('.result-card');
                            // Animate only the last N cards (the new ones)
                            const startIndex = Math.max(0, resultCards.length - newCount);
                            resultCards.forEach((card, index) => {
                                if (index < startIndex) {
                                    // Already visible, keep it visible
                                    card.style.opacity = '1';
                                    card.style.transform = 'translateY(0)';
                                } else {
                                    // New card - animate in (like a bubble rising)
                                    card.style.opacity = '0';
                                    card.style.transform = 'translateY(15px)';
                                    setTimeout(() => {
                                        card.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
                                        card.style.opacity = '1';
                                        card.style.transform = 'translateY(0)';
                                    }, (index - startIndex) * 50); // Stagger new results
                                }
                            });
                        }
                    });
                }
            };
            
            // Perform search with progressive callback
            const { results: synonymResultsTemp, synonymsUsed: synonymsUsedTemp } = await searchWithSynonyms(query, progressCallback);
            if (sessionId !== searchSessionId) return;
            
            // Filter out synonym results that are already in direct results
            const directKeys = new Set(directResults.map(r => `${r.kannada}-${r.definition}`));
            let allSynonymResults = synonymResultsTemp.filter(r => 
                !directKeys.has(`${r.kannada}-${r.definition}`)
            );
            
            // Mobile: Limit synonym results
            const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const MOBILE_LIMIT = 500;
            const originalSynonymCount = allSynonymResults.length;
            if (isMobile && allSynonymResults.length > MOBILE_LIMIT) {
                synonymResults = allSynonymResults.slice(0, MOBILE_LIMIT);
            } else {
                synonymResults = allSynonymResults;
            }
            synonymsUsed = synonymsUsedTemp;
        } else {
            // Client-side: normal flow
            const { results: synonymResultsTemp, synonymsUsed: synonymsUsedTemp } = await searchWithSynonyms(query);
            if (sessionId !== searchSessionId) return;
            
            // Filter out synonym results that are already in direct results
            const directKeys = new Set(directResults.map(r => `${r.kannada}-${r.definition}`));
            let allSynonymResults = synonymResultsTemp.filter(r => 
                !directKeys.has(`${r.kannada}-${r.definition}`)
            );
            
            // Mobile: Limit synonym results
            const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const MOBILE_LIMIT = 500;
            const originalSynonymCount = allSynonymResults.length;
            if (isMobile && allSynonymResults.length > MOBILE_LIMIT) {
                synonymResults = allSynonymResults.slice(0, MOBILE_LIMIT);
            } else {
                synonymResults = allSynonymResults;
            }
            synonymsUsed = synonymsUsedTemp;
        }
        
        const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const MOBILE_LIMIT = 500;
        const originalSynonymCount = synonymResults.length;
        const displaySynonymCount = (isMobile && originalSynonymCount > MOBILE_LIMIT) ? '500+' : synonymResults.length;
        tabSynonymCount.textContent = ` (${displaySynonymCount})`;
        tabSynonymSpinner.style.display = 'none';
        synonymSearchCompleted = true;
        
        // Update UI with both results (progressive rendering with animation)
        const showSynonymMobileLimit = isMobile && originalSynonymCount > MOBILE_LIMIT;
        resultsDiv.innerHTML = renderResults(directResults, synonymResults, synonymsUsed, query, false, false, false, showSynonymMobileLimit);
        
        // Trigger CSS animation for synonym results
        requestAnimationFrame(() => {
            if (sessionId !== searchSessionId) return;
            const synonymSection = document.getElementById('synonym-matches');
            if (synonymSection) {
                const resultCards = synonymSection.querySelectorAll('.result-card');
                resultCards.forEach((card, index) => {
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(10px)';
                    setTimeout(() => {
                        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    }, index * 20); // Stagger animation
                });
            }
        });
    }
    
    async function performSearch(query, fromEnter = false, skipURLUpdate = false) {
        const sessionId = ++searchSessionId;
        hideSuggestions();
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
        
        // Show loading state for direct matches (don't show "0 results" message)
        resultsDiv.innerHTML = renderResults([], [], {}, query, true, false);
        switchTab('exact');
        
        // Step 1: Search direct matches with progressive rendering
        const startTime = performance.now();
        
        // Start search (non-blocking for UI updates)
        const searchPromise = searchDirect(query);

        directResults = await searchPromise;
        if (sessionId !== searchSessionId) return;
        
        const searchTime = performance.now() - startTime;
        console.log(`Search completed in ${searchTime.toFixed(0)}ms`);

        if (!firstSearchCompleteEventSent) {
            firstSearchCompleteEventSent = true;
            window.dispatchEvent(new CustomEvent('rala:first-search-complete', {
                detail: {
                    query,
                    directResultCount: directResults.length
                }
            }));
        }
        
        // Mobile: Limit to 500 results, show "500+"
        const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const MOBILE_LIMIT = 500;
        const originalCount = directResults.length;
        let displayCount = originalCount;
        let displayResults = directResults;
        
        if (isMobile && originalCount > MOBILE_LIMIT) {
            displayResults = directResults.slice(0, MOBILE_LIMIT);
            displayCount = `${MOBILE_LIMIT}+`;
        }
        
        tabExactCount.textContent = ` (${displayCount})`;
        tabExactSpinner.style.display = 'none';
        
        // Render once to avoid count/result mismatches from progressive batch updates.
        resultsDiv.innerHTML = renderResults(
            displayResults,
            [],
            {},
            query,
            false,
            false,
            isMobile && originalCount > MOBILE_LIMIT
        );
        
        // Trigger CSS animation for results
        requestAnimationFrame(() => {
            const resultCards = resultsDiv.querySelectorAll('.result-card');
            resultCards.forEach((card, index) => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(10px)';
                setTimeout(() => {
                    card.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, index * 10); // Faster stagger for smoother feel
            });
        });
        
        // Step 2: Auto-trigger synonym search if no direct results, or load synonyms with delay
        // Synonym search now works with Worker API (uses client-side Datamuse + Worker API)
        if (directResults.length === 0) {
            // No direct results - automatically trigger synonym search with progressive loading
            console.log('No direct results found, automatically searching synonyms...');
            tabSynonymSpinner.style.display = 'inline-block';
            synonymSearchInProgress = true;
            synonymResults = [];
            synonymsUsed = {};
            
            // Switch to synonym tab immediately to show progress
            switchTab('synonym');
            resultsDiv.innerHTML = renderResults([], [], {}, query, false, true);
            
            const synonymStartTime = performance.now();
            
            // Progressive loading callback - update UI as results come in (flowing like a river)
            let lastResultCount = 0;
            const progressCallback = (currentResults, currentSynonymsUsed) => {
                synonymResults = currentResults;
                synonymsUsed = currentSynonymsUsed;
                tabSynonymCount.textContent = ` (${synonymResults.length})`;
                
                // Only animate NEW results (the ones that just appeared)
                const newCount = synonymResults.length - lastResultCount;
                lastResultCount = synonymResults.length;
                
                // Update UI progressively
                resultsDiv.innerHTML = renderResults([], synonymResults, synonymsUsed, query, false, true);
                
                // Animate only the NEW results (flowing in smoothly)
                requestAnimationFrame(() => {
                    const resultCards = resultsDiv.querySelectorAll('.result-card');
                    // Animate only the last N cards (the new ones)
                    const startIndex = Math.max(0, resultCards.length - newCount);
                    resultCards.forEach((card, index) => {
                        if (index < startIndex) {
                            // Already visible, keep it visible
                            card.style.opacity = '1';
                            card.style.transform = 'translateY(0)';
                        } else {
                            // New card - animate in (like a bubble rising)
                            card.style.opacity = '0';
                            card.style.transform = 'translateY(15px)';
                            setTimeout(() => {
                                card.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
                                card.style.opacity = '1';
                                card.style.transform = 'translateY(0)';
                            }, (index - startIndex) * 50); // Stagger new results
                        }
                    });
                });
            };
            
            const synonymData = await searchWithSynonyms(query, progressCallback);
            if (sessionId !== searchSessionId) return;
            let allSynonymResults = synonymData.results || [];
            synonymsUsed = synonymData.synonymsUsed || {};
            
            // Mobile: Limit synonym results
            const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            const MOBILE_LIMIT = 500;
            const originalSynonymCount = allSynonymResults.length;
            if (isMobile && allSynonymResults.length > MOBILE_LIMIT) {
                synonymResults = allSynonymResults.slice(0, MOBILE_LIMIT);
            } else {
                synonymResults = allSynonymResults;
            }
            
            const synonymTime = performance.now() - synonymStartTime;
            console.log(`Synonym search completed in ${synonymTime.toFixed(0)}ms, found ${originalSynonymCount} results`);
            synonymSearchInProgress = false;
            synonymSearchCompleted = true;
            const displayCount = (isMobile && originalSynonymCount > MOBILE_LIMIT) ? '500+' : synonymResults.length;
            tabSynonymCount.textContent = ` (${displayCount})`;
            tabSynonymSpinner.style.display = 'none';
            
            // Final render
            if (synonymResults.length > 0) {
                const showMobileLimit = isMobile && originalSynonymCount > MOBILE_LIMIT;
                resultsDiv.innerHTML = renderResults([], synonymResults, synonymsUsed, query, false, false, false, showMobileLimit);
            }
        } else if (fromEnter) {
            // Load immediately if Enter was pressed
            await loadSynonyms(query, sessionId);
        } else {
            // Wait 500ms before loading synonyms
            synonymSearchTimeout = setTimeout(() => {
                loadSynonyms(query, sessionId);
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
        clearTimeout(autocompleteTimer);
        const rawValue = e.target.value || '';
        const query = rawValue.trim();

        autocompleteTimer = setTimeout(() => {
            updateSearchSuggestions(rawValue);
        }, 320);
        
        // If empty, clear immediately
        if (!query) {
            lastSuggestionSignature = '';
            hideSuggestions();
            performSearch('', false);
            return;
        }
    });
    
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            moveSuggestionSelection(1);
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            moveSuggestionSelection(-1);
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (activeSuggestionIndex >= 0 && suggestionItems[activeSuggestionIndex]) {
                const selected = suggestionItems[activeSuggestionIndex].textContent || '';
                searchInput.value = selected;
                hideSuggestions();
                performSearch(selected, true);
                return;
            }
            const query = e.target.value.trim();
            
            // If query changed, perform new search (only if dictionary is ready)
            if (query !== currentQuery && dictionaryReady) {
                performSearch(query, true);
            } else if (!synonymSearchCompleted && !synonymSearchInProgress && currentQuery) {
                // If synonyms haven't loaded yet, load them now
                if (synonymSearchTimeout) {
                    clearTimeout(synonymSearchTimeout);
                    synonymSearchTimeout = null;
                }
                loadSynonyms(currentQuery, searchSessionId);
            }
        }
        if (e.key === 'Escape') {
            hideSuggestions();
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

    // Lazy-load autocomplete corpus in background after first render.
    setTimeout(() => {
        loadAutocompleteWords();
    }, 800);

    // Close suggestions on blur after click handlers run.
    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            hideSuggestions();
        }, 120);
    });
}
