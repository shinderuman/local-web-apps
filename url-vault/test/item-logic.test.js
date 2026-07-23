const { test } = require('node:test');
const assert = require('node:assert');
const {
    calcNextSortOrder,
    shiftSortOrders,
    buildNewItem,
    sortItems,
    isValidItemInput,
    stripSynopsisForExport
} = require('../js/item-logic.js');

// ============================================================
// calcNextSortOrder: 新規アイテムのsortOrderを計算
// ============================================================

test('calcNextSortOrder: 末尾追加時は既存の最大sortOrder+1', () => {
    const items = [{ sortOrder: 0 }, { sortOrder: 1 }, { sortOrder: 2 }];
    assert.strictEqual(calcNextSortOrder(items, false), 3);
});

test('calcNextSortOrder: sortOrderが飛んでいても最大値の次を返す', () => {
    const items = [{ sortOrder: 0 }, { sortOrder: 3 }, { sortOrder: 5 }];

    assert.strictEqual(calcNextSortOrder(items, false), 6);
});

test('calcNextSortOrder: 先頭追加時は0', () => {
    const items = [{ sortOrder: 0 }, { sortOrder: 1 }, { sortOrder: 2 }];
    assert.strictEqual(calcNextSortOrder(items, true), 0);
});

test('calcNextSortOrder: 空配列の場合は末尾追加で0', () => {
    assert.strictEqual(calcNextSortOrder([], false), 0);
});

test('calcNextSortOrder: 空配列の場合は先頭追加で0', () => {
    assert.strictEqual(calcNextSortOrder([], true), 0);
});

// ============================================================
// shiftSortOrders: 先頭追加時に既存アイテムのsortOrderを+1
// ============================================================

test('shiftSortOrders: 各アイテムのsortOrderを+1する', () => {
    const items = [
        { id: 1, sortOrder: 0 },
        { id: 2, sortOrder: 1 },
        { id: 3, sortOrder: 2 }
    ];
    const result = shiftSortOrders(items);
    assert.deepStrictEqual(result, [
        { id: 1, sortOrder: 1 },
        { id: 2, sortOrder: 2 },
        { id: 3, sortOrder: 3 }
    ]);
});

test('shiftSortOrders: sortOrder未定義は1になる', () => {
    const items = [{ id: 1 }];
    const result = shiftSortOrders(items);
    assert.strictEqual(result[0].sortOrder, 1);
});

test('shiftSortOrders: 元配列は変更しない（非破壊）', () => {
    const items = [{ id: 1, sortOrder: 0 }];
    shiftSortOrders(items);
    assert.strictEqual(items[0].sortOrder, 0);
});

// ============================================================
// buildNewItem: 新規アイテムオブジェクトを構築
// ============================================================

test('buildNewItem: 全フィールドを含む新規アイテムを構築', () => {
    const result = buildNewItem(
        {
            windowId: 1,
            groupId: 2,
            title: 'タイトル',
            url: 'https://example.com',
            image: 'data:image/jpeg;base64,xxx',
            sortOrder: 0
        },
        1234567890
    );
    assert.deepStrictEqual(result, {
        windowId: 1,
        groupId: 2,
        title: 'タイトル',
        url: 'https://example.com',
        image: 'data:image/jpeg;base64,xxx',
        sortOrder: 0,
        createdAt: 1234567890
    });
});

test('buildNewItem: createdAtは第2引数で指定', () => {
    const result = buildNewItem(
        {
            windowId: 1,
            groupId: 1,
            title: 't',
            url: 'u',
            image: '',
            sortOrder: 5
        },
        9999
    );
    assert.strictEqual(result.createdAt, 9999);
});

// ============================================================
// sortItems: アイテム配列をソート
// ============================================================

test('sortItems: 手動順（sortOrder昇順）', () => {
    const items = [{ sortOrder: 2 }, { sortOrder: 0 }, { sortOrder: 1 }];
    const result = sortItems(items, 'sortOrder', true);
    assert.deepStrictEqual(
        result.map((i) => i.sortOrder),
        [0, 1, 2]
    );
});

test('sortItems: タイトル順昇順', () => {
    const items = [
        { title: 'ばなな' },
        { title: 'あっぷる' },
        { title: 'おれんじ' }
    ];
    const result = sortItems(items, 'title', true);
    assert.deepStrictEqual(
        result.map((i) => i.title),
        ['あっぷる', 'おれんじ', 'ばなな']
    );
});

test('sortItems: タイトル順降順', () => {
    const items = [
        { title: 'ばなな' },
        { title: 'あっぷる' },
        { title: 'おれんじ' }
    ];
    const result = sortItems(items, 'title', false);
    assert.deepStrictEqual(
        result.map((i) => i.title),
        ['ばなな', 'おれんじ', 'あっぷる']
    );
});

