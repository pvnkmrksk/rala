// Loads Vercel Web Analytics when VERCEL_ANALYTICS_ORIGIN is set in config.js.
(function () {
  try {
    var origin =
      typeof VERCEL_ANALYTICS_ORIGIN !== 'undefined' && VERCEL_ANALYTICS_ORIGIN
        ? String(VERCEL_ANALYTICS_ORIGIN).replace(/\/$/, '')
        : '';
    if (!origin) return;

    var hosts =
      typeof VERCEL_ANALYTICS_HOSTS !== 'undefined' && VERCEL_ANALYTICS_HOSTS && VERCEL_ANALYTICS_HOSTS.length
        ? VERCEL_ANALYTICS_HOSTS
        : ['rala.kutuhula.in'];
    if (hosts.indexOf(location.hostname) === -1 && hosts.indexOf('*') === -1) return;

    window.va =
      window.va ||
      function () {
        (window.vaq = window.vaq || []).push(arguments);
      };

    var s = document.createElement('script');
    s.defer = true;
    s.src = origin + '/_vercel/insights/script.js';
    s.dataset.endpoint = origin + '/_vercel/insights';
    document.head.appendChild(s);
  } catch (_) {
    /* ignore */
  }
})();
