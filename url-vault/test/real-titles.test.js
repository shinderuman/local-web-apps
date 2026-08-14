const { test } = require('node:test');
const assert = require('node:assert');
const {
    parseVolume,
    parseBaseTitle,
    normalizeDigits
} = require('../js/title-parser.js');
const titles = require('./real-titles.json');

test('実データ全件: parseVolume が期待値と一致', () => {
    Object.entries(titles).forEach(([title, expected]) => {
        const actual = parseVolume(title);
        assert.strictEqual(
            actual,
            expected,
            `巻数不一致: "${title.slice(0, 30)}..." expected=${expected} actual=${actual}`
        );
    });
});

test('実データ全件: parseBaseTitle がメインタイトル先頭を保持', () => {
    Object.keys(titles).forEach((title) => {
        const base = parseBaseTitle(title);
        const normalized = normalizeDigits(title);
        const main = normalized.split(/[〜～]/)[0];
        const head = (main.match(/^[^0-9（(【第巻]*/) || [''])[0].trim();
        assert.ok(
            head === '' || base.startsWith(head),
            `先頭が保持されていない: "${title.slice(0, 30)}..." base="${base}" head="${head}"`
        );
    });
});

test('本編再掲形式: 後半に巻数がある形式を正しく抽出', () => {
    const cases = [
        {
            title: '魔石グルメ 　11　魔物の力を食べたオレは最強！ 魔石グルメ　魔物の力を食べたオレは最強！ (ドラゴンコミックスエイジ)',
            expected: 11
        },
        {
            title: '３５歳の選択～異世界転生を選んだ場合～（ノヴァコミックス）５ 35歳の選択～異世界転生を選んだ場合～',
            expected: 5
        }
    ];
    cases.forEach(({ title, expected: exp }) => {
        assert.strictEqual(
            parseVolume(title),
            exp,
            `本編再掲形式の巻数不一致: "${title.slice(0, 30)}..."`
        );
    });
});
