const { test } = require('node:test');
const assert = require('node:assert');
const { buildSmartJsonArray } = require('../js/export-logic.js');

// ============================================================
// buildSmartJsonArray: raw結合
// ============================================================
test('buildSmartJsonArray: 複数レコードのrawをJSON配列に結合', () => {
    const records = [
        { raw: '{"serial_number":"A","model_name":"DriveA"}' },
        { raw: '{"serial_number":"B","model_name":"DriveB"}' }
    ];
    const result = JSON.parse(buildSmartJsonArray(records));
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].serial_number, 'A');
    assert.strictEqual(result[1].model_name, 'DriveB');
});

test('buildSmartJsonArray: raw空のレコード（手動登録等）は除外', () => {
    const records = [
        { raw: '{"serial_number":"A"}' },
        { raw: '' },
        { isManual: true, raw: '' }
    ];
    const result = JSON.parse(buildSmartJsonArray(records));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].serial_number, 'A');
});

test('buildSmartJsonArray: 有効レコード0件なら null', () => {
    const records = [
        { raw: '' },
        { isManual: true, raw: '' }
    ];
    assert.strictEqual(buildSmartJsonArray(records), null);
});

test('buildSmartJsonArray: 空配列なら null', () => {
    assert.strictEqual(buildSmartJsonArray([]), null);
});

test('buildSmartJsonArray: 不正JSONのrawはスキップ', () => {
    const records = [
        { raw: '{"serial_number":"A"}' },
        { raw: '{broken json' },
        { raw: '{"serial_number":"C"}' }
    ];
    const result = JSON.parse(buildSmartJsonArray(records));
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].serial_number, 'A');
    assert.strictEqual(result[1].serial_number, 'C');
});

test('buildSmartJsonArray: 出力は整形されたJSON文字列（インデント2）', () => {
    const records = [{ raw: '{"a":1}' }];
    const result = buildSmartJsonArray(records);
    assert.ok(result.includes('\n    "a": 1'));
});