test('sortItems: 登録順昇順（createdAt）', () => {
    const items = [{ createdAt: 300 }, { createdAt: 100 }, { createdAt: 200 }];
    const result = sortItems(items, 'createdAt', true);
    assert.deepStrictEqual(
        result.map((i) => i.createdAt),
        [100, 200, 300]
    );
});

test('sortItems: 登録順降順', () => {
    const items = [{ createdAt: 300 }, { createdAt: 100 }, { createdAt: 200 }];
    const result = sortItems(items, 'createdAt', false);
    assert.deepStrictEqual(
        result.map((i) => i.createdAt),
        [300, 200, 100]
    );
});

test('sortItems: 元配列は変更しない（非破壊）', () => {
    const items = [{ sortOrder: 2 }, { sortOrder: 1 }];
    sortItems(items, 'sortOrder', true);
    assert.strictEqual(items[0].sortOrder, 2);
});

test('sortItems: 巻数順昇順（parseVolumeFn注入）', () => {
    const items = [
        { title: '作品 (3)' },
        { title: '作品 (1)' },
        { title: '作品 (2)' }
    ];
    const parseVolume = (t) => parseInt(t.match(/\((\d+)\)/)[1], 10);
    const result = sortItems(items, 'volume', true, parseVolume);
    assert.deepStrictEqual(
        result.map((i) => i.title),
        ['作品 (1)', '作品 (2)', '作品 (3)']
    );
});

test('sortItems: 巻数順降順', () => {
    const items = [
        { title: '作品 (3)' },
        { title: '作品 (1)' },
        { title: '作品 (2)' }
    ];
    const parseVolume = (t) => parseInt(t.match(/\((\d+)\)/)[1], 10);
    const result = sortItems(items, 'volume', false, parseVolume);
    assert.deepStrictEqual(
        result.map((i) => i.title),
        ['作品 (3)', '作品 (2)', '作品 (1)']
    );
});

test('sortItems: volume指定でもparseVolumeFn未渡し時はソートしない', () => {
    const items = [{ title: '作品 (3)' }, { title: '作品 (1)' }];
    const result = sortItems(items, 'volume', true);
    assert.deepStrictEqual(
        result.map((i) => i.title),
        ['作品 (3)', '作品 (1)']
    );
});

// ============================================================
// isValidItemInput: アイテム入力値のバリデーション
// ============================================================

test('isValidItemInput: 全て有効ならtrue', () => {
    assert.strictEqual(
        isValidItemInput('1', '2', 'タイトル', 'https://example.com'),
        true
    );
});

test('isValidItemInput: ウィンドウ値が空ならfalse', () => {
    assert.strictEqual(
        isValidItemInput('', '2', 'タイトル', 'https://example.com'),
        false
    );
});

test('isValidItemInput: グループ値が空ならfalse', () => {
    assert.strictEqual(
        isValidItemInput('1', '', 'タイトル', 'https://example.com'),
        false
    );
});

test('isValidItemInput: タイトルが空ならfalse', () => {
    assert.strictEqual(
        isValidItemInput('1', '2', '', 'https://example.com'),
        false
    );
});

test('isValidItemInput: URLが空ならfalse', () => {
    assert.strictEqual(isValidItemInput('1', '2', 'タイトル', ''), false);
});

test('isValidItemInput: ウィンドウ値が非数ならfalse', () => {
    assert.strictEqual(isValidItemInput('abc', '2', 'タイトル', 'url'), false);
});

test('isValidItemInput: グループ値が非数ならfalse', () => {
    assert.strictEqual(isValidItemInput('1', 'xyz', 'タイトル', 'url'), false);
});

// ============================================================
// stripSynopsisForExport: エクスポート時にsynopsisを除外
// ============================================================

test('stripSynopsisForExport: synopsisフィールドを除外', () => {
    const item = {
        id: 1,
        title: 't',
        url: 'u',
        synopsis: [{ volume: 1, caption: 'あらすじ' }]
    };
    const result = stripSynopsisForExport(item);
    assert.strictEqual(result.synopsis, undefined);
    assert.strictEqual(result.id, 1);
    assert.strictEqual(result.title, 't');
});

test('stripSynopsisForExport: synopsisがない場合はそのまま', () => {
    const item = { id: 1, title: 't', url: 'u' };
    const result = stripSynopsisForExport(item);
    assert.strictEqual(result.synopsis, undefined);
    assert.strictEqual(result.id, 1);
});

test('stripSynopsisForExport: 元オブジェクトは変更しない（非破壊）', () => {
    const item = { id: 1, synopsis: [{ volume: 1 }] };
    stripSynopsisForExport(item);
    assert.deepStrictEqual(item.synopsis, [{ volume: 1 }]);
});
