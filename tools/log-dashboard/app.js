/* global window, document, localStorage, URLSearchParams */
(function () {
  const state = {
    allEvents: [],
    filteredEvents: [],
  };

  const els = {
    workerUrl: document.getElementById('workerUrl'),
    token: document.getElementById('token'),
    hours: document.getElementById('hours'),
    limit: document.getElementById('limit'),
    eventFilter: document.getElementById('eventFilter'),
    loadBtn: document.getElementById('loadBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    status: document.getElementById('status'),
    mCount: document.getElementById('mCount'),
    mSearch: document.getElementById('mSearch'),
    mAudio: document.getElementById('mAudio'),
    mPwa: document.getElementById('mPwa'),
    topSearch: document.getElementById('topSearch'),
    topCountries: document.getElementById('topCountries'),
    qContains: document.getElementById('qContains'),
    countryFilter: document.getElementById('countryFilter'),
    tableEventFilter: document.getElementById('tableEventFilter'),
    applyFilterBtn: document.getElementById('applyFilterBtn'),
    rows: document.getElementById('rows'),
  };

  function fmtTs(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleString();
  }

  function setStatus(msg, isWarn) {
    els.status.textContent = msg;
    els.status.className = isWarn ? 'muted warn' : 'muted';
  }

  function countBy(items, keyFn) {
    const m = new Map();
    for (const it of items) {
      const k = keyFn(it);
      if (!k) continue;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }

  function renderTopList(container, entries, emptyText) {
    container.innerHTML = '';
    if (!entries.length) {
      const div = document.createElement('div');
      div.textContent = emptyText;
      container.appendChild(div);
      return;
    }
    for (const [k, v] of entries.slice(0, 50)) {
      const div = document.createElement('div');
      div.textContent = `${k} — ${v}`;
      container.appendChild(div);
    }
  }

  function renderSummary(events) {
    const search = events.filter((e) => e.rala_event === 'search_primary').length;
    const audio = events.filter((e) => e.rala_event === 'audio_play').length;
    const pwa = events.filter((e) => e.rala_event === 'pwa_install').length;
    els.mCount.textContent = String(events.length);
    els.mSearch.textContent = String(search);
    els.mAudio.textContent = String(audio);
    els.mPwa.textContent = String(pwa);

    const topSearch = countBy(
      events.filter((e) => e.rala_event === 'search_primary'),
      (e) => (e.q || '').trim()
    );
    const topCountries = countBy(events, (e) => ((e.ctx && e.ctx.country) || '').trim());
    renderTopList(els.topSearch, topSearch, 'No search events');
    renderTopList(els.topCountries, topCountries, 'No location data');
  }

  function renderRows(events) {
    els.rows.innerHTML = '';
    for (const e of events) {
      const tr = document.createElement('tr');
      const term = e.q || e.w || '';
      const country = (e.ctx && e.ctx.country) || '';
      const city = (e.ctx && e.ctx.city) || '';
      const ip = (e.ctx && e.ctx.ip) || '';
      const isp = (e.ctx && e.ctx.isp) || '';
      const details = JSON.stringify(e, null, 2);

      tr.innerHTML = [
        `<td>${fmtTs(e.ts)}</td>`,
        `<td>${e.rala_event || ''}</td>`,
        `<td>${term}</td>`,
        `<td>${country}${city ? ' / ' + city : ''}</td>`,
        `<td>${ip}</td>`,
        `<td>${isp}</td>`,
        `<td><details><summary>json</summary><div class="json">${details.replace(/</g, '&lt;')}</div></details></td>`,
      ].join('');
      els.rows.appendChild(tr);
    }
  }

  function applyTableFilters() {
    const qNeedle = (els.qContains.value || '').toLowerCase().trim();
    const countryNeedle = (els.countryFilter.value || '').toLowerCase().trim();
    const eventNeedle = (els.tableEventFilter.value || '').trim();

    state.filteredEvents = state.allEvents.filter((e) => {
      if (eventNeedle && e.rala_event !== eventNeedle) return false;
      if (qNeedle) {
        const term = String(e.q || e.w || '').toLowerCase();
        if (!term.includes(qNeedle)) return false;
      }
      if (countryNeedle) {
        const c = String((e.ctx && e.ctx.country) || '').toLowerCase();
        if (c !== countryNeedle) return false;
      }
      return true;
    });
    renderRows(state.filteredEvents);
    setStatus(`Loaded ${state.allEvents.length} events; showing ${state.filteredEvents.length}.`);
  }

  async function loadEvents() {
    const workerUrl = (els.workerUrl.value || '').trim().replace(/\/$/, '');
    const token = (els.token.value || '').trim();
    const hours = Number(els.hours.value || 24);
    const limit = Number(els.limit.value || 1000);
    const event = (els.eventFilter.value || '').trim();

    if (!workerUrl) {
      setStatus('Worker URL is required', true);
      return;
    }
    if (!token) {
      setStatus('Dashboard token is required', true);
      return;
    }

    setStatus('Fetching archive...');
    const params = new URLSearchParams({
      hours: String(hours),
      limit: String(limit),
    });
    if (event) params.set('event', event);

    const url = `${workerUrl}/__rala/v1/archive?${params.toString()}`;
    let payload;
    try {
      const res = await fetch(url, {
        headers: { 'X-Rala-Dashboard-Token': token },
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`HTTP ${res.status}: ${t}`);
      }
      payload = await res.json();
    } catch (err) {
      setStatus(`Fetch failed: ${err.message}`, true);
      return;
    }

    state.allEvents = Array.isArray(payload.events) ? payload.events : [];
    // Chronological newest first
    state.allEvents.sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));

    renderSummary(state.allEvents);
    applyTableFilters();

    localStorage.setItem('rala_dash_worker_url', workerUrl);
    localStorage.setItem('rala_dash_token', token);
    localStorage.setItem('rala_dash_hours', String(hours));
    localStorage.setItem('rala_dash_limit', String(limit));
  }

  function downloadCurrentJson() {
    const blob = new Blob([JSON.stringify(state.filteredEvents, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rala-events-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function restoreInputs() {
    const worker = localStorage.getItem('rala_dash_worker_url');
    const token = localStorage.getItem('rala_dash_token');
    const hours = localStorage.getItem('rala_dash_hours');
    const limit = localStorage.getItem('rala_dash_limit');
    if (worker) els.workerUrl.value = worker;
    if (token) els.token.value = token;
    if (hours) els.hours.value = hours;
    if (limit) els.limit.value = limit;
  }

  els.loadBtn.addEventListener('click', loadEvents);
  els.downloadBtn.addEventListener('click', downloadCurrentJson);
  els.applyFilterBtn.addEventListener('click', applyTableFilters);
  restoreInputs();
})();
