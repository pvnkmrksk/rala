import http from 'k6/http';
import { check, sleep } from 'k6';

const SITE_BASE = __ENV.SITE_BASE || 'https://pvnkmrksk.github.io/rala/';
const API_BASE = __ENV.API_BASE || 'https://rala-search.rala-search.workers.dev';

const QUERY_TERMS = [
  'house',
  'water',
  'fire',
  'earth',
  'wind',
  'love',
  'time',
  'book',
  'friend',
  'music',
  'flower',
  'light',
  'night',
  'river',
  'heart',
  'food',
  'school',
  'city',
  'dream',
  'story',
];

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '1m', target: 25 },
    { duration: '1m', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '1m', target: 150 },
    { duration: '1m', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    'http_req_duration{endpoint:site}': ['p(95)<700'],
    'http_req_duration{endpoint:api}': ['p(95)<900'],
    'http_req_failed{endpoint:api}': ['rate<0.02'],
  },
};

function randomTerm() {
  const idx = Math.floor(Math.random() * QUERY_TERMS.length);
  return QUERY_TERMS[idx];
}

export default function () {
  const siteRes = http.get(SITE_BASE, {
    tags: { endpoint: 'site' },
    timeout: '15s',
  });
  check(siteRes, {
    'site: status 200': (r) => r.status === 200,
  });

  const term = encodeURIComponent(randomTerm());
  const apiRes = http.get(`${API_BASE}?q=${term}`, {
    tags: { endpoint: 'api' },
    timeout: '15s',
  });
  check(apiRes, {
    'api: status 200': (r) => r.status === 200,
    'api: json body': (r) =>
      (r.headers['Content-Type'] || '').toLowerCase().includes('application/json'),
  });

  sleep(0.5);
}
