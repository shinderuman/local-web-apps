const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const {
    getAttrRaw,
    pickNum,
    calcSize,
    parseSizeToBytes,
    calcTbw,
    calcLife,
    calcSectorCounts,
    detectCustomType,
} = require('../js/parse-logic.js');

// 実データ相当のサンプルを読み込み（S/N等の個人情報はダミー化済み）
const backup = JSON.parse(fs.readFileSync(__dirname + '/fixtures/smart-storage-samples.json', 'utf8'));
const findByModel = (kw) => JSON.parse(backup.find(r => r.model.includes(kw)).raw);

// ============================================================
// getAttrRaw: ATA属性テーブルからID指定でraw値を数値化
// ============================================================
test('getAttrRaw: 指定IDのraw値を返す', () => {
    const data = findByModel('CT250MX500');
    const table = data.ata_smart_attributes.table;
    // ID 199 (UDMA_CRC_Error_Count) = 14
    assert.strictEqual(getAttrRaw(table, 199), 14);
});

test('getAttrRaw: 存在しないIDは0', () => {
    assert.strictEqual(getAttrRaw([], 999), 0);
    assert.strictEqual(getAttrRaw([{ id: 1, raw: { value: 5 } }], 999), 0);
});

// ============================================================
// pickNum: 第一候補 → NVMeフォールバック → デフォルト
// ============================================================
test('pickNum: 第一候補がある場合はそれを数値化', () => {
    assert.strictEqual(pickNum({ a: { hours: 321 } }, 'a.hours', null, 0), 321);
});

test('pickNum: 第一候補undefined時はNVMeフォールバック', () => {
    const data = { nvme: { power_on_hours: 1035 } };
    assert.strictEqual(pickNum(data, 'missing.path', 'nvme.power_on_hours', 0), 1035);
});

test('pickNum: 両方undefined時はデフォルト', () => {
    assert.strictEqual(pickNum({}, 'a', 'b', 99), 99);
});

// ============================================================
// calcSize: 容量表示（user_capacity優先、モデル名フォールバック）
// ============================================================
test('calcSize: user_capacityがある場合はGB/TB判定', () => {
    const r = calcSize('model', 250059350016);
    assert.strictEqual(r.sizeStr, '250 GB');
    assert.strictEqual(r.sizeBytes, 250059350016);
});

test('calcSize: 1000GB超はTB表示', () => {
    const r = calcSize('model', 1000 * 1000 * 1000 * 1000 * 2);
    assert.strictEqual(r.sizeStr, '2.0 TB');
});

test('calcSize: capacity無しでモデル名にGを含む場合はGB推定', () => {
    const r = calcSize('FooBar 500G', 0);
    assert.strictEqual(r.sizeStr, '500 GB');
    assert.strictEqual(r.sizeBytes, 500 * 1000 * 1000 * 1000);
});

test('calcSize: capacity無しでモデル名にTを含む場合はTB推定', () => {
    const r = calcSize('FooBar 1T', 0);
    assert.strictEqual(r.sizeStr, '1 TB');
    assert.strictEqual(r.sizeBytes, 1 * 1000 * 1000 * 1000 * 1000);
});

// ============================================================
// parseSizeToBytes: 手動入力容量文字列 → バイト数
// ============================================================
test('parseSizeToBytes: GB単位（空白あり/なし両対応）', () => {
    assert.strictEqual(parseSizeToBytes('500GB'), 500 * 1024 ** 3);
    assert.strictEqual(parseSizeToBytes('500 GB'), 500 * 1024 ** 3);
});

test('parseSizeToBytes: TB単位（小数・大文字小文字）', () => {
    assert.strictEqual(parseSizeToBytes('2 TB'), 2 * 1024 ** 4);
    assert.strictEqual(parseSizeToBytes('1.5tb'), 1.5 * 1024 ** 4);
});

test('parseSizeToBytes: MB単位', () => {
    assert.strictEqual(parseSizeToBytes('120MB'), 120 * 1024 ** 2);
});

test('parseSizeToBytes: 単位無しはそのままの数値（バイト扱い）', () => {
    assert.strictEqual(parseSizeToBytes('1024'), 1024);
});

test('parseSizeToBytes: 空・数値以外は0', () => {
    assert.strictEqual(parseSizeToBytes(''), 0);
    assert.strictEqual(parseSizeToBytes('abc'), 0);
});

// ============================================================
// calcTbw: 総書込量（TB）
// ============================================================
test('calcTbw: NVMe data_units_written から算出', () => {
    const data = findByModel('APPLE SSD');
    const tbw = calcTbw(data);
    // 68971519 * 512000 / 10^12 ≒ 35.31
    assert.ok(Math.abs(tbw - 35.31) < 0.1, 'expected ~35.31, got ' + tbw);
});

