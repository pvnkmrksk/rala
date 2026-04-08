// ============================================================================
// home-title.js - Makes the big title act like Home
// ============================================================================
(function initHomeTitleNavigation() {
    const homeTitle = document.getElementById('home-title');
    if (!homeTitle) return;

    const goHome = () => {
        // Go to clean home URL so search query is cleared.
        window.location.href = 'index.html';
    };

    homeTitle.style.cursor = 'pointer';
    homeTitle.setAttribute('title', 'Go to Home');
    homeTitle.setAttribute('role', 'link');
    homeTitle.setAttribute('tabindex', '0');

    homeTitle.addEventListener('click', goHome);
    homeTitle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            goHome();
        }
    });
})();
