const { test } = require('node:test');
const assert = require('node:assert');
const { compactRaw, prettifyRaw, buildSmartJsonArray } = require('../js/json-normalize-logic.js');

// ============================================================
// compactRaw: JSON文字列のcompact化
// ============================================================
test('compactRaw: インデント付きJSONをcompact化', () => {
    const indented = '{\n  "a": 1,\n  "b": 2\n}';
    assert.strictEqual(compactRaw(indented), '{"a":1,"b":2}');
});

test('compactRaw: compact済みのJSONはそのまま', () => {
    const compact = '{"a":1,"b":2}';
    assert.strictEqual(compactRaw(compact), '{"a":1,"b":2}');
});

test('compactRaw: 空文字列はそのまま', () => {
    assert.strictEqual(compactRaw(''), '');
});

test('compactRaw: 不正JSONは入力をそのまま返す', () => {
    const broken = '{broken json';
    assert.strictEqual(compactRaw(broken), broken);
});

// ============================================================
// prettifyRaw: JSON文字列のインデント整形
// ============================================================
test('prettifyRaw: compactJSONをインデント付きに整形', () => {
    const result = prettifyRaw('{"a":1,"b":2}');
    assert.ok(result.includes('"a": 1'));
    assert.ok(result.includes('\n'));
});

test('prettifyRaw: 空文字列はそのまま', () => {
    assert.strictEqual(prettifyRaw(''), '');
});

test('prettifyRaw: 不正JSONは入力をそのまま返す', () => {
    const broken = '{broken json';
    assert.strictEqual(prettifyRaw(broken), broken);
});

// ============================================================
// 往復: compact → prettify で意味を保持
// ============================================================
test('往復: prettifyRaw(compactRaw(x)) で元のJSONオブジェクトを保持', () => {
    const original = '{\n  "serial_number": "ABC",\n  "size": 100\n}';
    const round = prettifyRaw(compactRaw(original));
    assert.deepStrictEqual(JSON.parse(round), JSON.parse(original));
});

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
