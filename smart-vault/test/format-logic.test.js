const { test } = require('node:test');
const assert = require('node:assert');
const {
    formatHours,
    formatTemp,
    formatTbw,
    formatCount,
    formatPowerOnHours,
    formatBw,
    formatIops,
    formatLatency
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

// ============================================================
// formatBw: 帯域
// ============================================================
test('formatBw: 0はダッシュ', () => {
    assert.strictEqual(formatBw(0), '--');
});

test('formatBw: KiB/s は小数1桁', () => {
    assert.strictEqual(formatBw(51200), '50.0 KiB/s');
});

test('formatBw: MiB/s は小数1桁', () => {
    assert.strictEqual(formatBw(360243752), '343.6 MiB/s');
});

test('formatBw: GiB/s は小数1桁', () => {
    assert.strictEqual(formatBw(3221225472), '3.0 GiB/s');
});

// ============================================================
// formatIops: IOPS
// ============================================================
test('formatIops: 0はダッシュ', () => {
    assert.strictEqual(formatIops(0), '--');
});

test('formatIops: 小数は四捨五入・3桁カンマ', () => {
    assert.strictEqual(formatIops(3720.937), '3,721 IOPS');
});

// ============================================================
// formatLatency: レイテンシ
// ============================================================
test('formatLatency: 0はダッシュ', () => {
    assert.strictEqual(formatLatency(0), '--');
});

test('formatLatency: us 単位', () => {
    assert.strictEqual(formatLatency(64000), '64.0 us');
});

test('formatLatency: ms 単位', () => {
    assert.strictEqual(formatLatency(2907020), '2.9 ms');
});
