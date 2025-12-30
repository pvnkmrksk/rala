// ============================================================================
// test-search.js - Tests for search functionality
// ============================================================================

// Mock containsWholeWord function (from search.js)
function containsWholeWord(text, word) {
    if (!text || !word) return false;
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'i');
    return regex.test(text);
}

// Test whole word matching
function testWholeWordMatching() {
    console.log('🧪 Testing whole word matching...');
    
    const tests = [
        {
            name: 'Exact match',
            text: 'test word',
            word: 'test',
            expected: true
        },
        {
            name: 'Word in middle',
            text: 'this is a test word',
            word: 'test',
            expected: true
        },
        {
            name: 'Substring should not match',
            text: 'detest',
            word: 'test',
            expected: false
        },
        {
            name: 'Word at start',
            text: 'test word',
            word: 'test',
            expected: true
        },
        {
            name: 'Word at end',
            text: 'this is test',
            word: 'test',
            expected: true
        },
        {
            name: 'Punctuation boundary',
            text: 'this is test.',
            word: 'test',
            expected: true
        },
        {
            name: 'Case insensitive',
            text: 'This is TEST',
            word: 'test',
            expected: true
        },
        {
            name: 'Empty text',
            text: '',
            word: 'test',
            expected: false
        },
        {
            name: 'Empty word',
            text: 'test word',
            word: '',
            expected: false
        }
    ];
    
    let passed = 0;
    let failed = 0;
    
    tests.forEach(test => {
        const result = containsWholeWord(test.text, test.word);
        if (result === test.expected) {
            console.log(`  ✅ ${test.name}`);
            passed++;
        } else {
            console.log(`  ❌ ${test.name}`);
            console.log(`     Text: "${test.text}", Word: "${test.word}"`);
            console.log(`     Expected: ${test.expected}, Got: ${result}`);
            failed++;
        }
    });
    
    console.log(`\n📊 Whole word matching tests: ${passed} passed, ${failed} failed\n`);
    return failed === 0;
}

// Run all tests
function runAllTests() {
    console.log('🚀 Running search tests...\n');
    
    const results = [
        testWholeWordMatching()
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
    testWholeWordMatching,
    runAllTests
};

