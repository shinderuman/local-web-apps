const { test } = require('node:test');
const assert = require('node:assert');
const {
    calcPriceSummary,
    getAllStores,
    sortHistories,
    sortProducts,
    filterByCategory,
    isValidProductInput,
    isValidHistoryInput,
    buildNewProduct,
    buildNewHistory,
    appendProductHistory,
    removeProductHistory,
    updateProductHistory,
    reorderProducts
} = require('../js/price-logic.js');

// ============================================================
// calcPriceSummary: 最安値/最高値サマリの1走査算出
// ============================================================
test('calcPriceSummary: min/max/各履歴/最新日付を返す', () => {
    const children = [
        { price: 198, store: 'A', date: '2025-01-01' },
        { price: 98, store: 'B', date: '2025-02-01' },
        { price: 250, store: 'C', date: '2025-03-01' }
    ];
    const s = calcPriceSummary(children);
    assert.strictEqual(s.min, 98);
    assert.strictEqual(s.max, 250);
    assert.strictEqual(s.minHistories.length, 1);
    assert.strictEqual(s.minHistories[0].store, 'B');
    assert.strictEqual(s.maxHistories.length, 1);
    assert.strictEqual(s.maxHistories[0].store, 'C');
    assert.strictEqual(s.latestMinDate, '2025-02-01');
});

test('calcPriceSummary: 最安値同額が複数なら全て抽出し最新日付を返す', () => {
    const children = [
        { price: 98, store: 'B', date: '2025-01-01' },
        { price: 98, store: 'D', date: '2025-04-01' },
        { price: 250, store: 'C', date: '2025-03-01' }
    ];
    const s = calcPriceSummary(children);
    assert.strictEqual(s.minHistories.length, 2);
    assert.strictEqual(s.latestMinDate, '2025-04-01');
});

test('calcPriceSummary: 空配列は null と空配列', () => {
    const s = calcPriceSummary([]);
    assert.strictEqual(s.min, null);
    assert.strictEqual(s.max, null);
    assert.deepStrictEqual(s.minHistories, []);
    assert.deepStrictEqual(s.maxHistories, []);
    assert.strictEqual(s.latestMinDate, null);
});

test('calcPriceSummary: 非数値priceを除外', () => {
    const children = [{ price: 'abc' }, { price: 100 }, { price: 200 }];
    const s = calcPriceSummary(children);
    assert.strictEqual(s.min, 100);
    assert.strictEqual(s.max, 200);
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

// ============================================================
// 商品・履歴操作
// ============================================================

test('appendProductHistory: 履歴を追加し、元の商品を変更しない', () => {
    const product = { name: 'ピーマン', children: [{ price: 100 }] };
    const result = appendProductHistory(product, { price: 120 });

    assert.deepStrictEqual(result.children, [{ price: 100 }, { price: 120 }]);
    assert.deepStrictEqual(product.children, [{ price: 100 }]);
});

test('removeProductHistory: 指定位置の履歴を削除し、元の商品を変更しない', () => {
    const product = { children: [{ price: 100 }, { price: 120 }] };
    const result = removeProductHistory(product, 0);

    assert.deepStrictEqual(result.children, [{ price: 120 }]);
    assert.deepStrictEqual(product.children, [{ price: 100 }, { price: 120 }]);
});

test('updateProductHistory: 商品名と指定位置の履歴を更新し、元の商品を変更しない', () => {
    const product = { name: '旧名', children: [{ price: 100 }, { price: 120 }] };
    const result = updateProductHistory(product, '新名', 1, { price: 150 });

    assert.deepStrictEqual(result, { name: '新名', children: [{ price: 100 }, { price: 150 }] });
    assert.deepStrictEqual(product, { name: '旧名', children: [{ price: 100 }, { price: 120 }] });
});

test('reorderProducts: 指定位置へ移動してsortOrderを振り直し、元配列を変更しない', () => {
    const products = [{ id: 1, sortOrder: 2 }, { id: 2, sortOrder: 1 }, { id: 3, sortOrder: 0 }];
    const result = reorderProducts(products, 2, 0);

    assert.deepStrictEqual(result, [{ id: 3, sortOrder: 0 }, { id: 1, sortOrder: 1 }, { id: 2, sortOrder: 2 }]);
    assert.deepStrictEqual(products, [{ id: 1, sortOrder: 2 }, { id: 2, sortOrder: 1 }, { id: 3, sortOrder: 0 }]);
});
