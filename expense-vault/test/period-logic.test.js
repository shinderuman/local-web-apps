const { test } = require('node:test');
const assert = require('node:assert');
const { serializePeriod, deserializePeriod } = require('../js/period-logic.js');

test('serializePeriod: 期間オブジェクトをJSON文字列化', () => {
    const period = {
        mode: 'range',
        month: '2026-08',
        rangeStart: '2026-01',
        rangeEnd: '2026-08'
    };
    const json = serializePeriod(period);
    const parsed = JSON.parse(json);
    assert.strictEqual(parsed.mode, 'range');
    assert.strictEqual(parsed.month, '2026-08');
    assert.strictEqual(parsed.rangeStart, '2026-01');
    assert.strictEqual(parsed.rangeEnd, '2026-08');
});

test('deserializePeriod: 全フィールド存在ならそのまま復元', () => {
    const json = JSON.stringify({
        mode: 'range',
        month: '2026-08',
        rangeStart: '2026-01',
        rangeEnd: '2026-08'
    });
    const state = deserializePeriod(json, '2026-08');
    assert.strictEqual(state.mode, 'range');
    assert.strictEqual(state.month, '2026-08');
    assert.strictEqual(state.rangeStart, '2026-01');
    assert.strictEqual(state.rangeEnd, '2026-08');
});

test('deserializePeriod: mode欠落・不正値ならmonthly', () => {
    const json = '{}';
    const state = deserializePeriod(json, '2026-08');
    assert.strictEqual(state.mode, 'monthly');
});

test('deserializePeriod: month欠落ならfallbackMonth', () => {
    const json = JSON.stringify({ mode: 'monthly' });
    const state = deserializePeriod(json, '2026-07');
    assert.strictEqual(state.month, '2026-07');
});

test('deserializePeriod: rangeStart/rangeEnd欠落ならnull', () => {
    const json = JSON.stringify({ mode: 'monthly', month: '2026-08' });
    const state = deserializePeriod(json, '2026-08');
    assert.strictEqual(state.rangeStart, null);
    assert.strictEqual(state.rangeEnd, null);
});

test('deserializePeriod: 空文字のmonthはfallbackMonth', () => {
    const json = JSON.stringify({ mode: 'monthly', month: '' });
    const state = deserializePeriod(json, '2026-08');
    assert.strictEqual(state.month, '2026-08');
});

test('deserializePeriod: 不正な月文字列はfallbackMonth', () => {
    const json = JSON.stringify({ mode: 'monthly', month: '2026-13' });
    const state = deserializePeriod(json, '2026-08');
    assert.strictEqual(state.month, '2026-08');
});

test('deserializePeriod: 空文字のrangeStart/rangeEndはnull', () => {
    const json = JSON.stringify({
        mode: 'range',
        month: '2026-08',
        rangeStart: '',
        rangeEnd: ''
    });
    const state = deserializePeriod(json, '2026-08');
    assert.strictEqual(state.rangeStart, null);
    assert.strictEqual(state.rangeEnd, null);
});

test('deserializePeriod: 無効JSONならnull', () => {
    const state = deserializePeriod('not json', '2026-08');
    assert.strictEqual(state, null);
});

test('deserializePeriod: 空文字ならnull', () => {
    const state = deserializePeriod('', '2026-08');
    assert.strictEqual(state, null);
});
