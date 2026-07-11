const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const {
    computeHealthLevel, computeSeverityScore, levelFromScore, parseErrorDescriptions
} = require('../js/health-logic.js');

// 実データ相当のサンプルを読み込み（S/N等の個人情報はダミー化済み）
const backup = JSON.parse(fs.readFileSync(__dirname + '/fixtures/smart-storage-samples.json', 'utf8'));
const findByModel = (kw) => backup.find(r => r.model.includes(kw));

// 各ディスクのレコードから判定用 context 相当を組み立てて computeHealthLevel に渡す
const runLevel = (rec) => {
    const data = JSON.parse(rec.raw);
    return computeHealthLevel(data, {
        customType: rec.customType,
        health: rec.health,
        hours_val: rec.hours_val,
        lifePercent: rec.lifePercent,
        tbw_val: rec.tbw_val,
        reallocSectors: rec.reallocSectors ?? -1,
        pendingSectors: rec.pendingSectors ?? -1,
        crcErrors: rec.crcErrors ?? -1
    });
};

// ============================================================
// levelFromScore: 7段階変換の境界
// ============================================================
test('levelFromScore: 0はL0', () => {
    assert.strictEqual(levelFromScore(0), 0);
});
test('levelFromScore: 1-9はL1', () => {
    assert.strictEqual(levelFromScore(1), 1);
    assert.strictEqual(levelFromScore(9), 1);
});
test('levelFromScore: 10-99はL2', () => {
    assert.strictEqual(levelFromScore(10), 2);
    assert.strictEqual(levelFromScore(99), 2);
});
test('levelFromScore: 100-999はL3', () => {
    assert.strictEqual(levelFromScore(100), 3);
    assert.strictEqual(levelFromScore(999), 3);
});
test('levelFromScore: 1000-9999はL4', () => {
    assert.strictEqual(levelFromScore(1000), 4);
    assert.strictEqual(levelFromScore(9999), 4);
});
test('levelFromScore: 10000-99999はL5', () => {
    assert.strictEqual(levelFromScore(10000), 5);
    assert.strictEqual(levelFromScore(99999), 5);
});
test('levelFromScore: 100000+はL6', () => {
    assert.strictEqual(levelFromScore(100000), 6);
    assert.strictEqual(levelFromScore(9999999), 6);
});

// ============================================================
// computeSeverityScore: 加算ロジック（HDD）
// ============================================================
test('HDD: 保留セクタは×150', () => {
    const data = { ata_smart_attributes: { table: [] }, ata_smart_error_log: { summary: { count: 0 } } };
    const r = computeSeverityScore(data, {
        customType: 'hdd-25', health: 'PASSED', hours_val: 0, lifePercent: -1, tbw_val: 0,
        reallocSectors: 0, pendingSectors: 8, crcErrors: 0
    });
    assert.strictEqual(r.score, 1200);
    assert.ok(r.reasons.some(s => s.includes('197')));
});

test('HDD: 代替セクタは×100、回復不能は×200、CRCは×1', () => {
    const data = { ata_smart_attributes: { table: [
        { id: 198, raw: { value: 24 } }, { id: 188, raw: { value: 0 } }
    ] }, ata_smart_error_log: { summary: { count: 0 } } };
    const r = computeSeverityScore(data, {
        customType: 'hdd-25', health: 'PASSED', hours_val: 0, lifePercent: -1, tbw_val: 0,
        reallocSectors: 352, pendingSectors: 0, crcErrors: 10
    });
    // 352*100 + 24*200 + 10*1 = 35200 + 4800 + 10 = 40010
    assert.strictEqual(r.score, 40010);
});

test('HDD: エラーログ UNC は件数×5、IDNF は+3000', () => {
    const data = { ata_smart_attributes: { table: [] }, ata_smart_error_log: { summary: {
        count: 13, table: [{ error_description: 'Error: UNC at LBA' }]
    } } };
    const r = computeSeverityScore(data, {
        customType: 'hdd-25', health: 'PASSED', hours_val: 0, lifePercent: -1, tbw_val: 0,
        reallocSectors: 0, pendingSectors: 0, crcErrors: 0
    });
    // 13*5 = 65
    assert.strictEqual(r.score, 65);
});

test('HDD: 通電時間30000H超は超過分を加算', () => {
    const data = { ata_smart_attributes: { table: [] }, ata_smart_error_log: { summary: { count: 0 } } };
    const r = computeSeverityScore(data, {
        customType: 'hdd-25', health: 'PASSED', hours_val: 40000, lifePercent: -1, tbw_val: 0,
        reallocSectors: 0, pendingSectors: 0, crcErrors: 0
    });
    assert.strictEqual(r.score, 10000);
});

