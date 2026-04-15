import http from 'k6/http';
import { check, sleep } from 'k6';

// Browse = only search API (no static assets). Think time ≈ reading results.
const API_BASE = __ENV.API_BASE || 'https://rala-search.rala-search.workers.dev';
const READ_SECONDS = Number(__ENV.READ_SECONDS || '6'); // 6s → ~10 searches/min per user

const QUERY_TERMS = [
  'house', 'water', 'fire', 'earth', 'wind', 'love', 'time', 'book', 'friend', 'music',
  'flower', 'light', 'night', 'river', 'heart', 'food', 'school', 'city', 'dream', 'story',
  'tree', 'stone', 'gold', 'silver', 'king', 'queen', 'horse', 'sheep', 'bird', 'fish',
  'sun', 'moon', 'star', 'rain', 'snow', 'cold', 'warm', 'fast', 'slow', 'high', 'low',
  'good', 'bad', 'new', 'old', 'young', 'child', 'mother', 'father', 'work', 'play',
];

export const options = {
  stages: [
    { duration: '45s', target: 40 },
    { duration: '45s', target: 80 },
    { duration: '45s', target: 120 },
    { duration: '45s', target: 160 },
    { duration: '45s', target: 200 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    checks: ['rate>0.95'],
    http_req_failed: ['rate<0.05'],
  },
};

function randomTerm() {
  return QUERY_TERMS[Math.floor(Math.random() * QUERY_TERMS.length)];
}

export default function () {
  const q = encodeURIComponent(randomTerm());
  const res = http.get(`${API_BASE}?q=${q}`, { timeout: '20s' });

  check(res, {
    'search status 200': (r) => r.status === 200,
    'search json': (r) =>
      (r.headers['Content-Type'] || '').toLowerCase().includes('application/json'),
  });

  sleep(READ_SECONDS);
}
