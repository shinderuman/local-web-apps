const test = require('node:test');
const assert = require('node:assert/strict');
const {
    CLASSIFICATION_SOURCE,
    buildImportPlan,
    buildLearnedClassifications,
    createEqualAllocationAmounts
} = require('../js/transaction-logic.js');

const createTransaction = (overrides = {}) => ({
    id: 1,
    usedAt: '2026-07-26',
    monthKey: '2026-07',
    merchant: 'ＡＭＡＺＯＮ．ＣＯ．ＪＰ',
    amount: 1312,
    sourceType: 'provisional',
    allocations: [],
    classificationSource: CLASSIFICATION_SOURCE.UNKNOWN,
    ...overrides
});

test('未確定CSV再取込で完全一致明細の分類を引き継ぐ', () => {
    const existing = createTransaction({
        allocations: [
            {
                categoryId: 'fun',
                subcategoryId: 'kindle',
                amount: 1312
            }
        ],
        classificationSource: CLASSIFICATION_SOURCE.MANUAL
    });
    const plan = buildImportPlan({
        incomingRecords: [
            {
                usedAt: existing.usedAt,
                monthKey: existing.monthKey,
                merchant: existing.merchant,
                amount: existing.amount,
                sourceType: 'provisional'
            }
        ],
        existingTransactions: [existing],
        manualRules: [],
        sourceType: 'provisional',
        importedAt: '2026-07-31T00:00:00.000Z',
        importBatchId: 'batch-1'
    });

    assert.deepEqual(plan.deleteIds, [1]);
    assert.equal(plan.recordsToSave[0].id, 1);
    assert.deepEqual(plan.recordsToSave[0].allocations, existing.allocations);
    assert.equal(plan.statistics.inheritedCount, 1);
});

test('確定CSV取込は同月の未確定レコードを置換対象にする', () => {
    const existing = createTransaction();
    const plan = buildImportPlan({
        incomingRecords: [
            {
                usedAt: '2026-07-27',
                monthKey: '2026-07',
                merchant: '別店舗',
                amount: 500,
                sourceType: 'confirmed'
            }
        ],
        existingTransactions: [existing],
        manualRules: [],
        sourceType: 'confirmed',
        importedAt: '2026-07-31T00:00:00.000Z',
        importBatchId: 'batch-2'
    });

    assert.deepEqual(plan.deleteIds, [1]);
    assert.equal(plan.recordsToSave[0].sourceType, 'confirmed');
});

test('手動分類履歴の最頻値だけを自動分類候補にする', () => {
    const learned = buildLearnedClassifications([
        createTransaction({
            id: 1,
            merchant: 'NETFLIX',
            allocations: [
                { categoryId: 'monthly', subcategoryId: null, amount: 1000 }
            ],
            classificationSource: CLASSIFICATION_SOURCE.MANUAL
        }),
        createTransaction({
            id: 2,
            merchant: 'NETFLIX',
            allocations: [
                { categoryId: 'monthly', subcategoryId: null, amount: 1200 }
            ],
            classificationSource: CLASSIFICATION_SOURCE.MANUAL
        }),
        createTransaction({
            id: 3,
            merchant: 'NETFLIX',
            allocations: [
                { categoryId: 'fun', subcategoryId: null, amount: 800 }
            ],
            classificationSource: CLASSIFICATION_SOURCE.MANUAL
        })
    ]);

    assert.deepEqual(learned.get('NETFLIX'), {
        categoryId: 'monthly',
        subcategoryId: null
    });
});

test('均等按分は端数を最後の割当に寄せる', () => {
    assert.deepEqual(createEqualAllocationAmounts(1000, 3), [333, 333, 334]);
});

test('一致した既存明細が不明なら過去の手動分類履歴で再分類する', () => {
    const unknownTransaction = createTransaction({
        id: 1,
        usedAt: '2026-04-10',
        monthKey: '2026-04',
        merchant: 'NETFLIX',
        amount: 1590,
        sourceType: 'confirmed',
        allocations: [],
        classificationSource: CLASSIFICATION_SOURCE.UNKNOWN
    });
    const learnedTransaction = createTransaction({
        id: 2,
        usedAt: '2026-05-10',
        monthKey: '2026-05',
        merchant: 'NETFLIX',
        amount: 1590,
        sourceType: 'confirmed',
        allocations: [
            {
                categoryId: 'monthly',
                subcategoryId: null,
                amount: 1590
            }
        ],
        classificationSource: CLASSIFICATION_SOURCE.MANUAL
    });
    const plan = buildImportPlan({
        incomingRecords: [
            {
                usedAt: '2026-04-10',
                monthKey: '2026-04',
                merchant: 'NETFLIX',
                amount: 1590,
                sourceType: 'confirmed'
            }
        ],
        existingTransactions: [unknownTransaction, learnedTransaction],
        manualRules: [],
        sourceType: 'confirmed',
        importedAt: '2026-07-31T00:00:00.000Z',
        importBatchId: 'batch-reclassify'
    });

    assert.equal(plan.recordsToSave[0].id, 1);
    assert.equal(
        plan.recordsToSave[0].classificationSource,
        CLASSIFICATION_SOURCE.AUTOMATIC
    );
    assert.deepEqual(plan.recordsToSave[0].allocations, [
        {
            categoryId: 'monthly',
            subcategoryId: null,
            amount: 1590
        }
    ]);
});
