#!/usr/bin/env node
// ============================================================================
// run-all-tests.js - Run all test suites
// ============================================================================

const testUI = require('./test-ui');
const testSearch = require('./test-search');

console.log('═══════════════════════════════════════');
console.log('🧪 RALA TEST SUITE');
console.log('═══════════════════════════════════════\n');

const results = [
    testUI.runAllTests(),
    testSearch.runAllTests()
];

const allPassed = results.every(r => r === 0);

console.log('\n═══════════════════════════════════════');
console.log('📊 FINAL RESULTS');
console.log('═══════════════════════════════════════');

if (allPassed) {
    console.log('✅ All test suites passed!');
    process.exit(0);
} else {
    console.log('❌ Some test suites failed');
    console.log('\n⚠️  Do not push to main until all tests pass!');
    process.exit(1);
}

