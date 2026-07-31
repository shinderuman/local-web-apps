const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildSummary,
    createChartEmptyMessage,
    createChartItems,
    createChartLegendRatio,
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

test('返金は月額とカテゴリ合計から差し引く', () => {
    const summary = buildSummary(
        [
            transactions[0],
            {
                id: 4,
                monthKey: '2026-07',
                amount: -200,
                allocations: [
                    {
                        categoryId: 'fun',
                        subcategoryId: 'kindle',
                        amount: -200
                    }
                ]
            }
        ],
        categories,
        subcategories
    );

    assert.equal(summary.totalAmount, 800);
    assert.equal(summary.categories[0].amount, 400);
    assert.deepEqual(summary.categories[0].subcategories, [
        { name: 'Kindle', amount: 400 }
    ]);
});

test('返金超過カテゴリは凡例へ残し円グラフの扇形から除外する', () => {
    const items = createChartItems(
        {
            categories: [
                { name: '遊び', amount: 1000, color: '#000' },
                { name: '生活用品', amount: -300, color: '#111' },
                { name: '月額', amount: 0, color: '#222' }
            ],
            unknownAmount: -100
        },
        '#f00'
    );

    assert.deepEqual(items, [
        {
            label: '遊び',
            amount: 1000,
            chartAmount: 1000,
            color: '#000'
        },
        {
            label: '生活用品',
            amount: -300,
            chartAmount: 0,
            color: '#111'
        },
        {
            label: '不明',
            amount: -100,
            chartAmount: 0,
            color: '#f00'
        }
    ]);
});

test('返金超過と正の支出の凡例表示を返す', () => {
    assert.equal(
        createChartLegendRatio({ amount: -300, chartAmount: 0 }, 1000),
        '返金超過'
    );
    assert.equal(
        createChartLegendRatio({ amount: 250, chartAmount: 250 }, 1000),
        '25%'
    );
});

test('支出がない円グラフの表示文言を返す', () => {
    assert.equal(createChartEmptyMessage([]), 'データなし');
    assert.equal(
        createChartEmptyMessage([{ amount: -100, chartAmount: 0 }]),
        '返金のみ'
    );
});
