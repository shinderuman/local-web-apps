const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildSummary,
    filterTransactionsByPeriod
} = require('../js/summary-logic.js');

const categories = [
    { id: 'fun', name: '遊び', color: '#000', sortOrder: 0 },
    { id: 'daily', name: '生活用品', color: '#111', sortOrder: 1 }
];
const subcategories = [
    { id: 'kindle', categoryId: 'fun', name: 'Kindle', sortOrder: 0 }
];
const transactions = [
    {
        id: 1,
        monthKey: '2026-07',
        amount: 1000,
        allocations: [
            { categoryId: 'fun', subcategoryId: 'kindle', amount: 600 },
            { categoryId: 'daily', subcategoryId: null, amount: 400 }
        ]
    },
    {
        id: 2,
        monthKey: '2026-07',
        amount: 500,
        allocations: []
    },
    {
        id: 3,
        monthKey: '2026-06',
        amount: 200,
        allocations: [{ categoryId: 'fun', subcategoryId: null, amount: 200 }]
    }
];

test('月次指定は指定月だけを返す', () => {
    const filtered = filterTransactionsByPeriod(transactions, {
        mode: 'monthly',
        month: '2026-07'
    });

    assert.deepEqual(
        filtered.map((item) => item.id),
        [1, 2]
    );
});

test('指定期間は複数月をまとめて返す', () => {
    const filtered = filterTransactionsByPeriod(transactions, {
        mode: 'range',
        startMonth: '2026-06',
        endMonth: '2026-07'
    });

    assert.equal(filtered.length, 3);
});

test('按分・サブカテゴリ・不明を集計する', () => {
    const summary = buildSummary(
        transactions.slice(0, 2),
        categories,
        subcategories
    );

    assert.equal(summary.totalAmount, 1500);
    assert.equal(summary.unknownAmount, 500);
    assert.equal(summary.unknownCount, 1);
    assert.equal(summary.categories[0].amount, 600);
    assert.deepEqual(summary.categories[0].subcategories, [
        { name: 'Kindle', amount: 600 }
    ]);
});
