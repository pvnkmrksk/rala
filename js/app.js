// ============================================================================
// app.js - Main application initialization and event handlers
// ============================================================================

// Initialize
async function init() {
    try {
        // Initialize dark mode first
        initDarkMode();
        
        await loadDictionary();
        // buildReverseIndex is now only needed if pre-built index fails (handled in loadDictionary)
        // Don't call it here as it's already handled
        
        // Remove loading message immediately
        const loadingEl = app.querySelector('.loading');
        if (loadingEl) {
            loadingEl.remove();
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
            ${dictionary.length.toLocaleString()} total entries | 
            ${reverseIndex.size.toLocaleString()} unique English words indexed
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
        
        const { results: synonymResultsTemp, synonymsUsed: synonymsUsedTemp } = await searchWithSynonyms(query);
        
        // Filter out synonym results that are already in direct results
        const directKeys = new Set(directResults.map(r => `${r.kannada}-${r.definition}`));
        synonymResults = synonymResultsTemp.filter(r => 
            !directKeys.has(`${r.kannada}-${r.definition}`)
        );
        synonymsUsed = synonymsUsedTemp;
        
        tabSynonymCount.textContent = ` (${synonymResults.length})`;
        tabSynonymSpinner.style.display = 'none';
        synonymSearchCompleted = true;
        
        // Update UI with both results
        resultsDiv.innerHTML = renderResults(directResults, synonymResults, synonymsUsed, query, false, false);
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
        
        // Show loading state for direct matches
        resultsDiv.innerHTML = renderResults([], [], {}, query, true, false);
        switchTab('exact');
        
        // Step 1: Search direct matches
        directResults = searchDirect(query);
        tabExactCount.textContent = ` (${directResults.length})`;
        tabExactSpinner.style.display = 'none';
        
        // Update UI with direct results
        resultsDiv.innerHTML = renderResults(directResults, [], {}, query, false, false);
        
        // Step 2: Load synonyms with delay (500ms) or immediately if Enter was pressed
        if (fromEnter) {
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
        
        // Debounce search by 400ms to prevent input lag during typing
        debounceTimer = setTimeout(() => {
            // Only search if dictionary is ready
            if (dictionaryReady) {
                performSearch(e.target.value, false);
            }
        }, 400);
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
