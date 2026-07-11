const { test } = require('node:test');
const assert = require('node:assert');
const {
    calcMinPrice,
    calcMaxPrice,
    getAllStores,
    sortHistories,
    sortProducts,
    filterByCategory,
    isValidProductInput,
    isValidHistoryInput,
    buildNewProduct,
    buildNewHistory
} = require('../js/price-logic.js');

// ============================================================
// calcMinPrice / calcMaxPrice
// ============================================================
test('calcMinPrice: 履歴配列の最小priceを返す', () => {
    const children = [{ price: 198 }, { price: 98 }, { price: 250 }];
    assert.strictEqual(calcMinPrice(children), 98);
});

test('calcMaxPrice: 履歴配列の最大priceを返す', () => {
    const children = [{ price: 198 }, { price: 98 }, { price: 250 }];
    assert.strictEqual(calcMaxPrice(children), 250);
});

test('calcMinPrice/calcMaxPrice: 空配列は null', () => {
    assert.strictEqual(calcMinPrice([]), null);
    assert.strictEqual(calcMaxPrice([]), null);
});

test('calcMinPrice/calcMaxPrice: 履歴1件は同値', () => {
    const children = [{ price: 150 }];
    assert.strictEqual(calcMinPrice(children), 150);
    assert.strictEqual(calcMaxPrice(children), 150);
});

test('calcMinPrice: 非数値priceを除外', () => {
    const children = [{ price: 'abc' }, { price: 100 }, { price: 200 }];
    assert.strictEqual(calcMinPrice(children), 100);
});

// ============================================================
// getAllStores
// ============================================================
test('getAllStores: 重複店名をマージ', () => {
    const children = [
        { store: 'イオン' }, { store: '西友' }, { store: 'イオン' }
    ];
    assert.deepStrictEqual(getAllStores(children), ['イオン', '西友']);
});

test('getAllStores: 空文字店名を除外', () => {
    const children = [{ store: 'イオン' }, { store: '' }, { store: '  ' }];
    assert.deepStrictEqual(getAllStores(children), ['イオン']);
});

test('getAllStores: 空配列は空配列', () => {
    assert.deepStrictEqual(getAllStores([]), []);
});

// ============================================================
// sortHistories
// ============================================================
test('sortHistories: 日付降順（最新が先頭）', () => {
    const children = [
        { date: '2025-01-01' }, { date: '2025-03-01' }, { date: '2025-02-01' }
    ];
    const result = sortHistories(children);
    assert.deepStrictEqual(
        result.map(c => c.date),
        ['2025-03-01', '2025-02-01', '2025-01-01']
    );
});

test('sortHistories: 非破壊（元配列を変更しない）', () => {
    const children = [{ date: '2025-01-01' }, { date: '2025-03-01' }];
    const original = children.map(c => c.date);
    sortHistories(children);
    assert.deepStrictEqual(children.map(c => c.date), original);
});

// ============================================================
// sortProducts
// ============================================================
test('sortProducts: name=商品名順', () => {
    const products = [{ name: 'みかん' }, { name: 'りんご' }, { name: 'バナナ' }];
    const result = sortProducts(products, 'name');
    assert.deepStrictEqual(
        result.map(p => p.name),
        ['バナナ', 'みかん', 'りんご']
    );
});

test('sortProducts: createdAt=登録順', () => {
    const products = [{ name: 'B', createdAt: 2 }, { name: 'A', createdAt: 1 }];
    const result = sortProducts(products, 'createdAt');
    assert.deepStrictEqual(
        result.map(p => p.name),
        ['A', 'B']
    );
});

test('sortProducts: 非破壊', () => {
    const products = [{ name: 'B', createdAt: 2 }, { name: 'A', createdAt: 1 }];
    sortProducts(products, 'name');
    assert.strictEqual(products[0].name, 'B');
});

// ============================================================
// filterByCategory
// ============================================================
test('filterByCategory: category=null で全件', () => {
    const products = [{ category: '野菜' }, { category: '果物' }];
    assert.strictEqual(filterByCategory(products, null).length, 2);
});

test('filterByCategory: 一致カテゴリのみ', () => {
    const products = [{ category: '野菜' }, { category: '果物' }];
    assert.strictEqual(filterByCategory(products, '野菜').length, 1);
});

test('filterByCategory: 該当なしは空配列', () => {
    const products = [{ category: '野菜' }];
    assert.strictEqual(filterByCategory(products, '肉').length, 0);
});

// ============================================================
// isValidProductInput / isValidHistoryInput
// ============================================================
test('isValidProductInput: 商品名あり=true', () => {
    assert.strictEqual(isValidProductInput('ピーマン'), true);
});

test('isValidProductInput: 商品名空=false', () => {
    assert.strictEqual(isValidProductInput(''), false);
    assert.strictEqual(isValidProductInput('   '), false);
});

test('isValidHistoryInput: 値段数値+日付あり=true', () => {
    assert.strictEqual(isValidHistoryInput(100, '2025-01-01'), true);
});

test('isValidHistoryInput: 値段非数=false', () => {
    assert.strictEqual(isValidHistoryInput('abc', '2025-01-01'), false);
});

test('isValidHistoryInput: 日付空=false', () => {
    assert.strictEqual(isValidHistoryInput(100, ''), false);
});

// ============================================================
// buildNewProduct / buildNewHistory
// ============================================================
test('buildNewProduct: 全フィールドを格納しcreatedAtは引数値', () => {
    const data = { name: 'ピーマン', category: '野菜', sortOrder: 0, children: [] };
    const result = buildNewProduct(data, 12345);
    assert.strictEqual(result.name, 'ピーマン');
    assert.strictEqual(result.category, '野菜');
    assert.strictEqual(result.createdAt, 12345);
    assert.deepStrictEqual(result.children, []);
});

test('buildNewHistory: 全フィールドを格納しpriceは数値化', () => {
    const data = { price: '100', store: '西友', unitPrice: '1円/g', date: '2025-01-01', memo: 'セール' };
    const result = buildNewHistory(data);
    assert.strictEqual(result.price, 100);
    assert.strictEqual(result.store, '西友');
    assert.strictEqual(result.unitPrice, '1円/g');
    assert.strictEqual(result.date, '2025-01-01');
    assert.strictEqual(result.memo, 'セール');
});

test('buildNewHistory: memo省略時は空文字', () => {
    const data = { price: '100', store: '', unitPrice: '', date: '2025-01-01' };
    const result = buildNewHistory(data);
    assert.strictEqual(result.memo, '');
});
