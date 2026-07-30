const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildBackupData,
    validateBackupData
} = require('../js/export-logic.js');

test('正しいバックアップを検証できる', () => {
    const backup = buildBackupData({
        transactions: [
            {
                usedAt: '2026-07-01',
                merchant: '店舗',
                amount: 100,
                allocations: []
            }
        ],
        categories: [],
        subcategories: [],
        manualRules: [],
        exportedAt: '2026-07-31T00:00:00.000Z'
    });

    assert.deepEqual(validateBackupData(backup), {
        transactions: backup.transactions,
        categories: [],
        subcategories: [],
        manualRules: []
    });
});

test('別アプリのJSONは拒否する', () => {
    assert.equal(validateBackupData({ app: 'other', version: 1 }), null);
});
