const { test } = require('node:test');
const assert = require('node:assert');
const { buildStorageSummaryMarkdown } = require('../js/summary-logic.js');

// app.js と同じ TYPE_LABELS 定義（テスト用に複製）
const TYPE_LABELS = {
    nvme: 'NVMe',
    'sata-ssd': 'SATA SSD',
    sshd: 'SSHD',
    'hdd-25': 'HDD 2.5"',
    'hdd-35': 'HDD 3.5"',
    emmc: 'eMMC',
    unknown: '不明'
};

// ============================================================
// ストレージ一覧サマリ
// ============================================================

test('buildStorageSummaryMarkdown: 種別ごとに見出しと件数を出力する', () => {
    const records = [
        { customType: 'nvme', size: '1 TB' },
        { customType: 'sata-ssd', size: '250 GB' }
    ];
    assert.strictEqual(
        buildStorageSummaryMarkdown(records, TYPE_LABELS),
        '## NVMe（1台）\n* 1 TB * 1\n\n## SATA SSD（1台）\n* 250 GB * 1'
    );
});

test('buildStorageSummaryMarkdown: 同一容量を束ねて個数を付ける', () => {
    const records = [
        { customType: 'nvme', size: '1 TB' },
        { customType: 'nvme', size: '1 TB' },
        { customType: 'nvme', size: '500 GB' }
    ];
    assert.strictEqual(
        buildStorageSummaryMarkdown(records, TYPE_LABELS),
        '## NVMe（3台）\n* 1 TB * 2\n* 500 GB * 1'
    );
});

test('buildStorageSummaryMarkdown: TYPE_LABELS の定義順に出力する', () => {
    const records = [
        { customType: 'unknown', size: '2 TB' },
        { customType: 'nvme', size: '1 TB' },
        { customType: 'hdd-35', size: '8 TB' }
    ];
    assert.strictEqual(
        buildStorageSummaryMarkdown(records, TYPE_LABELS),
        '## NVMe（1台）\n* 1 TB * 1\n\n' +
            '## HDD 3.5"（1台）\n* 8 TB * 1\n\n' +
            '## 不明（1台）\n* 2 TB * 1'
    );
});

test('buildStorageSummaryMarkdown: 件数0の種別はスキップする', () => {
    const records = [{ customType: 'nvme', size: '1 TB' }];
    assert.strictEqual(
        buildStorageSummaryMarkdown(records, TYPE_LABELS),
        '## NVMe（1台）\n* 1 TB * 1'
    );
});

test('buildStorageSummaryMarkdown: 空サイズは容量不明に集約する', () => {
    const records = [
        { customType: 'nvme', size: '' },
        { customType: 'nvme', size: undefined },
        { customType: 'nvme', size: '1 TB' }
    ];
    assert.strictEqual(
        buildStorageSummaryMarkdown(records, TYPE_LABELS),
        '## NVMe（3台）\n* 容量不明 * 2\n* 1 TB * 1'
    );
});

test('buildStorageSummaryMarkdown: customType未設定は不明に集約する', () => {
    const records = [{ size: '1 TB' }, { customType: '', size: '500 GB' }];
    assert.strictEqual(
        buildStorageSummaryMarkdown(records, TYPE_LABELS),
        '## 不明（2台）\n* 1 TB * 1\n* 500 GB * 1'
    );
});

test('buildStorageSummaryMarkdown: レコード0件は空文字を返す', () => {
    assert.strictEqual(buildStorageSummaryMarkdown([], TYPE_LABELS), '');
});

test('buildStorageSummaryMarkdown: null入力は空文字を返す', () => {
    assert.strictEqual(buildStorageSummaryMarkdown(null, TYPE_LABELS), '');
});
