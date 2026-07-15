const { test } = require('node:test');
const assert = require('node:assert');
const {
    parseVolume,
    parseBaseTitle,
    normalizeDigits
} = require('../js/title-parser.js');
const titles = require('./real-titles.json');
const expected = require('./real-titles.expected.json');

// 実データ全168件のスナップショットテスト
// parseVolume の結果が期待値と一致するか検証（将来のデグレ防止）
test('実データ全件: parseVolume が期待値と一致', () => {
    titles.forEach((title) => {
        const actual = parseVolume(title);
        const exp = expected[title];
        assert.strictEqual(
            actual,
            exp,
            `巻数不一致: "${title.slice(0, 30)}..." expected=${exp} actual=${actual}`
        );
    });
});

// parseBaseTitle の確認：メインタイトル（最初の〜/～の前）の先頭が保持されているか
test('実データ全件: parseBaseTitle がメインタイトル先頭を保持', () => {
    titles.forEach((title) => {
        const base = parseBaseTitle(title);
        // メインタイトル（最初の〜/～の前）を抽出し、その先頭部分が base に含まれるか検証
        // 数字・括弧・「第」「巻」は巻数表記の可能性があるため除外して比較
        const normalized = normalizeDigits(title);
        const main = normalized.split(/[〜～]/)[0];
        const head = (main.match(/^[^0-9（(【第巻]*/) || [''])[0].trim();
        assert.ok(
            head === '' || base.startsWith(head),
            `先頭が保持されていない: "${title.slice(0, 30)}..." base="${base}" head="${head}"`
        );
    });
});

// 既知の制限：以下は自動判定不可（右ペインで手動調整前提）
test('既知の制限: 特殊形式タイトルは手動調整対象', () => {
    // これらは現状 vol=1 となるが、正しくは別の巻数
    const manualCases = [
        '魔石グルメ 　11　魔物の力を食べたオレは最強！ 魔石グルメ　魔物の力を食べたオレは最強！ (ドラゴンコミックスエイジ)',
        '３５歳の選択～異世界転生を選んだ場合～（ノヴァコミックス）５ 35歳の選択～異世界転生を選んだ場合～'
    ];
    manualCases.forEach((title) => {
        // 現状の実装では取れないことを記録（将来改善時はこのテストを更新）
        assert.strictEqual(parseVolume(title), 1);
    });
});