test('HDD: Command_Timeout>0 は+500固定（生値不使用）', () => {
    const data = { ata_smart_attributes: { table: [
        { id: 188, raw: { value: 566944400149 } }
    ] }, ata_smart_error_log: { summary: { count: 0 } } };
    const r = computeSeverityScore(data, {
        customType: 'hdd-25', health: 'PASSED', hours_val: 0, lifePercent: -1, tbw_val: 0,
        reallocSectors: 0, pendingSectors: 0, crcErrors: 0
    });
    assert.strictEqual(r.score, 500);
});

// ============================================================
// computeSeverityScore: 加算ロジック（SATA-SSD）
// ============================================================
test('SSD: 残り寿命は(100-life)×50、<=10%は+5000', () => {
    const data = { ata_smart_attributes: { table: [] } };
    const r = computeSeverityScore(data, {
        customType: 'sata-ssd', health: 'PASSED', hours_val: 0, lifePercent: 5, tbw_val: 0,
        reallocSectors: 0, pendingSectors: -1, crcErrors: 0
    });
    // (100-5)*50 + 5000 = 4750 + 5000 = 9750
    assert.strictEqual(r.score, 9750);
});

test('SSD: 残り寿命・書込量ともに取得不能は+2000', () => {
    const data = { ata_smart_attributes: { table: [] } };
    const r = computeSeverityScore(data, {
        customType: 'sata-ssd', health: 'PASSED', hours_val: 0, lifePercent: -1, tbw_val: 0,
        reallocSectors: 0, pendingSectors: -1, crcErrors: 0
    });
    assert.strictEqual(r.score, 2000);
    assert.ok(r.reasons.some(s => s.includes('取得不能')));
});

// ============================================================
// computeSeverityScore: 加算ロジック（NVMe）
// ============================================================
test('NVMe: percentage_used<90 は加点なし', () => {
    const data = { nvme_smart_health_information_log: {
        percentage_used: 2, available_spare: 100, critical_warning: 0, media_errors: 0
    } };
    const r = computeSeverityScore(data, {
        customType: 'nvme', health: 'PASSED', hours_val: 0, lifePercent: -1, tbw_val: 0,
        reallocSectors: -1, pendingSectors: -1, crcErrors: -1
    });
    assert.strictEqual(r.score, 0);
});

test('NVMe: critical_warning≠0 は+20000', () => {
    const data = { nvme_smart_health_information_log: {
        percentage_used: 0, available_spare: 100, critical_warning: 4, media_errors: 0
    } };
    const r = computeSeverityScore(data, {
        customType: 'nvme', health: 'PASSED', hours_val: 0, lifePercent: -1, tbw_val: 0,
        reallocSectors: -1, pendingSectors: -1, crcErrors: -1
    });
    assert.strictEqual(r.score, 20000);
});

test('NVMe: media_errors は×200', () => {
    const data = { nvme_smart_health_information_log: {
        percentage_used: 0, available_spare: 100, critical_warning: 0, media_errors: 3
    } };
    const r = computeSeverityScore(data, {
        customType: 'nvme', health: 'PASSED', hours_val: 0, lifePercent: -1, tbw_val: 0,
        reallocSectors: -1, pendingSectors: -1, crcErrors: -1
    });
    assert.strictEqual(r.score, 600);
});

// ============================================================
// FAILED は無条件 +100000（L6）
// ============================================================
test('health=FAILED は無条件 +100000/L6', () => {
    const r = computeHealthLevel({}, {
        customType: 'sata-ssd', health: 'FAILED', hours_val: 0, lifePercent: -1, tbw_val: 0,
        reallocSectors: -1, pendingSectors: -1, crcErrors: -1
    });
    assert.strictEqual(r.score, 100000);
    assert.strictEqual(r.level, 6);
    assert.ok(r.reasons.some(s => s.includes('FAILED')));
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
// 実データでのスコア検証（サンプルfixture）
// ============================================================
test('computeHealthLevel は level/reasons/score を返す', () => {
    const r = runLevel(findByModel('HTS725050'));
    assert.ok(typeof r.level === 'number');
    assert.ok(Array.isArray(r.reasons));
    assert.ok(typeof r.score === 'number');
    assert.ok(r.reasons.some(s => s.includes('197')));
});
