const { test } = require('node:test');
const assert = require('node:assert');
const { validateImportData } = require('../js/export-logic.js');

// ============================================================
// validateImportData
// ============================================================
test('validateImportData: 配列形式の正常データを返す', () => {
    const data = [{ name: 'ピーマン', children: [] }];
    const result = validateImportData(data);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'ピーマン');
});

test('validateImportData: {products: [...]} 形式も受け入れる', () => {
    const data = { products: [{ name: 'ピーマン', children: [] }] };
    const result = validateImportData(data);
    assert.strictEqual(result.length, 1);
});

test('validateImportData: products欠落は null', () => {
    assert.strictEqual(validateImportData({ windows: [] }), null);
});

test('validateImportData: children非配列のレコードは null', () => {
    const data = [{ name: 'ピーマン', children: 'not array' }];
    assert.strictEqual(validateImportData(data), null);
});

test('validateImportData: name欠落レコードは null', () => {
    const data = [{ category: '野菜', children: [] }];
    assert.strictEqual(validateImportData(data), null);
});

test('validateImportData: null入力は null', () => {
    assert.strictEqual(validateImportData(null), null);
});
