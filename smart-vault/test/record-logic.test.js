const { test } = require('node:test');
const assert = require('node:assert');
const {
    countRecordsByType,
    getNextSortState,
    sortRecords,
    filterRecordsByType,
    reorderRecordsByVisiblePosition,
    isValidSmartRecordList
} = require('../js/record-logic.js');

// ============================================================
// レコード集計・表示
// ============================================================

test('countRecordsByType: フィルタ種別ごとの件数と全件数を返す', () => {
    const records = [{ customType: 'nvme' }, { customType: 'hdd-35' }, {}];
    const result = countRecordsByType(records, [
        'all',
        'nvme',
        'hdd-35',
        'unknown'
    ]);

    assert.deepStrictEqual(result, {
        all: 3,
        nvme: 1,
        'hdd-35': 1,
        unknown: 1
    });
});

test('getNextSortState: 同じ列は昇順・降順・手動順を順に切り替える', () => {
    assert.deepStrictEqual(
        getNextSortState({ sortField: 'model', sortOrder: 'asc' }, 'model'),
        { sortField: 'model', sortOrder: 'desc' }
    );
    assert.deepStrictEqual(
        getNextSortState({ sortField: 'model', sortOrder: 'desc' }, 'model'),
        { sortField: '', sortOrder: 'asc' }
    );
    assert.deepStrictEqual(
        getNextSortState({ sortField: 'model', sortOrder: 'asc' }, 'vendor'),
        { sortField: 'vendor', sortOrder: 'asc' }
    );
});

test('sortRecords: 数値列を昇順に並べ、元配列を変更しない', () => {
    const records = [
        { id: 1, severityScore: 5 },
        { id: 2, severityScore: null },
        { id: 3, severityScore: 2 }
    ];
    const result = sortRecords(records, 'severityScore', 'asc');

    assert.deepStrictEqual(
        result.map((record) => record.id),
        [2, 3, 1]
    );
    assert.deepStrictEqual(
        records.map((record) => record.id),
        [1, 2, 3]
    );
});

test('filterRecordsByType: allは全件、それ以外は分類一致だけを返す', () => {
    const records = [{ customType: 'nvme' }, { customType: 'hdd-35' }, {}];

    assert.strictEqual(filterRecordsByType(records, 'all').length, 3);
    assert.deepStrictEqual(filterRecordsByType(records, 'unknown'), [{}]);
});

test('reorderRecordsByVisiblePosition: 表示中レコードの移動を全体配列へ反映する', () => {
    const records = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const visibleRecords = [{ id: 1 }, { id: 3 }];
    const result = reorderRecordsByVisiblePosition(
        records,
        visibleRecords,
        3,
        1,
        0
    );

    assert.deepStrictEqual(
        result.map((record) => record.id),
        [3, 1, 2, 4]
    );
    assert.deepStrictEqual(
        records.map((record) => record.id),
        [1, 2, 3, 4]
    );
});

test('isValidSmartRecordList: healthLevelを持つレコード配列だけを受け入れる', () => {
    assert.strictEqual(isValidSmartRecordList([{ healthLevel: 'L1' }]), true);
    assert.strictEqual(isValidSmartRecordList([{ model: 'SSD' }]), false);
    assert.strictEqual(isValidSmartRecordList({ healthLevel: 'L1' }), false);
});
