// ============================================================================
// test-ui.js - Tests for UI functions (link generation, formatting, etc.)
// ============================================================================

// Mock cleanKannadaEntry function (copy from ui.js)
function cleanKannadaEntry(text) {
    if (!text) return '';
    let cleaned = text.replace(/[\[\](){}【】「」〈〉《》『』〔〕［］（）｛｝]/g, '');
    cleaned = cleaned.replace(/[<>"']/g, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}

// Test Alar link generation
function testAlarLinkGeneration() {
    console.log('🧪 Testing Alar link generation...');
    
    const tests = [
        {
            name: 'Simple Kannada word',
            kannada: 'ಆಕಾಶ',
            expected: 'https://alar.ink/dictionary/kannada/english/%E0%B2%86%E0%B2%95%E0%B2%BE%E0%B2%B6',
            source: 'alar'
        },
        {
            name: 'Word with brackets',
            kannada: 'ಆಕಾಶ [test]',
            expected: 'https://alar.ink/dictionary/kannada/english/%E0%B2%86%E0%B2%95%E0%B2%BE%E0%B2%B6%20test',
            source: 'alar'
        },
        {
            name: 'Empty word fallback',
            kannada: '',
            expected: 'https://alar.ink/',
            source: 'alar'
        },
        {
            name: 'Padakanaja entry (should not use Alar link)',
            kannada: 'ಕನ್ನಡ',
            expected: 'https://padakanaja.karnataka.gov.in/dictionary',
            source: 'padakanaja'
        }
    ];
    
    let passed = 0;
    let failed = 0;
    
    tests.forEach(test => {
        const cleaned = cleanKannadaEntry(test.kannada);
        let sourceLink;
        
        if (test.source === 'alar') {
            if (cleaned) {
                const encodedWord = encodeURIComponent(cleaned);
                sourceLink = `https://alar.ink/dictionary/kannada/english/${encodedWord}`;
            } else {
                sourceLink = 'https://alar.ink/';
            }
        } else {
            sourceLink = 'https://padakanaja.karnataka.gov.in/dictionary';
        }
        
        if (sourceLink === test.expected) {
            console.log(`  ✅ ${test.name}`);
            passed++;
        } else {
            console.log(`  ❌ ${test.name}`);
            console.log(`     Expected: ${test.expected}`);
            console.log(`     Got:      ${sourceLink}`);
            failed++;
        }
    });
    
    console.log(`\n📊 Alar link tests: ${passed} passed, ${failed} failed\n`);
    return failed === 0;
}

// Test URL encoding
function testURLEncoding() {
    console.log('🧪 Testing URL encoding...');
    
    const tests = [
        {
            word: 'ಆಕಾಶ',
            expected: '%E0%B2%86%E0%B2%95%E0%B2%BE%E0%B2%B6'
        },
        {
            word: 'ಕನ್ನಡ',
            expected: '%E0%B2%95%E0%B2%A8%E0%B3%8D%E0%B2%A8%E0%B2%A1'
        },
        {
            word: 'test',
            expected: 'test'
        }
    ];
    
    let passed = 0;
    let failed = 0;
    
    tests.forEach(test => {
        const encoded = encodeURIComponent(test.word);
        if (encoded === test.expected) {
            console.log(`  ✅ "${test.word}" → "${encoded}"`);
            passed++;
        } else {
            console.log(`  ❌ "${test.word}"`);
            console.log(`     Expected: ${test.expected}`);
            console.log(`     Got:      ${encoded}`);
            failed++;
        }
    });
    
    console.log(`\n📊 URL encoding tests: ${passed} passed, ${failed} failed\n`);
    return failed === 0;
}

// Test cleanKannadaEntry
function testCleanKannadaEntry() {
    console.log('🧪 Testing cleanKannadaEntry...');
    
    const tests = [
        {
            input: 'ಆಕಾಶ',
            expected: 'ಆಕಾಶ'
        },
        {
            input: 'ಆಕಾಶ [test]',
            expected: 'ಆಕಾಶ test'
        },
        {
            input: 'ಆಕಾಶ (test)',
            expected: 'ಆಕಾಶ test'
        },
        {
            input: '  ಆಕಾಶ  ',
            expected: 'ಆಕಾಶ'
        },
        {
            input: '',
            expected: ''
        }
    ];
    
    let passed = 0;
    let failed = 0;
    
    tests.forEach(test => {
        const result = cleanKannadaEntry(test.input);
        if (result === test.expected) {
            console.log(`  ✅ "${test.input}" → "${result}"`);
            passed++;
        } else {
            console.log(`  ❌ "${test.input}"`);
            console.log(`     Expected: "${test.expected}"`);
            console.log(`     Got:      "${result}"`);
            failed++;
        }
    });
    
    console.log(`\n📊 cleanKannadaEntry tests: ${passed} passed, ${failed} failed\n`);
    return failed === 0;
}

// Run all tests
function runAllTests() {
    console.log('🚀 Running UI tests...\n');
    
    const results = [
        testCleanKannadaEntry(),
        testURLEncoding(),
        testAlarLinkGeneration()
    ];
    
    const allPassed = results.every(r => r === true);
    
    console.log('═══════════════════════════════════════');
    if (allPassed) {
        console.log('✅ All tests passed!');
        return 0;
    } else {
        console.log('❌ Some tests failed');
        return 1;
    }
}

// Run if called directly
if (require.main === module) {
    process.exit(runAllTests());
}

module.exports = {
    testAlarLinkGeneration,
    testURLEncoding,
    testCleanKannadaEntry,
    runAllTests
};

