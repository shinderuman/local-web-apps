const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { computeHealthLevel, parseErrorDescriptions } = require('../js/health-logic.js');

// hoge.json の実データを読み込み
const backup = JSON.parse(fs.readFileSync(__dirname + '/../hoge.json', 'utf8'));
const findByModel = (kw) => backup.find(r => r.model.includes(kw));

// 各ディスクのレコードから判定用 context 相当を組み立てて computeHealthLevel に渡す
const runLevel = (rec) => {
    const data = JSON.parse(rec.raw);
    return computeHealthLevel(data, {
        customType: rec.customType,
        health: rec.health,
        hours_val: rec.hours_val,
        lifePercent: rec.lifePercent,
        reallocSectors: rec.reallocSectors ?? -1,
        pendingSectors: rec.pendingSectors ?? -1,
        crcErrors: rec.crcErrors ?? -1,
    });
};

// ============================================================
// 実データ9ディスクでのレベル判定（前回検証済み結果）
// ============================================================
test('CT250MX500SSD1: CRC>0 → L1', () => {
    assert.strictEqual(runLevel(findByModel('CT250MX500')).level, 1);
});

test('SanDisk SD8SB8U: 全て正常 → L0', () => {
    assert.strictEqual(runLevel(findByModel('SanDisk SD8SB8U')).level, 0);
});

test('APPLE SSD AP0256Z: NVMe percentage_used=2 → L0', () => {
    assert.strictEqual(runLevel(findByModel('APPLE SSD')).level, 0);
});

test('ST500LM000: エラーログにUNC → L3', () => {
    const r = runLevel(findByModel('ST500LM000'));
    assert.strictEqual(r.level, 3);
    assert.ok(r.reasons.some(s => s.includes('UNC')));
});

test('HITACHI HTS545032A7E380: 正常 → L0', () => {
    assert.strictEqual(runLevel(findByModel('HTS545032A7E380')).level, 0);
});

test('Hitachi HTS545050A7E380: 通電時間+CRC+ICRC → L2', () => {
    assert.strictEqual(runLevel(findByModel('HTS545050A7E380')).level, 2);
});

test('ST500LM030: Command Timeout >0 → L1', () => {
    assert.strictEqual(runLevel(findByModel('ST500LM030')).level, 1);
});

test('HGST HTS545050A7E380: CRC+ICRC大量 → L1', () => {
    assert.strictEqual(runLevel(findByModel('HGST HTS545050A7E380')).level, 1);
});

test('HGST HTS725050A7E630: 保留中セクタ144 → L3（PASSEDなのに要交換）', () => {
    const r = runLevel(findByModel('HTS725050'));
    assert.strictEqual(r.level, 3);
    assert.ok(r.reasons.some(s => s.includes('197')));
});

// ============================================================
// parseErrorDescriptions
// ============================================================
test('parseErrorDescriptions: UNCを検出', () => {
    const summary = { count: 1, table: [{ error_description: 'Error: UNC at LBA = 0x008b19c6' }] };
    const r = parseErrorDescriptions(summary);
    assert.strictEqual(r.errCount, 1);
    assert.strictEqual(r.hasUNC, true);
    assert.strictEqual(r.hasIDNF, false);
});

test('parseErrorDescriptions: ICRC/ABRTを検出', () => {
    const summary = { count: 6, table: [{ error_description: 'Error: ICRC, ABRT at LBA = 511' }] };
    const r = parseErrorDescriptions(summary);
    assert.strictEqual(r.hasICRC, true);
    assert.strictEqual(r.hasABRT, true);
    assert.strictEqual(r.hasUNC, false);
});

test('parseErrorDescriptions: summary無しは全てfalse/0', () => {
    const r = parseErrorDescriptions(undefined);
    assert.strictEqual(r.errCount, 0);
    assert.strictEqual(r.hasUNC, false);
});

// ============================================================
// FAILED は無条件 L3
// ============================================================
test('health=FAILED は無条件 L3', () => {
    const r = computeHealthLevel({}, { customType: 'sata-ssd', health: 'FAILED', hours_val: 0, lifePercent: -1, reallocSectors: -1, pendingSectors: -1, crcErrors: -1 });
    assert.strictEqual(r.level, 3);
});
