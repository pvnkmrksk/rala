// ============================================================================
// worker-events.js - Optional events to Cloudflare Worker (POST /__rala/v1/event).
// Requires WORKER_API_URL from config.js.
// ============================================================================

(function () {
    function postEvent(eventName, extra) {
        if (typeof WORKER_API_URL === 'undefined' || !WORKER_API_URL) return;
        if (!eventName || typeof eventName !== 'string') return;
        try {
            const url = new URL('/__rala/v1/event', WORKER_API_URL);
            const body = { e: eventName };
            if (extra && typeof extra === 'object' && extra.w && typeof extra.w === 'string') {
                body.w = extra.w.slice(0, 120);
            }
            fetch(url.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                keepalive: true,
            }).catch(function () {});
        } catch (_) {
            /* ignore */
        }
    }

    function reportRalaFeedback(text) {
        if (typeof WORKER_API_URL === 'undefined' || !WORKER_API_URL) return;
        const w = String(text || '').trim().slice(0, 2000);
        if (!w) return;
        try {
            const url = new URL('/__rala/v1/event', WORKER_API_URL);
            fetch(url.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ e: 'user_feedback', w }),
                keepalive: true,
            }).catch(function () {});
        } catch (_) {
            /* ignore */
        }
    }

    window.reportRalaWorkerEvent = postEvent;
    window.reportRalaFeedback = reportRalaFeedback;
})();
