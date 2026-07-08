const { test } = require('node:test');
const assert = require('node:assert');
const {
    formatHours,
    formatTemp,
    formatTbw,
    formatCount,
    formatPowerOnHours,
} = require('../js/format-logic.js');

// ============================================================
// formatHours: 通電時間
// ============================================================
test('formatHours: 0は不明', () => {
    assert.strictEqual(formatHours(0), '不明');
});

test('formatHours: 正の数は "N H"', () => {
    assert.strictEqual(formatHours(321), '321 H');
});

// ============================================================
// formatTemp: 温度
// ============================================================
test('formatTemp: 0は不明', () => {
    assert.strictEqual(formatTemp(0), '不明');
});

test('formatTemp: 正の数は "N °C"', () => {
    assert.strictEqual(formatTemp(46), '46 °C');
});

// ============================================================
// formatTbw: 総書込量
// ============================================================
test('formatTbw: 0はダッシュ', () => {
    assert.strictEqual(formatTbw(0), '--');
});

test('formatTbw: 正の数は小数1桁のTBW', () => {
    assert.strictEqual(formatTbw(35.313417), '35.3 TBW');
});

// ============================================================
// formatCount: セクタ数等の個数表示（-1=未取得）
// ============================================================
test('formatCount: -1はダッシュ', () => {
    assert.strictEqual(formatCount(-1), '-');
});

test('formatCount: 0以上はそのまま文字列', () => {
    assert.strictEqual(formatCount(0), '0');
    assert.strictEqual(formatCount(144), '144');
});

// ============================================================
// formatPowerOnHours: 通電時間 / 電源回数
// ============================================================
test('formatPowerOnHours: "H / N回" 形式', () => {
    assert.strictEqual(formatPowerOnHours('321 H', 263), '321 H / 263回');
});

test('formatPowerOnHours: 不明値もそのまま結合', () => {
    assert.strictEqual(formatPowerOnHours('不明', '不明'), '不明 / 不明回');
});
