// ============================================================================
// feedback-page.js — standalone /feedback.html form (no dictionary bundle)
// ============================================================================

function initFeedbackPage() {
    initDarkMode();
    initSidebar();

    window.openRalaFeedback = function () {
        document.getElementById('feedback-page-text')?.focus();
    };

    const ta = document.getElementById('feedback-page-text');
    const btn = document.getElementById('feedback-page-submit');
    const hint = document.getElementById('feedback-page-hint');
    const formWrap = document.getElementById('feedback-page-form');
    const success = document.getElementById('feedback-page-success');

    btn?.addEventListener('click', () => {
        const text = (ta?.value || '').trim();
        if (!text) {
            if (hint) {
                hint.textContent = 'Please enter a message.';
                hint.hidden = false;
                hint.classList.remove('ok');
            }
            return;
        }
        if (typeof window.reportRalaFeedback === 'function') {
            window.reportRalaFeedback(text);
        }
        localStorage.setItem('rala_feedback_submitted', '1');
        if (ta) ta.value = '';
        if (formWrap) formWrap.hidden = true;
        if (success) success.hidden = false;
        if (hint) {
            hint.hidden = true;
            hint.textContent = '';
        }
    });
}

document.addEventListener('DOMContentLoaded', initFeedbackPage);
