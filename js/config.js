// ============================================================================
// config.js - Configuration constants and global state
// ============================================================================
const YAML_URL = 'https://raw.githubusercontent.com/alar-dict/data/master/alar.yml';
const DATAMUSE_API = 'https://api.datamuse.com/words';
const CACHE_KEY = 'rala_dictionary_cache';
const CACHE_VERSION_KEY = 'rala_cache_version';
const CACHE_VERSION = '1.4'; // Increment this to invalidate all caches
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

// Additional dictionaries to load in background (padakanaja)
const PADAKANAJA_DICTIONARIES = [
    'padakanaja/ಅರಣಯಶಸತರ_ಪರಭಷಕ_ಶಬದಕಶ__ಇಗಲಷ-ಕನನಡ.yml',
    'padakanaja/ಆಡಳತ_ಮತತ_ತತರಕ_ಪದಕಶ_-_ಕರನಟಕ_ವದಯತ_ಪರ.yml',
    'padakanaja/ಆಡಳತ_ಮತತ_ತತರಕ_ಪದಕಶ_-_ಬಗಳರ_ವದಯತ_ಸರ.yml',
    'padakanaja/ಆತರಕ_ಲಕಕ_ಪರಶಧನ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳತ_ಪದಕ.yml',
    'padakanaja/ಆರಥಕ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳತ_ಪದಕಶ_-_ಕರನಟಕ_ರಜ.yml',
    'padakanaja/ಇ-ಆಡಳತ_ಪದರಚನ_ಸಮತಯಲಲ_ಅನಮದನಗಡ_ಪದಗಳ_ಇಗ.yml',
    'padakanaja/ಇಗಲಷ-ಕನನಡ_ವಜಞನ_ಪದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪ.yml',
    'padakanaja/ಇಗಲಷ_ಕನನಡ_ಔದಯಮಕ_ನಘಟ__ಇಗಲಷ-ಕನನಡ__ಪ.yml',
    'padakanaja/ಇಗಲಷ_ಕನನಡ_ಪದಕಶ_-_ಭರತ_ಎಲಕಟರನಕಸ__ಇ.yml',
    'padakanaja/ಉಗರಣ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳತ_ಪದಕಶ_-_ಕರನಟಕ_ರಜ.yml',
    'padakanaja/ಕಟಶಸತರ_ಪರಭಷಕ_ಶಬದಕಶ_ಇಗಲಷ-ಕನನಡ__ಪರ.yml',
    'padakanaja/ಕನನ_ಪದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪರಕಶಕರ_-_ಸಸದಯ.yml',
    'padakanaja/ಕನನ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳತ_ಪದಕಶ_-_ಕರನಟಕ_ರಜ.yml',
    'padakanaja/ಕನನಡ-ಇಗಲಷ_ನಘಟ_ಪದ_ಯಸಜ_ಕನನಡ_-_ಕನನಡ_ಪ.yml',
    'padakanaja/ಕಪಯಟರ_ತತರಜಞನ_ಪದವವರಣ_ಕಶ__ಇಗಲಷ-ಕನನಡ.yml',
    'padakanaja/ಕಮಗರ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳತ_ಪದಕಶ_-_ಕರನಟಕ_ರ.yml',
    'padakanaja/ಕರಮಕ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳತ_ಪದಕಶ_-_ಕರನಟಕ_ರ.yml',
    'padakanaja/ಕಷ_ಎಜನಯರಗ_ಪರಭಷಕ_ಶಬದಕಶ__ಇಗಲಷ-ಕನ.yml',
    'padakanaja/ಕಷ_ರಸಯನಶಸತರ_ಶಬದರಥ_ನರಪಣವಳ__ಇಗಲಷ-ಕ.yml',
    'padakanaja/ಕಷ_ವಜಞನ_ತತರಕ_ಪದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪರ.yml',
    'padakanaja/ಕಷ_ವಜಞನ_ಪದಕಶ_ಕಷ_ವಜಞನ_ಗಲಸರ__ಇಗಲ.yml',
    'padakanaja/ಕಷ_ವಜಞನ_ಪರಭಷಕ_ಪದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪ.yml',
    'padakanaja/ಕಷ_ಸಕಷಮಜವಶಸತರ_ಪರಭಷಕ_ಶಬದಕಶ__ಇಗಲ.yml',
    'padakanaja/ಕಷ_ಸಸಯಶಸತರ_ಪರಭಷಕ_ಶಬದಕಶ__ಇಗಲಷ-ಕನನ.yml',
    'padakanaja/ಖಜನ_ಇಲಖ__ಇಗಲಷ-ಕನನಡ__ಪರಕಶಕರ_-_ಕನನಡ_ಮ.yml',
    'padakanaja/ಗಣಕ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳತ_ಪದಕಶ_-_ಕರನಟಕ_ರಜಯ.yml',
    'padakanaja/ಜವ_ಇಗಲಷ_-_ಕನನಡ_ನಘಟ__ಇಗಲಷ-ಕನನಡ__ಪ.yml',
    'padakanaja/ತಟಗರಕ_ಇಲಖ_ಪರಭಷಕ_ಪದಕಶ__ಇಗಲಷ-ಕನನಡ.yml',
    'padakanaja/ತಟಗರಕ_ಪರಭಷಕ_ಶಬದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪರ.yml',
    'padakanaja/ನವಕರನಟಕ_ಆಡಳತ_ಪದಕಶ_ಕನನಡ-ಇಗಲಷ-ಕನನಡ_ಪರಕ.yml',
    'padakanaja/ಪತರಕ_ನಘಟ_-_ಎಲ_ಗಡಪಪ__ಇಗಲಷ-ಕನನಡ.yml',
    'padakanaja/ಪತರಕ_ಪದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪರಕಶಕರ_-_ಕರನ.yml',
    'padakanaja/ಪರಭಷಕ_ಪದಕಶ_-_ಅಗನಶಮಕ_ಸವಗಳ_ಇಲಖ__ಇಗಲಷ.yml',
    'padakanaja/ಪರಭಷಕ_ಪದಕಶ_-_ಆರಥಕ_ಮತತ_ಸಖಯಕ_ಇಲಖ__ಇ.yml',
    'padakanaja/ಪರಭಷಕ_ಪದಕಶ_-_ಆಹರ_ಮತತ_ನಗರಕ_ಪರಕ_ನರದಶ.yml',
    'padakanaja/ಪರಭಷಕ_ಪದಕಶ_-_ಔಷಧ_ನಯತರಣ_ಇಲಖ__ಇಗಲಷ-ಕನ.yml',
    'padakanaja/ಪರಭಷಕ_ಪದಕಶ_-_ಕಗರಕ_ಮತತ_ವಣಜಯ_ಇಲಖ__ಇ.yml',
    'padakanaja/ಪರಭಷಕ_ಪದಕಶ_-_ಕರಗಹಗಳ_ಇಲಖ__ಇಗಲಷ-ಕನನಡ.yml',
    'padakanaja/ಪರಭಷಕ_ಪದಕಶ_-_ಕರನಟಕ_ಲಕಸವ_ಆಯಗ__ಇಗಲಷ-.yml',
    'padakanaja/ಪರಭಷಕ_ಪದಕಶ_-_ಕರಮಕ_ಇಲಖ__ಇಗಲಷ-ಕನನಡ.yml',
    'padakanaja/ಪರಭಷಕ_ಪದಕಶ_-_ಕಷ_ಇಲಖ__ಇಗಲಷ-ಕನನಡ__ಪ.yml',
    'padakanaja/ಪರಭಷಕ_ಪದಕಶ_-_ಗಹರಕಷಕದಳ_ಮತತ_ಪರರಕಷಣ_ನರದ.yml',
    'padakanaja/ಪರಭಷಕ_ಪದಕಶ_-_ಚಲನಚತರ_ಅಭವದಧ_ನಗಮ__ಇಗಲ.yml',
    'padakanaja/ಪರಭಷಕ_ಪದಕಶ_-_ನದಣ_ಮತತ_ಮದರಕಗಳ_ಇಲಖ.yml',
    'padakanaja/ಪರಭಷಕ_ಪದಕಶ_-_ಪತರಗರ__ಇಗಲಷ-ಕನನಡ_ಪರಕ.yml',
    'padakanaja/ಪರಭಷಕ_ಪದಕಶ_-_ಪಶಸಗಪನ_ಮತತ_ಪಶವದಯ_ಇಲಖ.yml',
    'padakanaja/ಪರಭಷಕ_ಪದಕಶ_-_ಮದರಣ_ಲಖನಸಮಗರ_ಮತತ_ಪರಕಟಣ.yml',
    'padakanaja/ಪರಭಷಕ_ಪದಕಶ_-_ವಣಜಯ_ತರಗ_ಇಲಖ__ಇಗಲಷ-.yml',
    'padakanaja/ಪರಭಷಕ_ಪದಕಶ_-_ಸಣಣ_ಉಳತಯ_ಇಲಖ__ಇಗಲಷ-ಕನ.yml',
    'padakanaja/ಪರಭಷಕ_ಪದಗಳ_-_ಸಕಷಪತ_ಆಡಳತ_ಪದಕಶ_-_ಕರನಟಕ.yml',
    'padakanaja/ಪರಸರ_ಶಖ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳತ_ಪದಕಶ_-_ಕರನಟಕ.yml',
    'padakanaja/ಪಶವದಯಕಯ_ಮತತ_ಪಶಸಗಪನ_ಪರಭಷಕ_ಶಬದಕಶ__ಇ.yml',
    'padakanaja/ಫಡಮಟಲ_ಅಡಮನಸಟರಟವ_ಟರಮನಲಜ_ಇಗಲಷ-.yml',
    'padakanaja/ಬಸಯಶಸತರ_ಪರಭಷಕ_ಶಬದಕಶ_ಇಗಲಷ-ಕನನಡ__ಪ.yml',
    'padakanaja/ಭದರತ_ಮತತ_ಜಗತ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳತ_ಪದಕಶ_-.yml',
    'padakanaja/ಮದರಣ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳತ_ಪದಕಶ_-_ಕರನಟಕ_ರಜ.yml',
    'padakanaja/ಮನಗರಕ_ಪರಭಷಕ_ಶಬದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪ.yml',
    'padakanaja/ವಶವವದಯಲಯ_ಪದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪರಕಶಕರ_-.yml',
    'padakanaja/ಸಕಷಪತ_ಆಡಳತ_ಪದಕಶ_ಇಗಲಷ-ಕನನಡ__ಪರಕಶಕರ.yml',
    'padakanaja/ಸಚರ_ವಭಗ_-_ಸಕಷಪತ_ಆಡಳತ_ಪದಕಶ_-_ಕರನಟಕ_ರಜ.yml',
    'padakanaja/ಸಮನಯ_ಬಳಕ_ಪದಗಳ_-_ಸಕಷಪತ_ಆಡಳತ_ಪದಕಶ_-_ಕರನ.yml',
    'padakanaja/ಹನಗರಕ_ಪರಭಷಕ_ಶಬದಕಶ__ಇಗಲಷ-ಕನನಡ__ಪ.yml'
];

// Global state
let dictionary = [];
let reverseIndex = new Map();
let allEnglishWords = new Set();

// Cache for audio file existence checks
const audioExistenceCache = new Map(); // entryId -> boolean (true/false/null for unknown)

// DOM elements
const app = document.getElementById('app');

