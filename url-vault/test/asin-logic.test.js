const { test } = require('node:test');
const assert = require('node:assert');
const {
    extractAsin,
    selectAsinItems,
    extractAsins
} = require('../js/asin-logic.js');

test('extractAsin: クエリパラメータasinを優先して返す', () => {
    assert.strictEqual(
        extractAsin(
            'https://read.amazon.co.jp/?asin=B0BQ2XXKNX&language=ja-JP'
        ),
        'B0BQ2XXKNX'
    );
});

test('extractAsin: クエリasinが小文字なら大文字化して返す', () => {
    assert.strictEqual(
        extractAsin('https://read.amazon.co.jp/?asin=b0bq2xxknx'),
        'B0BQ2XXKNX'
    );
});

test('extractAsin: クエリasinがない場合はパスの末尾から抽出', () => {
    assert.strictEqual(
        extractAsin('https://read.amazon.co.jp/manga/B0BQ2XXKNX'),
        'B0BQ2XXKNX'
    );
});

test('extractAsin: パスのASINが途中セグメントでも抽出', () => {
    assert.strictEqual(
        extractAsin('https://read.amazon.co.jp/B0BQ2XXKNX/title'),
        'B0BQ2XXKNX'
    );
});

test('extractAsin: パス末尾にスラッシュがあっても抽出', () => {
    assert.strictEqual(
        extractAsin('https://read.amazon.co.jp/manga/B0BQ2XXKNX/'),
        'B0BQ2XXKNX'
    );
});

test('extractAsin: パスのASINが小文字なら大文字化して返す', () => {
    assert.strictEqual(
        extractAsin('https://read.amazon.co.jp/manga/b0bq2xxknx'),
        'B0BQ2XXKNX'
    );
});

test('extractAsin: クエリasinが空文字ならパスへフォールバック', () => {
    assert.strictEqual(
        extractAsin('https://read.amazon.co.jp/manga/B0BQ2XXKNX?asin='),
        'B0BQ2XXKNX'
    );
});

test('extractAsin: 数字のみ10文字も抽出', () => {
    assert.strictEqual(
        extractAsin('https://read.amazon.co.jp/4081234567'),
        '4081234567'
    );
});

test('extractAsin: hostnameがAmazon通常ドメインならnull', () => {
    assert.strictEqual(
        extractAsin('https://www.amazon.co.jp/dp/B0BQ2XXKNX'),
        null
    );
});

test('extractAsin: hostnameが全く別ならnull', () => {
    assert.strictEqual(extractAsin('https://example.com/B0BQ2XXKNX'), null);
});

test('extractAsin: パスに10文字英数がないならnull', () => {
    assert.strictEqual(
        extractAsin('https://read.amazon.co.jp/manga/short'),
        null
    );
});

test('extractAsin: 11文字セグメントは境界不一致でnull', () => {
    assert.strictEqual(
        extractAsin('https://read.amazon.co.jp/B0BQ2XXKNXA'),
        null
    );
});

test('extractAsin: 不正URLならnull', () => {
    assert.strictEqual(extractAsin('not-a-url'), null);
});

test('extractAsin: 空文字ならnull', () => {
    assert.strictEqual(extractAsin(''), null);
});

test('selectAsinItems: windowIdと複数groupIdsで絞り込み', () => {
    const items = [
        { id: 1, windowId: 1, groupId: 10, sortOrder: 3 },
        { id: 2, windowId: 1, groupId: 20, sortOrder: 1 },
        { id: 3, windowId: 2, groupId: 10, sortOrder: 2 },
        { id: 4, windowId: 1, groupId: 30, sortOrder: 0 }
    ];
    const selected = selectAsinItems(items, 1, [10, 20]);
    assert.deepStrictEqual(
        selected.map((item) => item.id),
        [2, 1]
    );
});

test('selectAsinItems: sortOrder昇順に並ぶ', () => {
    const items = [
        { id: 1, windowId: 1, groupId: 10, sortOrder: 5 },
        { id: 2, windowId: 1, groupId: 10, sortOrder: 2 },
        { id: 3, windowId: 1, groupId: 10, sortOrder: 9 },
        { id: 4, windowId: 1, groupId: 10 }
    ];
    const selected = selectAsinItems(items, 1, [10]);
    assert.deepStrictEqual(
        selected.map((item) => item.id),
        [4, 2, 1, 3]
    );
});

test('selectAsinItems: groupIdsが空配列なら空配列', () => {
    const items = [{ id: 1, windowId: 1, groupId: 10, sortOrder: 1 }];
    assert.deepStrictEqual(selectAsinItems(items, 1, []), []);
});

test('selectAsinItems: 該当windowIdなしは空配列', () => {
    const items = [{ id: 1, windowId: 1, groupId: 10, sortOrder: 1 }];
    assert.deepStrictEqual(selectAsinItems(items, 9, [10]), []);
});

test('selectAsinItems: 元配列の順序を変更しない', () => {
    const items = [
        { id: 1, windowId: 1, groupId: 10, sortOrder: 2 },
        { id: 2, windowId: 1, groupId: 10, sortOrder: 1 }
    ];
    selectAsinItems(items, 1, [10]);
    assert.deepStrictEqual(
        items.map((item) => item.id),
        [1, 2]
    );
});

test('extractAsins: 複数アイテムから並び順を維持して抽出', () => {
    const items = [
        { url: 'https://read.amazon.co.jp/manga/AAAAAAAAAA' },
        { url: 'https://read.amazon.co.jp/?asin=BBBBBBBBBB' }
    ];
    assert.deepStrictEqual(extractAsins(items), ['AAAAAAAAAA', 'BBBBBBBBBB']);
});

test('extractAsins: 重複ASINは先頭出現のみ残す', () => {
    const items = [
        { url: 'https://read.amazon.co.jp/manga/AAAAAAAAAA' },
        { url: 'https://read.amazon.co.jp/?asin=AAAAAAAAAA' },
        { url: 'https://read.amazon.co.jp/manga/BBBBBBBBBB' }
    ];
    assert.deepStrictEqual(extractAsins(items), ['AAAAAAAAAA', 'BBBBBBBBBB']);
});

test('extractAsins: Kindleドメイン以外のURLは除外', () => {
    const items = [
        { url: 'https://www.amazon.co.jp/dp/AAAAAAAAAA' },
        { url: 'https://read.amazon.co.jp/manga/BBBBBBBBBB' }
    ];
    assert.deepStrictEqual(extractAsins(items), ['BBBBBBBBBB']);
});

test('extractAsins: ASIN抽出失敗(null)のURLは除外', () => {
    const items = [
        { url: 'https://read.amazon.co.jp/manga/short' },
        { url: 'https://read.amazon.co.jp/manga/BBBBBBBBBB' }
    ];
    assert.deepStrictEqual(extractAsins(items), ['BBBBBBBBBB']);
});

test('extractAsins: すべて対象外なら空配列', () => {
    const items = [
        { url: 'https://example.com/AAAAAAAAAA' },
        { url: 'https://read.amazon.co.jp/manga/short' }
    ];
    assert.deepStrictEqual(extractAsins(items), []);
});
