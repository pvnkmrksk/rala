// ============================================================================
// config.js - Configuration constants and global state
// ============================================================================
const YAML_URL = 'https://raw.githubusercontent.com/alar-dict/data/master/alar.yml';
const DATAMUSE_API = 'https://api.datamuse.com/words';
const CACHE_KEY = 'rala_dictionary_cache';
const CACHE_VERSION_KEY = 'rala_cache_version';
const CACHE_VERSION = '2.0'; // Increment this to invalidate all caches (simplified format)
const DB_NAME = 'rala_dictionary_db';
const DB_VERSION = 1;
const STORE_NAME = 'dictionary';

// Cloudflare Worker API endpoint (server-side search)
// Set this to your Worker URL after deployment, or null to use client-side search
const WORKER_API_URL = 'https://rala-search.rala-search.workers.dev';

// Primary dictionary (loaded first)
const PRIMARY_DICTIONARY = { 
    url: YAML_URL, 
    type: 'remote',
    name: "V. Krishna's Alar",
    nameKannada: "ಶ್ರೀ. ವಿ. ಕೃಷ್ಣ ಅವರ ಅಲರ್",
    dictTitle: "V. Krishna's Alar",
    dictTitleKannada: "ಶ್ರೀ. ವಿ. ಕೃಷ್ಣ ಅವರ ಅಲರ್",
    link: "https://alar.ink/"
};

// Padakanaja dictionary base URL
const PADAKANAJA_BASE_URL = "https://padakanaja.karnataka.gov.in/dictionary";

// Combined padakanaja dictionary (ultra-compact format: duplicates removed, flattened)
const PADAKANAJA_COMBINED_FILES = [
    'padakanaja/combined_dictionaries_ultra.json'
];

// Pre-built reverse index for Alar (split into chunks for faster loading)
const ALAR_REVERSE_INDEX_FILES = [
    'padakanaja/alar_reverse_index_part1.json',
    'padakanaja/alar_reverse_index_part2.json',
    'padakanaja/alar_reverse_index_part3.json',
    'padakanaja/alar_reverse_index_part4.json',
    'padakanaja/alar_reverse_index_part5.json',
    'padakanaja/alar_reverse_index_part6.json',
    'padakanaja/alar_reverse_index_part7.json'
];
const ALAR_REVERSE_INDEX_METADATA = 'padakanaja/alar_reverse_index_metadata.json';

// Padakanaja entries are English->Kannada, so we search directly (no reverse index needed)
// Reverse index is only for Alar (Kannada->English)

// Global state
let dictionary = []; // Alar entries only (padakanaja searched from IndexedDB on mobile)
let dictionaryReady = false; // Flag to indicate dictionary is ready for search
let reverseIndex = new Map(); // Only for Alar
let allEnglishWords = new Set();
let padakanajaInMemory = false; // Flag: true if padakanaja is loaded in memory, false if searched from IndexedDB

// Cache for audio file existence checks
const audioExistenceCache = new Map(); // entryId -> boolean (true/false/null for unknown)

// DOM elements
const app = document.getElementById('app');