test('calcTbw: ID241 が GiB 単位（Total_Writes_GiB）', () => {
    // 26315 GiB * 1.073741824 / 1000 ≒ 28.26 TB
    const data = { ata_smart_attributes: { table: [{ id: 241, name: 'Total_Writes_GiB', raw: { value: 26315 } }] } };
    assert.ok(Math.abs(calcTbw(data) - 28.26) < 0.01, 'got ' + calcTbw(data));
});

test('calcTbw: ID241 が LBA 単位（Total_LBAs_Written, 512B/sector）', () => {
    // 19484917029 * 512 / 1e12 ≒ 9.97 TB
    const data = { ata_smart_attributes: { table: [{ id: 241, name: 'Total_LBAs_Written', raw: { value: 19484917029 } }] } };
    assert.ok(Math.abs(calcTbw(data) - 9.97) < 0.01, 'got ' + calcTbw(data));
});

test('calcTbw: ID241 が 32MiB 単位（Host_Writes_32MiB）', () => {
    // 12252475699 * 33554432 / 1e12 ≒ 411125 TB
    const data = { ata_smart_attributes: { table: [{ id: 241, name: 'Host_Writes_32MiB', raw: { value: 12252475699 } }] } };
    assert.ok(Math.abs(calcTbw(data) - 411125) < 1, 'got ' + calcTbw(data));
});

test('calcTbw: ID241 が無ければ ID246 を使用', () => {
    const data = { ata_smart_attributes: { table: [{ id: 246, name: 'Total_LBAs_Written', raw: { value: 3130197676 } }] } };
    // 3130197676 * 512 / 1e12 ≒ 1.60 TB
    assert.ok(Math.abs(calcTbw(data) - 1.60) < 0.01, 'got ' + calcTbw(data));
});

test('calcTbw: 情報無しは0', () => {
    assert.strictEqual(calcTbw({}), 0);
});

// ============================================================
// calcLife: 残り寿命
// ============================================================
test('calcLife: endurance_used から算出', () => {
    const data = { endurance_used: { current_percent: 2 } };
    const r = calcLife(data);
    assert.strictEqual(r.lifePercent, 98);
});

test('calcLife: NVMe percentage_used から算出', () => {
    const data = { nvme_smart_health_information_log: { percentage_used: 2 } };
    const r = calcLife(data);
    assert.strictEqual(r.lifePercent, 98);
});

test('calcLife: ATA寿命属性(232/233/202)のvalueを採用', () => {
    const data = { ata_smart_attributes: { table: [{ id: 202, value: 99 }] } };
    const r = calcLife(data);
    assert.strictEqual(r.lifePercent, 99);
});

// ============================================================
// calcSectorCounts: ATA属性から代替/保留/CRCを抽出
// ============================================================
test('calcSectorCounts: HGST HTS725050 は保留中144', () => {
    const data = findByModel('HTS725050');
    const r = calcSectorCounts(data);
    assert.strictEqual(r.pendingSectors, 144);
    assert.strictEqual(r.reallocSectors, 0);
});

test('calcSectorCounts: NVMe は media_errors を reallocSectors に', () => {
    const data = findByModel('APPLE SSD');
    const r = calcSectorCounts(data);
    assert.strictEqual(r.reallocSectors, data.nvme_smart_health_information_log.media_errors);
});

test('calcSectorCounts: 属性無しは全て-1', () => {
    const r = calcSectorCounts({});
    assert.strictEqual(r.reallocSectors, -1);
    assert.strictEqual(r.pendingSectors, -1);
    assert.strictEqual(r.crcErrors, -1);
});

// ============================================================
// detectCustomType: デバイスタイプ推定
// ============================================================
test('detectCustomType: NVMeプロトコル', () => {
    assert.strictEqual(detectCustomType('NVMe', 'X', '', ''), 'nvme');
});

test('detectCustomType: モデル名にemmc', () => {
    assert.strictEqual(detectCustomType('', 'Foo eMMC 64G', '', ''), 'emmc');
});

test('detectCustomType: モデル名にsshd', () => {
    assert.strictEqual(detectCustomType('', 'ST500LM000 SSHD', '', ''), 'sshd');
});

test('detectCustomType: モデル名にssd', () => {
    assert.strictEqual(detectCustomType('ATA', 'CT250MX500SSD1', 'ata', ''), 'sata-ssd');
});

test('detectCustomType: 既存値があればそれを維持', () => {
    assert.strictEqual(detectCustomType('ATA', 'X', '', 'hdd-25'), 'hdd-25');
});

test('detectCustomType: 該当なしはunknown', () => {
    assert.strictEqual(detectCustomType('', 'FooBar', '', ''), 'unknown');
});
