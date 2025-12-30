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
            
            // Pre-warm Worker with a dummy call (make it hot and ready)
            const preWarmStartTime = performance.now();
            const preWarmPromise = fetch(`${WORKER_API_URL}?q=elytra`)
                .then(() => {
                    const preWarmTime = performance.now() - preWarmStartTime;
                    console.log(`🔥 Pre-warm Worker API: ${preWarmTime.toFixed(0)}ms`);
                })
                .catch(error => {
                    const preWarmTime = performance.now() - preWarmStartTime;
                    console.warn(`⚠️ Pre-warm Worker API failed (${preWarmTime.toFixed(0)}ms):`, error);
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
        renderApp(urlQuery);
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
        <div class="tabs-wrapper" id="tabs-wrapper" style="display: none;">
            <div class="tabs">
                <button class="tab active" id="tab-exact">
                    <span>Exact Match</span>
                    <span id="tab-exact-count"></span>
                    <span id="tab-exact-spinner" class="tab-spinner" style="display: none;"></span>
                </button>
                <button class="tab" id="tab-synonym">
                    <span>Synonym Match</span>
                    <span id="tab-synonym-count"></span>
                    <span id="tab-synonym-spinner" class="tab-spinner" style="display: none;"></span>
                </button>
            </div>
        </div>
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
    
    let directResults = [];
    let synonymResults = [];
    let synonymsUsed = {};
    let currentQuery = '';
    let debounceTimer = null;
    let synonymSearchInProgress = false;
    let synonymSearchCompleted = false;
    let synonymSearchTimeout = null;
    
    function switchTab(tabName) {
        if (tabName === 'exact') {
            tabExact.classList.add('active');
            tabSynonym.classList.remove('active');
            const exactSection = document.getElementById('exact-matches');
            if (exactSection) {
                setTimeout(() => {
                    const searchHeight = document.querySelector('.sticky-search').offsetHeight;
                    const tabsHeight = document.querySelector('.tabs-wrapper').offsetHeight;
                    const offset = searchHeight + tabsHeight;
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
                    const tabsHeight = document.querySelector('.tabs-wrapper').offsetHeight;
                    const offset = searchHeight + tabsHeight;
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
    
    async function loadSynonyms(query) {
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
            
            // Progressive loading callback - update UI as results come in
            const progressCallback = (currentResults, currentSynonymsUsed) => {
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
                    resultsDiv.innerHTML = renderResults(directResults, synonymResults, synonymsUsed, query, false, true);
                    
                    // Animate new results
                    requestAnimationFrame(() => {
                        const synonymSection = document.getElementById('synonym-matches');
                        if (synonymSection) {
                            const resultCards = synonymSection.querySelectorAll('.result-card');
                            resultCards.forEach((card, index) => {
                                if (!card.style.opacity || card.style.opacity === '1') return; // Already animated
                                card.style.opacity = '0';
                                card.style.transform = 'translateY(10px)';
                                setTimeout(() => {
                                    card.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
                                    card.style.opacity = '1';
                                    card.style.transform = 'translateY(0)';
                                }, index * 10);
                            });
                        }
                    });
                }
            };
            
            // Perform search with progressive callback
            const { results: synonymResultsTemp, synonymsUsed: synonymsUsedTemp } = await searchWithSynonyms(query, progressCallback);
            
            // Filter out synonym results that are already in direct results
            const directKeys = new Set(directResults.map(r => `${r.kannada}-${r.definition}`));
            synonymResults = synonymResultsTemp.filter(r => 
                !directKeys.has(`${r.kannada}-${r.definition}`)
            );
            synonymsUsed = synonymsUsedTemp;
        } else {
            // Client-side: normal flow
            const { results: synonymResultsTemp, synonymsUsed: synonymsUsedTemp } = await searchWithSynonyms(query);
            
            // Filter out synonym results that are already in direct results
            const directKeys = new Set(directResults.map(r => `${r.kannada}-${r.definition}`));
            synonymResults = synonymResultsTemp.filter(r => 
                !directKeys.has(`${r.kannada}-${r.definition}`)
            );
            synonymsUsed = synonymsUsedTemp;
        }
        
        tabSynonymCount.textContent = ` (${synonymResults.length})`;
        tabSynonymSpinner.style.display = 'none';
        synonymSearchCompleted = true;
        
        // Update UI with both results (progressive rendering with animation)
        resultsDiv.innerHTML = renderResults(directResults, synonymResults, synonymsUsed, query, false, false);
        
        // Trigger CSS animation for synonym results
        requestAnimationFrame(() => {
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
        
        // Progressive rendering: Show results as they come in
        // Update UI every 100ms to show progress
        let lastUpdate = Date.now();
        const updateInterval = setInterval(() => {
            // This will be updated when search completes
        }, 100);
        
        directResults = await searchPromise;
        clearInterval(updateInterval);
        
        const searchTime = performance.now() - startTime;
        console.log(`Search completed in ${searchTime.toFixed(0)}ms`);
        
        tabExactCount.textContent = ` (${directResults.length})`;
        tabExactSpinner.style.display = 'none';
        
        // Progressive rendering: Update UI with direct results
        // Render in batches for smooth animation
        const batchSize = 50;
        const totalBatches = Math.ceil(directResults.length / batchSize);
        
        if (directResults.length > 0) {
            // Render first batch immediately
            const firstBatch = directResults.slice(0, batchSize);
            resultsDiv.innerHTML = renderResults(firstBatch, [], {}, query, false, false);
            
            // Render remaining batches progressively
            for (let i = 1; i < totalBatches; i++) {
                await new Promise(resolve => setTimeout(resolve, 50)); // Small delay between batches
                const batch = directResults.slice(0, (i + 1) * batchSize);
                resultsDiv.innerHTML = renderResults(batch, [], {}, query, false, false);
            }
        } else {
            resultsDiv.innerHTML = renderResults([], [], {}, query, false, false);
        }
        
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
            
            // Progressive loading callback - update UI as results come in
            const progressCallback = (currentResults, currentSynonymsUsed) => {
                synonymResults = currentResults;
                synonymsUsed = currentSynonymsUsed;
                tabSynonymCount.textContent = ` (${synonymResults.length})`;
                
                // Update UI progressively
                resultsDiv.innerHTML = renderResults([], synonymResults, synonymsUsed, query, false, true);
                
                // Animate new results
                requestAnimationFrame(() => {
                    const resultCards = resultsDiv.querySelectorAll('.result-card');
                    resultCards.forEach((card, index) => {
                        if (!card.style.opacity || card.style.opacity === '1') return; // Already animated
                        card.style.opacity = '0';
                        card.style.transform = 'translateY(10px)';
                        setTimeout(() => {
                            card.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
                            card.style.opacity = '1';
                            card.style.transform = 'translateY(0)';
                        }, index * 10);
                    });
                });
            };
            
            const synonymData = await searchWithSynonyms(query, progressCallback);
            synonymResults = synonymData.results || [];
            synonymsUsed = synonymData.synonymsUsed || {};
            const synonymTime = performance.now() - synonymStartTime;
            console.log(`Synonym search completed in ${synonymTime.toFixed(0)}ms, found ${synonymResults.length} results`);
            synonymSearchInProgress = false;
            synonymSearchCompleted = true;
            tabSynonymCount.textContent = ` (${synonymResults.length})`;
            tabSynonymSpinner.style.display = 'none';
            
            // Final render
            if (synonymResults.length > 0) {
                resultsDiv.innerHTML = renderResults([], synonymResults, synonymsUsed, query, false, false);
            }
        } else if (fromEnter) {
            // Load immediately if Enter was pressed
            await loadSynonyms(query);
        } else {
            // Wait 500ms before loading synonyms
            synonymSearchTimeout = setTimeout(() => {
                loadSynonyms(query);
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
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        
        // If empty, clear immediately
        if (!query) {
            performSearch('', false);
            return;
        }
        
        // Debounce search: 600ms for Worker API (network delay), 400ms for client-side
        // Industry standard: 300-500ms for instant search, 500-800ms for network calls
        const debounceDelay = WORKER_API_URL ? 600 : 400;
        debounceTimer = setTimeout(() => {
            // Only search if dictionary is ready (or Worker API is enabled)
            if (WORKER_API_URL || dictionaryReady) {
                performSearch(e.target.value, false);
            }
        }, debounceDelay);
    });
    
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(debounceTimer);
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
                loadSynonyms(currentQuery);
            }
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
}
