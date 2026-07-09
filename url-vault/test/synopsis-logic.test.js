const { test } = require('node:test');
const assert = require('node:assert');
const {
    buildRakutenUrl,
    buildVolumeMap,
    selectTargetVolumes,
    tokenizeQuery,
    shortenQuery
} = require('../js/synopsis-logic.js');

// parseVolumeはtitle-parser.jsに依存するため、テスト用にモック
const mockParseVolume = (title) => {
    const m = title.match(/[（(]([0-9]+)[）)]/);
    return m ? parseInt(m[1], 10) : 1;
};

// ============================================================
// buildRakutenUrl
// ============================================================

test('buildRakutenUrl: クエリを含むURLを構築', () => {
    const url = buildRakutenUrl('app123', 'key456', '漫画タイトル');
    assert.ok(url.includes('applicationId=app123'));
    assert.ok(url.includes('accessKey=key456'));
    assert.ok(url.includes('booksGenreId=001001'));
    assert.ok(url.includes('hits=30'));
    assert.ok(url.includes('title='));
});

test('buildRakutenUrl: クエリはURLエンコードされる', () => {
    const url = buildRakutenUrl('app', 'key', 'タイトル 1');
    assert.ok(url.includes(encodeURIComponent('タイトル 1')));
});

// ============================================================
// buildVolumeMap
// ============================================================

test('buildVolumeMap: 各巻をvolumeキーで整理', () => {
    const items = [
        { Item: { title: '作品（1）', itemCaption: 'あらすじ1' } },
        { Item: { title: '作品（2）', itemCaption: 'あらすじ2' } }
    ];
    const map = buildVolumeMap(items, mockParseVolume);
    assert.strictEqual(map[1].volume, 1);
    assert.strictEqual(map[1].caption, 'あらすじ1');
    assert.strictEqual(map[2].volume, 2);
    assert.strictEqual(map[2].caption, 'あらすじ2');
});

test('buildVolumeMap: itemCaptionがない場合は除外', () => {
    const items = [
        { Item: { title: '作品（1）', itemCaption: '' } },
        { Item: { title: '作品（2）', itemCaption: 'あらすじ2' } }
    ];
    const map = buildVolumeMap(items, mockParseVolume);
    assert.strictEqual(map[1], undefined);
    assert.strictEqual(map[2].caption, 'あらすじ2');
});

test('buildVolumeMap: 同巻は最初の1件のみ', () => {
    const items = [
        { Item: { title: '作品（1）', itemCaption: '1つ目' } },
        { Item: { title: '作品（1）セット', itemCaption: '2つ目' } }
    ];
    const map = buildVolumeMap(items, mockParseVolume);
    assert.strictEqual(map[1].caption, '1つ目');
});

// ============================================================
// selectTargetVolumes
// ============================================================

test('selectTargetVolumes: 5巻起点→3,4,5', () => {
    const map = {
        3: { volume: 3 }, 4: { volume: 4 }, 5: { volume: 5 }
    };
    const result = selectTargetVolumes(map, 5);
    assert.deepStrictEqual(result.map(r => r.volume), [3, 4, 5]);
});

test('selectTargetVolumes: 1巻起点→1,2,3（前を詰めない）', () => {
    const map = {
        1: { volume: 1 }, 2: { volume: 2 }, 3: { volume: 3 }
    };
    const result = selectTargetVolumes(map, 1);
    assert.deepStrictEqual(result.map(r => r.volume), [1, 2, 3]);
});

test('selectTargetVolumes: 存在しない巻はスキップ', () => {
    const map = {
        2: { volume: 2 }, 3: { volume: 3 }
    };
    const result = selectTargetVolumes(map, 3);
    assert.deepStrictEqual(result.map(r => r.volume), [2, 3]);
});

test('selectTargetVolumes: 全て存在しない場合は空配列', () => {
    const map = {};
    const result = selectTargetVolumes(map, 5);
    assert.deepStrictEqual(result, []);
});

// ============================================================
// tokenizeQuery
// ============================================================

test('tokenizeQuery: 空白と記号で分割', () => {
    const result = tokenizeQuery('作品名 1巻 (コミックス)');
    assert.deepStrictEqual(result, ['作品名', '1巻', '(コミックス)']);
});

test('tokenizeQuery: 読点で分割', () => {
    const result = tokenizeQuery('タイトル、サブタイトル');
    assert.deepStrictEqual(result, ['タイトル', 'サブタイトル']);
});

test('tokenizeQuery: 空トークンは除外', () => {
    const result = tokenizeQuery('  タイトル  ');
    assert.deepStrictEqual(result, ['タイトル']);
});

// ============================================================
// shortenQuery
// ============================================================

test('shortenQuery: 指定長で前方を結合', () => {
    const tokens = ['タイトル', 'サブ', '追加'];
    assert.strictEqual(shortenQuery(tokens, 2), 'タイトル サブ');
});

test('shortenQuery: 全長の場合は全て結合', () => {
    const tokens = ['A', 'B'];
    assert.strictEqual(shortenQuery(tokens, 2), 'A B');
});

test('shortenQuery: 長さ0の場合は空文字', () => {
    const tokens = ['A', 'B'];
    assert.strictEqual(shortenQuery(tokens, 0), '');
});
