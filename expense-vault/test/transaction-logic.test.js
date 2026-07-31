const test = require('node:test');
const assert = require('node:assert/strict');
const {
    CLASSIFICATION_SOURCE,
    buildImportPlan,
    buildLearnedClassifications,
    createEqualAllocationAmounts,
    parseStatementKey,
    validateAllocations
} = require('../js/transaction-logic.js');

const createTransaction = (overrides = {}) => {
    const monthKey = overrides.monthKey || '2026-07';

    return {
        id: 1,
        usedAt: '2026-07-26',
        monthKey,
        statementKey:
            overrides.statementKey === undefined
                ? monthKey
                : overrides.statementKey,
        merchant: 'ＡＭＡＺＯＮ．ＣＯ．ＪＰ',
        amount: 1312,
        sourceType: 'provisional',
        allocations: [],
        classificationSource: CLASSIFICATION_SOURCE.UNKNOWN,
        ...overrides
    };
};

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

test('学習履歴がない不明明細は再分類されず不明のまま', () => {
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
        existingTransactions: [unknownTransaction],
        manualRules: [],
        sourceType: 'confirmed',
        importedAt: '2026-07-31T00:00:00.000Z',
        importBatchId: 'batch-no-history'
    });

    assert.equal(plan.recordsToSave[0].id, 1);
    assert.equal(
        plan.recordsToSave[0].classificationSource,
        CLASSIFICATION_SOURCE.UNKNOWN
    );
    assert.deepEqual(plan.recordsToSave[0].allocations, []);
});

test('常に手動分類する店舗の不明明細は要手動のまま', () => {
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
        existingTransactions: [unknownTransaction],
        manualRules: [
            {
                enabled: true,
                pattern: 'NETFLIX',
                matchType: 'equals'
            }
        ],
        sourceType: 'confirmed',
        importedAt: '2026-07-31T00:00:00.000Z',
        importBatchId: 'batch-manual-required'
    });

    assert.equal(plan.recordsToSave[0].id, 1);
    assert.equal(
        plan.recordsToSave[0].classificationSource,
        CLASSIFICATION_SOURCE.MANUAL_REQUIRED
    );
    assert.deepEqual(plan.recordsToSave[0].allocations, []);
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
    assert.equal(plan.statistics.newCount, 0);
});

test('CSVファイル名から明細所属月を取得する', () => {
    assert.equal(parseStatementKey('202607.csv'), '2026-07');
    assert.equal(parseStatementKey('202607 (1).csv'), '2026-07');
    assert.throws(() => parseStatementKey('card.csv'));
});

test('月またぎCSVの再取込で前月CSV所属の明細を削除しない', () => {
    const previousStatement = createTransaction({
        id: 1,
        usedAt: '2026-06-20',
        monthKey: '2026-06',
        statementKey: '2026-06',
        merchant: '6月明細',
        amount: 1000,
        sourceType: 'confirmed'
    });
    const currentStatement = createTransaction({
        id: 2,
        usedAt: '2026-06-30',
        monthKey: '2026-06',
        statementKey: '2026-07',
        merchant: '7月明細の前月利用',
        amount: 2000,
        sourceType: 'confirmed'
    });
    const plan = buildImportPlan({
        incomingRecords: [
            {
                usedAt: currentStatement.usedAt,
                monthKey: currentStatement.monthKey,
                merchant: currentStatement.merchant,
                amount: currentStatement.amount,
                sourceType: 'confirmed'
            },
            {
                usedAt: '2026-07-10',
                monthKey: '2026-07',
                merchant: '7月明細',
                amount: 3000,
                sourceType: 'confirmed'
            }
        ],
        existingTransactions: [previousStatement, currentStatement],
        manualRules: [],
        sourceType: 'confirmed',
        statementKey: '2026-07',
        importedAt: '2026-08-01T00:00:00.000Z',
        importBatchId: 'batch-july'
    });

    assert.deepEqual(plan.deleteIds, [2]);
    assert.equal(
        plan.recordsToSave.every(
            (transaction) => transaction.statementKey === '2026-07'
        ),
        true
    );
});

test('旧データ照合で翌月の別バッチを削除しない', () => {
    const currentStatement = createTransaction({
        id: 1,
        usedAt: '2026-07-10',
        monthKey: '2026-07',
        statementKey: null,
        merchant: '7月明細',
        amount: 3000,
        sourceType: 'confirmed',
        importBatchId: 'legacy-july'
    });
    const nextStatement = createTransaction({
        id: 2,
        usedAt: '2026-07-20',
        monthKey: '2026-07',
        statementKey: null,
        merchant: '8月明細',
        amount: 4000,
        sourceType: 'confirmed',
        importBatchId: 'legacy-august'
    });
    const plan = buildImportPlan({
        incomingRecords: [
            {
                usedAt: currentStatement.usedAt,
                monthKey: currentStatement.monthKey,
                merchant: currentStatement.merchant,
                amount: currentStatement.amount,
                sourceType: 'confirmed'
            }
        ],
        existingTransactions: [currentStatement, nextStatement],
        manualRules: [],
        sourceType: 'confirmed',
        statementKey: '2026-07',
        importedAt: '2026-08-01T00:00:00.000Z',
        importBatchId: 'batch-july'
    });

    assert.deepEqual(plan.deleteIds, [1]);
    assert.equal(plan.recordsToSave[0].id, 1);
    assert.equal(plan.recordsToSave[0].statementKey, '2026-07');
});

test('返金明細は同じ符号の按分を許可する', () => {
    assert.equal(
        validateAllocations(-1000, [
            {
                categoryId: 'daily',
                subcategoryId: null,
                amount: -600
            },
            {
                categoryId: 'fun',
                subcategoryId: null,
                amount: -400
            }
        ]),
        true
    );
    assert.equal(
        validateAllocations(-1000, [
            {
                categoryId: 'daily',
                subcategoryId: null,
                amount: 1000
            },
            {
                categoryId: 'fun',
                subcategoryId: null,
                amount: -2000
            }
        ]),
        false
    );
});

test('返金明細の均等按分は端数を最後へ寄せる', () => {
    assert.deepEqual(
        createEqualAllocationAmounts(-1000, 3),
        [-333, -333, -334]
    );
});

test('返金明細を手動分類履歴から自動分類する', () => {
    const learnedTransaction = createTransaction({
        id: 1,
        merchant: 'NETFLIX',
        amount: 1590,
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
                usedAt: '2026-07-20',
                monthKey: '2026-07',
                merchant: 'NETFLIX',
                amount: -1590,
                sourceType: 'confirmed'
            }
        ],
        existingTransactions: [learnedTransaction],
        manualRules: [],
        sourceType: 'confirmed',
        statementKey: '2026-07',
        importedAt: '2026-08-01T00:00:00.000Z',
        importBatchId: 'batch-refund'
    });

    assert.deepEqual(plan.recordsToSave[0].allocations, [
        {
            categoryId: 'monthly',
            subcategoryId: null,
            amount: -1590
        }
    ]);
    assert.equal(
        plan.recordsToSave[0].classificationSource,
        CLASSIFICATION_SOURCE.AUTOMATIC
    );
});
