const { test } = require('node:test');
const assert = require('node:assert');
const {
    filterVisibleItems,
    isKindleUrl,
    hasSynopsis,
    isTrashSelected,
    updateGroupMemory,
    getRememberedGroup,
    validateRememberedGroup,
    duplicateKey,
    filterDuplicates
} = require('../js/filter-logic.js');
const { parseBaseTitle } = require('../js/title-parser.js');

const TRASH_WINDOW_ID = 99999;

// ============================================================
// isKindleUrl
// ============================================================

test('isKindleUrl: Kindleドメインならtrue', () => {
    assert.strictEqual(
        isKindleUrl('https://read.amazon.co.jp/manga/B123'),
        true
    );
});

test('isKindleUrl: Kindle以外ならfalse', () => {
    assert.strictEqual(isKindleUrl('https://example.com/page'), false);
});

test('isKindleUrl: 空文字ならfalse', () => {
    assert.strictEqual(isKindleUrl(''), false);
});

// ============================================================
// hasSynopsis
// ============================================================

test('hasSynopsis: 配列で1件以上ならtrue', () => {
    assert.strictEqual(
        hasSynopsis({ synopsis: [{ volume: 1, caption: 'あらすじ' }] }),
        true
    );
});

test('hasSynopsis: 配列で0件ならfalse', () => {
    assert.strictEqual(hasSynopsis({ synopsis: [] }), false);
});

test('hasSynopsis: synopsis未定義ならfalse', () => {
    assert.strictEqual(hasSynopsis({}), false);
});

test('hasSynopsis: synopsisが配列でない（壊れたデータ）ならfalse', () => {
    assert.strictEqual(hasSynopsis({ synopsis: { error: 'network' } }), false);
});

test('hasSynopsis: synopsisがnullならfalse', () => {
    assert.strictEqual(hasSynopsis({ synopsis: null }), false);
});

// ============================================================
// isTrashSelected
// ============================================================

test('isTrashSelected: ゴミ箱ウィンドウIDならtrue', () => {
    assert.strictEqual(isTrashSelected(99999, 99999), true);
});

test('isTrashSelected: 通常ウィンドウIDならfalse', () => {
    assert.strictEqual(isTrashSelected(1, 99999), false);
});

test('isTrashSelected: null（すべて選択）ならfalse', () => {
    assert.strictEqual(isTrashSelected(null, 99999), false);
});

// ============================================================
// filterVisibleItems
// ============================================================

const ALL_ITEMS = [
    { id: 1, windowId: 1, groupId: 10, title: 'アイテム1' },
    { id: 2, windowId: 1, groupId: 11, title: 'アイテム2' },
    { id: 3, windowId: 2, groupId: 20, title: '検索対象' },
    {
        id: 4,
        windowId: TRASH_WINDOW_ID,
        groupId: 99999,
        title: 'ゴミ箱アイテム'
    }
];

test('filterVisibleItems: すべて選択（windowId=null）は通常アイテムのみ', () => {
    const result = filterVisibleItems(
        ALL_ITEMS,
        null,
        null,
        '',
        TRASH_WINDOW_ID
    );
    assert.strictEqual(result.length, 3);
    assert.ok(!result.some((i) => i.windowId === TRASH_WINDOW_ID));
});

test('filterVisibleItems: ゴミ箱選択時はゴミ箱アイテムのみ', () => {
    const result = filterVisibleItems(
        ALL_ITEMS,
        TRASH_WINDOW_ID,
        null,
        '',
        TRASH_WINDOW_ID
    );
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 4);
});

test('filterVisibleItems: ウィンドウ絞り込み', () => {
    const result = filterVisibleItems(ALL_ITEMS, 2, null, '', TRASH_WINDOW_ID);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 3);
});

test('filterVisibleItems: グループ絞り込み', () => {
    const result = filterVisibleItems(ALL_ITEMS, 1, 11, '', TRASH_WINDOW_ID);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 2);
});

test('filterVisibleItems: 検索クエリ絞り込み', () => {
    const result = filterVisibleItems(
        ALL_ITEMS,
        null,
        null,
        '検索',
        TRASH_WINDOW_ID
    );
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 3);
});

test('filterVisibleItems: ゴミ箱選択時は検索クエリも適用', () => {
    const result = filterVisibleItems(
        ALL_ITEMS,
        TRASH_WINDOW_ID,
        null,
        'ゴミ箱',
        TRASH_WINDOW_ID
    );
    assert.strictEqual(result.length, 1);
});

// ============================================================
// updateGroupMemory / getRememberedGroup
// ============================================================

test('updateGroupMemory: 新しいエントリを追加', () => {
    const result = updateGroupMemory({}, 1, 10);
    assert.strictEqual(result[1], 10);
});

test('updateGroupMemory: 既存エントリを更新', () => {
    const result = updateGroupMemory({ 1: 10 }, 1, 11);
    assert.strictEqual(result[1], 11);
});

