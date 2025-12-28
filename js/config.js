// ============================================================================
// config.js - Configuration constants and global state
// ============================================================================
const YAML_URL = 'https://raw.githubusercontent.com/alar-dict/data/master/alar.yml';
const DATAMUSE_API = 'https://api.datamuse.com/words';
const CACHE_KEY = 'rala_dictionary_cache';
const CACHE_VERSION_KEY = 'rala_cache_version';
const CACHE_VERSION = '1.6'; // Increment this to invalidate all caches
const DB_NAME = 'rala_dictionary_db';
const DB_VERSION = 1;
const STORE_NAME = 'dictionary';

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

// Combined padakanaja dictionary (all 63 dictionaries in one file)
const PADAKANAJA_COMBINED_FILE = 'padakanaja/combined_dictionaries.yml';

// Global state
let dictionary = [];
let reverseIndex = new Map();
let allEnglishWords = new Set();

// Cache for audio file existence checks
const audioExistenceCache = new Map(); // entryId -> boolean (true/false/null for unknown)

// DOM elements
const app = document.getElementById('app');
