import http from 'k6/http';
import { check, sleep } from 'k6';

const API_BASE = __ENV.API_BASE || 'https://rala-search.rala-search.workers.dev';
const QUERY_TERMS = ['house', 'water', 'fire', 'earth', 'wind', 'love', 'time', 'book'];

export const options = {
  stages: [
    { duration: '45s', target: 10 },
    { duration: '45s', target: 30 },
    { duration: '45s', target: 60 },
    { duration: '45s', target: 90 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    checks: ['rate>0.98'],
    http_req_failed: ['rate<0.03'],
    http_req_duration: ['p(95)<1000'],
  },
};

function randomTerm() {
  return QUERY_TERMS[Math.floor(Math.random() * QUERY_TERMS.length)];
}

export default function () {
  const q = encodeURIComponent(randomTerm());
  const res = http.get(`${API_BASE}?q=${q}`, { timeout: '8s' });

  check(res, {
    'api status 200': (r) => r.status === 200,
    'api has json content-type': (r) =>
      (r.headers['Content-Type'] || '').toLowerCase().includes('application/json'),
  });

  sleep(0.3);
}