test('updateGroupMemory: 元オブジェクトは変更しない（非破壊）', () => {
    const original = { 1: 10 };
    updateGroupMemory(original, 1, 11);
    assert.strictEqual(original[1], 10);
});

test('getRememberedGroup: 記憶済みならそのID', () => {
    assert.strictEqual(getRememberedGroup({ 1: 10 }, 1), 10);
});

test('getRememberedGroup: 未記憶ならnull', () => {
    assert.strictEqual(getRememberedGroup({ 1: 10 }, 2), null);
});

// ============================================================
// validateRememberedGroup
// ============================================================

test('validateRememberedGroup: 実在グループならそのID', () => {
    const groups = [
        { id: 10, name: 'A' },
        { id: 11, name: 'B' }
    ];
    assert.strictEqual(validateRememberedGroup(10, groups), 10);
});

test('validateRememberedGroup: 存在しないIDならnull', () => {
    const groups = [{ id: 10, name: 'A' }];
    assert.strictEqual(validateRememberedGroup(99, groups), null);
});

test('validateRememberedGroup: groupIdがnullならnull', () => {
    const groups = [{ id: 10, name: 'A' }];
    assert.strictEqual(validateRememberedGroup(null, groups), null);
});

// ============================================================
// duplicateKey / filterDuplicates
// ============================================================

test('duplicateKey: 作品名の先頭n文字を返す', () => {
    assert.strictEqual(
        duplicateKey({ title: '作品A (4)' }, 3, parseBaseTitle),
        '作品A'
    );
});

test('filterDuplicates: 巻違いが両方残る', () => {
    const items = [
        { id: 1, title: '作品A (4)' },
        { id: 2, title: '作品A (5)' },
        { id: 3, title: '別作品' }
    ];
    const result = filterDuplicates(items, 3, parseBaseTitle);
    assert.deepStrictEqual(
        result.map((i) => i.id),
        [1, 2]
    );
});

test('filterDuplicates: 雑誌名括弧付きと無しは同一と判定', () => {
    const items = [
        { id: 1, title: '作品A (週刊X)' },
        { id: 2, title: '作品A' }
    ];
    const result = filterDuplicates(items, 3, parseBaseTitle);
    assert.deepStrictEqual(
        result.map((i) => i.id),
        [1, 2]
    );
});

test('filterDuplicates: サブタイトル付きは本編と同一と判定', () => {
    const items = [
        { id: 1, title: '作品A 〜副題〜' },
        { id: 2, title: '作品A' }
    ];
    const result = filterDuplicates(items, 3, parseBaseTitle);
    assert.deepStrictEqual(
        result.map((i) => i.id),
        [1, 2]
    );
});

test('filterDuplicates: 全く異なる作品は残らない', () => {
    const items = [
        { id: 1, title: '作品A' },
        { id: 2, title: '作品B' },
        { id: 3, title: '作品C' }
    ];
    const result = filterDuplicates(items, 3, parseBaseTitle);
    assert.strictEqual(result.length, 0);
});

test('filterDuplicates: 1件のみ（同じキーが2件未満）は残らない', () => {
    const items = [
        { id: 1, title: '作品A' },
        { id: 2, title: '作品B' }
    ];
    const result = filterDuplicates(items, 6, parseBaseTitle);
    assert.strictEqual(result.length, 0);
});

test('filterDuplicates: nを大きくすると別作品に分かれる', () => {
    const items = [
        { id: 1, title: '進撃の巨人 1' },
        { id: 2, title: '進撃の巨人 2' },
        { id: 3, title: '進撃の別物' }
    ];
    // n=3 なら「進撃の」で3件とも同一 → 全件残る
    assert.strictEqual(filterDuplicates(items, 3, parseBaseTitle).length, 3);
    // n=4 なら3件目が「進撃の別」で分岐 → 1,2のみ残る
    assert.deepStrictEqual(
        filterDuplicates(items, 4, parseBaseTitle).map((i) => i.id),
        [1, 2]
    );
});

test('filterDuplicates: 作品名がn文字未満の場合は全文字で比較', () => {
    const items = [
        { id: 1, title: 'AB 1' },
        { id: 2, title: 'AB 2' }
    ];
    const result = filterDuplicates(items, 6, parseBaseTitle);
    assert.deepStrictEqual(
        result.map((i) => i.id),
        [1, 2]
    );
});

test('filterDuplicates: 空配列は空配列を返す（非破壊）', () => {
    const result = filterDuplicates([], 6, parseBaseTitle);
    assert.deepStrictEqual(result, []);
});

test('filterDuplicates: 元配列を変更しない（非破壊）', () => {
    const items = [
        { id: 1, title: '作品A' },
        { id: 2, title: '作品A' }
    ];
    filterDuplicates(items, 3, parseBaseTitle);
    assert.strictEqual(items.length, 2);
});
