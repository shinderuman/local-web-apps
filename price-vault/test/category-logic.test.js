const { test } = require('node:test');
const assert = require('node:assert');
const {
    extractCategories,
    countProductsByCategory
} = require('../js/category-logic.js');

// ============================================================
// extractCategories
// ============================================================
test('extractCategories: 重複を排除', () => {
    const products = [
        { category: '野菜' },
        { category: '果物' },
        { category: '野菜' }
    ];
    assert.deepStrictEqual(extractCategories(products), ['野菜', '果物']);
});

test('extractCategories: 空文字カテゴリを除外', () => {
    const products = [
        { category: '野菜' },
        { category: '' },
        { category: '  ' }
    ];
    assert.deepStrictEqual(extractCategories(products), ['野菜']);
});

test('extractCategories: 空配列は空配列', () => {
    assert.deepStrictEqual(extractCategories([]), []);
});

// ============================================================
// countProductsByCategory
// ============================================================
test('countProductsByCategory: 正しい件数を返す', () => {
    const products = [
        { category: '野菜' },
        { category: '野菜' },
        { category: '果物' }
    ];
    assert.strictEqual(countProductsByCategory(products, '野菜'), 2);
    assert.strictEqual(countProductsByCategory(products, '果物'), 1);
});

test('countProductsByCategory: 存在しないカテゴリは0', () => {
    const products = [{ category: '野菜' }];
    assert.strictEqual(countProductsByCategory(products, '肉'), 0);
});
