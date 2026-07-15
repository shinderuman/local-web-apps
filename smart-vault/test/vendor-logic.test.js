const { test } = require('node:test');
const assert = require('node:assert');
const { detectVendor } = require('../js/vendor-logic.js');

// ============================================================
// detectVendor: モデル名・PCI Vendor ID からベンダー名を判定
// ============================================================
test('detectVendor: モデル名 APPLE を Apple に', () => {
    assert.strictEqual(detectVendor({}, 'APPLE SSD AP0256Z'), 'Apple');
});

test('detectVendor: PCI Vendor ID 4203 を Apple に', () => {
    assert.strictEqual(
        detectVendor({ nvme_pci_vendor: { id: 4203 } }, 'X0256'),
        'Apple'
    );
});

test('detectVendor: Samsung', () => {
    assert.strictEqual(detectVendor({}, 'Samsung SSD 970 EVO'), 'Samsung');
});

test('detectVendor: Crucial', () => {
    assert.strictEqual(detectVendor({}, 'CT250MX500SSD1'), 'Crucial');
});

test('detectVendor: Western Digital（WD含む）', () => {
    assert.strictEqual(detectVendor({}, 'WDS500G2B0A'), 'Western Digital');
});

test('detectVendor: Seagate（ST含む）', () => {
    assert.strictEqual(detectVendor({}, 'ST500LM000-1EJ162'), 'Seagate');
});

test('detectVendor: Toshiba', () => {
    assert.strictEqual(detectVendor({}, 'TOSHIBA MQ01ABF050'), 'Toshiba');
});

test('detectVendor: HGST', () => {
    assert.strictEqual(detectVendor({}, 'HGST HTS725050A7E630'), 'HGST');
});

test('detectVendor: HITACHI', () => {
    assert.strictEqual(detectVendor({}, 'Hitachi HTS545032A7E380'), 'HITACHI');
});

test('detectVendor: 該当なしはモデル名の先頭語', () => {
    assert.strictEqual(detectVendor({}, 'Silicon Power S55'), 'Silicon');
});

test('detectVendor: 空文字は不明', () => {
    assert.strictEqual(detectVendor({}, ''), '不明');
});
